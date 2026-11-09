#!/bin/sh
# Update the running production stack to the latest code and check that it came up healthy.
# Run on the server, as the deploy user, from anywhere:
#   DOMAIN=staffing.example.com sh infra/scripts/deploy.sh
# DOMAIN may also be set in .env at the repository root. Optional: BRANCH (default main),
# HEALTH_TIMEOUT in seconds for each health check (default 180), SKIP_PULL=1 to redeploy the checked-out commit as is
# (used for rollback).
#
# Steps: git pull, docker compose build, docker compose up -d, then wait until GET /api/health
# answers ok, first inside the Compose network and then through Caddy over HTTPS.
set -eu

BRANCH="${BRANCH:-main}"
SKIP_PULL="${SKIP_PULL:-0}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-180}"

cd "$(dirname "$0")/../.."

log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

# DOMAIN from the environment wins; otherwise read it from .env.
if [ -z "${DOMAIN:-}" ] && [ -f .env ]; then
  # Last DOMAIN= line, without a carriage return, surrounding quotes or a trailing comment.
  DOMAIN="$(sed -n 's/^DOMAIN=//p' .env | tail -n 1 | tr -d '\r' | sed 's/[[:space:]]*#.*$//; s/^["'"'"']//; s/["'"'"']$//')"
fi
[ -n "${DOMAIN:-}" ] || die 'DOMAIN is not set (for example DOMAIN=staffing.example.com)'
export DOMAIN

compose() { docker compose -f compose.yaml -f infra/docker/docker-compose.prod.yml "$@"; }

# Poll a command until it succeeds or the timeout runs out.
wait_until() {
  description="$1"; shift
  deadline=$(( $(date +%s) + HEALTH_TIMEOUT ))
  until "$@" >/dev/null 2>&1; do
    [ "$(date +%s)" -lt "$deadline" ] || return 1
    sleep 3
  done
  log "$description: ok"
}

# The app port is not published, so ask the app from inside its own container.
app_is_healthy() {
  compose exec -T app node -e "fetch('http://localhost:3000/api/health').then(r=>r.json()).then(b=>process.exit(b.status==='ok'?0:1)).catch(()=>process.exit(1))"
}

# Goes through Caddy, so it also proves DNS, the certificate and the proxy work.
public_url_is_healthy() {
  curl -fsS --max-time 10 "https://$DOMAIN/api/health" | grep -q '"status":"ok"'
}

print_rollback_hint() {
  cat >&2 <<HINT

Roll back to the previous version:
  git checkout $PREVIOUS_COMMIT
  SKIP_PULL=1 DOMAIN=$DOMAIN sh infra/scripts/deploy.sh
See infra/README.md, section "Rollback".
HINT
}

PREVIOUS_COMMIT="$(git rev-parse HEAD)"
log "Current version: $PREVIOUS_COMMIT"
# From here on, any failed step prints how to go back.
trap 'status=$?; [ "$status" -eq 0 ] || print_rollback_hint' EXIT

if [ "$SKIP_PULL" = 1 ]; then
  log 'SKIP_PULL=1: deploying the checked-out commit without pulling'
else
  log "Pulling $BRANCH"
  git checkout "$BRANCH"
  git pull --ff-only origin "$BRANCH"
fi

log 'Building and starting the stack'
compose build
compose up -d

if wait_until 'App health (inside the network)' app_is_healthy \
  && wait_until "Public health (https://$DOMAIN/api/health)" public_url_is_healthy; then
  log "Deployed $(git rev-parse --short HEAD). Previous version was $PREVIOUS_COMMIT."
  printf 'To go back: git checkout %s, then SKIP_PULL=1 sh infra/scripts/deploy.sh (see infra/README.md).\n' "$PREVIOUS_COMMIT"
else
  printf 'error: the stack did not become healthy within %s seconds\n' "$HEALTH_TIMEOUT" >&2
  compose ps >&2 || true
  compose logs --tail 30 app caddy >&2 || true
  exit 1
fi
