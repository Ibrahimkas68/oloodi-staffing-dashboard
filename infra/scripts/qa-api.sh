#!/bin/sh
# API checks for the scriptable part of the quickstart scenarios (specs/.../quickstart.md).
#
# WARNING: this RESETS the database named in .env (npm run db:reset) before it starts, and it
# changes data. Do not point it at data you want to keep.
#
# Usage: sh infra/scripts/qa-api.sh --yes [--db-outage]
#   --yes         confirm the reset (or set QA_RESET=1)
#   --db-outage   also stop and restart the db container (needs Docker Compose) to check that
#                 the server survives a database outage and recovers
# The server must already be running. BASE_URL defaults to http://localhost:$PORT (3000).
set -eu
cd "$(dirname "$0")/../.."

CONFIRMED=
# Only the exact value 1 confirms: QA_RESET=0 or QA_RESET=no must not wipe anything.
if [ "${QA_RESET:-}" = 1 ]; then CONFIRMED=1; fi
DB_OUTAGE=
for arg in "$@"; do
  case "$arg" in
    --yes) CONFIRMED=1 ;;
    --db-outage) DB_OUTAGE=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [ -z "$CONFIRMED" ]; then
  echo "WARNING: this script RESETS the database named in .env and changes its data." >&2
  echo "Usage: sh infra/scripts/qa-api.sh --yes [--db-outage]   (or QA_RESET=1)" >&2
  exit 2
fi

if [ -z "${PORT:-}" ] && [ -f .env ]; then
  PORT=$(sed -n 's/^PORT=//p' .env | head -n 1)
fi
BASE_URL=${BASE_URL:-http://localhost:${PORT:-3000}}
# The script resets the database named in .env, so it must test the server that uses that
# database. Refuse anything that is not this machine.
case "$BASE_URL" in
  http://localhost|http://localhost:*|http://localhost/*|http://127.0.0.1|http://127.0.0.1:*|http://127.0.0.1/*) ;;
  *) echo "Refusing to run against $BASE_URL: this script resets the local .env database and only tests a local server." >&2; exit 2 ;;
esac

WORK=$(mktemp -d)
RESULTS="$WORK/results"
: > "$RESULTS"
FAILURES=0
OUTAGE_STARTED=

cleanup() {
  # Never leave the database stopped, even when a check fails halfway.
  if [ -n "$OUTAGE_STARTED" ]; then docker compose start db >/dev/null 2>&1 || true; fi
  rm -rf "$WORK"
}
trap cleanup EXIT
# Not every shell runs the EXIT trap when interrupted: turn a signal into a normal exit.
trap 'exit 130' INT TERM HUP

# ---------- helpers ----------

# Runs an HTTP request. Sets STATUS and keeps the body in $WORK/body.
call() { # method path
  STATUS=$(curl -s --path-as-is --max-time 15 -X "$1" -o "$WORK/body" -w '%{http_code}' "$BASE_URL$2" || echo 000)
}

# Evaluates a JavaScript expression against the JSON in a file, as `b`.
json() { # file expression
  node -e 'const b = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(new Function("b", "return " + process.argv[2])(b));' "$1" "$2"
}
body() { json "$WORK/body" "$1"; }

# Records one result: PASS or FAIL with the case, what was expected and what happened.
check() { # case expected actual
  if [ "$2" = "$3" ]; then verdict=PASS; else verdict=FAIL; FAILURES=$((FAILURES + 1)); fi
  echo "$verdict  $1"
  echo "      expected: $2"
  echo "      actual:   $3"
  printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$verdict" >> "$RESULTS"
}

summary() { body "'v=' + b.version + ' filled=' + b.counts.filled + ' in=' + b.counts.checkedIn + ' out=' + b.counts.checkedOut"; }
# For an action response, where the snapshot is nested.
action_summary() {
  body "'changed=' + b.changed + ' v=' + b.snapshot.version + ' filled=' + b.snapshot.counts.filled + ' in=' + b.snapshot.counts.checkedIn + ' out=' + b.snapshot.counts.checkedOut"
}
# Runs one action and checks the status and the summary line.
act() { # case method path expected-status expected-summary
  call "$2" "$3"
  if [ "$STATUS" = 200 ]; then actual="200 $(action_summary || true)"; else actual="$STATUS $(body 'b.error.code' || true)"; fi
  check "$1" "$4 $5" "$actual"
}

wait_for_health() { # seconds
  waited=0
  while [ "$waited" -lt "$1" ]; do
    call GET /api/health
    if [ "$STATUS" = 200 ]; then return 0; fi
    sleep 1
    waited=$((waited + 1))
  done
  return 1
}

# ---------- start ----------

echo "!! RESETTING THE DATABASE named in .env. Dev data will be lost. !!"
npm run --silent db:reset
if ! wait_for_health 10; then
  echo "The server does not answer at $BASE_URL/api/health. Start it first." >&2
  exit 2
fi
echo "Running against $BASE_URL"
echo

# 1. Initial state
call GET /api/state
check "1 initial state" "200 v=0 filled=0 remaining=3 uninvited=3 rows=3" \
  "$STATUS $(body "'v=' + b.version + ' filled=' + b.counts.filled + ' remaining=' + b.counts.remaining + ' uninvited=' + b.counts.uninvited + ' rows=' + b.assignments.length")"

# 2 and 3. Amina: invite, accept, check in, check out (filled stays 1 after check-out)
act "2 invite Amina" POST /api/assignments/1/invite 200 "changed=true v=1 filled=0 in=0 out=0"
act "3a Amina accepts" POST /api/assignments/1/accept 200 "changed=true v=2 filled=1 in=0 out=0"
act "3b Amina checks in" POST /api/assignments/1/check-in 200 "changed=true v=3 filled=1 in=1 out=0"
act "3c Amina checks out (filled stays 1)" POST /api/assignments/1/check-out 200 "changed=true v=4 filled=1 in=0 out=1"

# 4. Youssef: invite, decline, then no way back
act "4a invite Youssef" POST /api/assignments/2/invite 200 "changed=true v=5 filled=1 in=0 out=1"
act "4b Youssef declines" POST /api/assignments/2/decline 200 "changed=true v=6 filled=1 in=0 out=1"
call POST /api/assignments/2/invite
check "4c re-invite of a declined worker is refused" "409 INVALID_TRANSITION Cannot invite: this worker declined this shift." \
  "$STATUS $(body 'b.error.code + " " + b.error.message')"
call GET /api/state
check "4d refusal changed nothing" "v=6 filled=1 in=0 out=1" "$(summary)"

# 5. Salma: accept, cancel, accept again (filled counts 2, 1, 2 on top of Amina's 1)
act "5a invite Salma" POST /api/assignments/3/invite 200 "changed=true v=7 filled=1 in=0 out=1"
act "5b Salma accepts (filled 2)" POST /api/assignments/3/accept 200 "changed=true v=8 filled=2 in=0 out=1"
act "5c Salma cancels (filled 1)" POST /api/assignments/3/cancel 200 "changed=true v=9 filled=1 in=0 out=1"
act "5d Salma accepts again (filled 2)" POST /api/assignments/3/accept 200 "changed=true v=10 filled=2 in=0 out=1"

# 6 (server part). Ten parallel check-ins for Salma: exactly one changes anything
i=1
while [ "$i" -le 10 ]; do
  ( curl -s --max-time 15 -X POST -o "$WORK/burst.$i" -w '%{http_code}\n' "$BASE_URL/api/assignments/3/check-in" > "$WORK/burst-status.$i" ) &
  i=$((i + 1))
done
wait
statuses=$(cat "$WORK"/burst-status.* | sort | uniq -c | tr -s ' ' | sed 's/^ //' | tr '\n' ' ' | sed 's/ $//')
changed_true=0
stamps=""
for f in "$WORK"/burst.*; do
  # A failed request leaves an empty or non-JSON file: count it as a miss instead of aborting
  # the whole run (set -e) before any result is printed.
  if [ "$(json "$f" 'b.changed' 2>/dev/null || true)" = true ]; then changed_true=$((changed_true + 1)); fi
  stamps="$stamps
$(json "$f" 'b.snapshot.assignments[2].checkedInAt' 2>/dev/null || true)"
done
distinct_stamps=$(printf '%s\n' "$stamps" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')
check "6 ten parallel check-ins: statuses" "10 200" "$statuses"
check "6 ten parallel check-ins: responses with changed:true" "1" "$changed_true"
check "6 ten parallel check-ins: distinct checkedInAt values" "1" "$distinct_stamps"
call GET /api/state
check "6 version moved once for the whole burst" "v=11 filled=2 in=1 out=1" "$(summary)"

# 7. A repeated check-in changes nothing and returns the same time
call GET /api/state
first_stamp=$(body 'b.assignments[2].checkedInAt')
call POST /api/assignments/3/check-in
check "7 repeat check-in: changed false, same checkedInAt, same version" "200 false $first_stamp 11" \
  "$STATUS $(body 'b.changed') $(body 'b.snapshot.assignments[2].checkedInAt') $(body 'b.snapshot.version')"

# 8. Check in after check-out
call POST /api/assignments/1/check-in
check "8 check-in after check-out" "409 INVALID_TRANSITION Cannot check in: this worker has already checked out." \
  "$STATUS $(body 'b.error.code + " " + b.error.message')"

# 9. Bad ids never reach the database and never give a 500
call POST /api/assignments/abc/invite
check "9a id abc" "400" "$STATUS"
call POST /api/assignments/-1/invite
check "9b id -1" "400" "$STATUS"
call POST /api/assignments/999999/invite
check "9c id 999999" "404" "$STATUS"
call POST "/api/assignments/1;%20DROP%20TABLE%20workers/invite"
check "9d id with SQL text" "400" "$STATUS"
call GET /api/state
check "9e tables are intact after the SQL text" "200 3" "$STATUS $(body 'b.assignments.length')"

# 13. Two reads with no change in between are identical, apart from the server clock
call GET /api/state; cp "$WORK/body" "$WORK/state1"
call GET /api/state; cp "$WORK/body" "$WORK/state2"
strip='(() => { const { serverTime, ...rest } = b; return JSON.stringify(rest); })()'
if [ "$(json "$WORK/state1" "$strip")" = "$(json "$WORK/state2" "$strip")" ]; then same=identical; else same=different; fi
check "13 two reads are equal apart from serverTime" "identical" "$same"

# 15. Headers
headers=$(curl -sI --max-time 15 "$BASE_URL/api/state" | tr -d '\r')
header() { printf '%s\n' "$headers" | grep -i "^$1:" | head -n 1 | sed 's/^[^:]*: *//'; }
check "15a Cache-Control" "no-store" "$(header cache-control)"
check "15b X-Content-Type-Options" "nosniff" "$(header x-content-type-options)"
request_id=$(header x-request-id)
if [ -n "$request_id" ]; then request_id=present; fi
check "15c X-Request-Id" "present" "${request_id:-missing}"
csp=$(header content-security-policy)
case "$csp" in *"default-src 'self'"*) csp=present ;; *) csp=${csp:-missing} ;; esac
check "15d Content-Security-Policy" "present" "$csp"
call GET /api/health
check "15e health" "200 ok" "$STATUS $(body 'b.status')"

# 12. Database outage (optional): the server must stay up and recover by itself
if [ -n "$DB_OUTAGE" ]; then
  echo
  echo "Stopping the db container for the outage check..."
  OUTAGE_STARTED=1
  docker compose stop db >/dev/null 2>&1
  sleep 3 # long enough for idle pooled connections to report the loss
  call GET /api/health
  check "12a health while the database is down" "503 degraded down" "$STATUS $(body 'b.status + " " + b.db' 2>/dev/null || echo '-')"
  call POST /api/assignments/1/check-in
  check "12b action while the database is down" "500 INTERNAL" "$STATUS $(body 'b.error.code' 2>/dev/null || echo '-')"
  check "12c message says nothing was saved" "true" "$(body 'b.error.message.includes("Nothing was saved")' 2>/dev/null || echo false)"
  call GET /api/health
  check "12d server process still answers" "503" "$STATUS"
  docker compose start db >/dev/null 2>&1
  OUTAGE_STARTED=
  if wait_for_health 30; then recovered="200 within 30 s"; else recovered="no 200 within 30 s"; fi
  check "12e health after the database returns" "200 within 30 s" "$recovered"
  call GET /api/state
  check "12f state readable again after recovery" "200" "$STATUS"
fi

# ---------- summary ----------
echo
echo "Results for docs/qa.md (case, expected, actual, pass):"
echo "| Case | Expected | Actual | Pass |"
echo "|---|---|---|---|"
cat "$RESULTS"
echo
if [ "$FAILURES" -eq 0 ]; then
  echo "All checks passed."
else
  echo "$FAILURES check(s) FAILED."
  exit 1
fi
