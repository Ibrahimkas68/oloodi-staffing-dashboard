#!/bin/sh
# One-time setup of a fresh Ubuntu server (22.04 or 24.04). Run as root:
#   sudo sh infra/scripts/server-init.sh
# It is safe to run again: every step checks the current state first.
#
# What it does:
#   1. Installs Docker Engine and the Compose plugin from Docker's official apt repository.
#   2. Creates a non-root user (default "deploy") that may run docker, with no password login.
#   3. Turns on the UFW firewall allowing only SSH (22), HTTP (80) and HTTPS (443).
#
# Optional variables: DEPLOY_USER (default deploy), DEPLOY_SSH_KEY (public key to authorize).
set -eu

DEPLOY_USER="${DEPLOY_USER:-deploy}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'error: %s\n' "$*" >&2; exit 1; }

require_root_on_ubuntu() {
  [ "$(id -u)" -eq 0 ] || die 'run this script as root (use sudo)'
  [ -r /etc/os-release ] || die 'cannot detect the operating system'
  . /etc/os-release
  [ "${ID:-}" = ubuntu ] || die "this script supports Ubuntu only (found: ${ID:-unknown})"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    # The production Compose file needs 2.24 or newer (the !reset tag).
    version="$(docker compose version --short | sed 's/^v//')"
    major="${version%%.*}"; rest="${version#*.}"; minor="${rest%%.*}"
    if [ "$major" -gt 2 ] || { [ "$major" -eq 2 ] && [ "$minor" -ge 24 ]; }; then
      log "Docker and Compose $version are already installed"
      return
    fi
    log "Compose $version is older than 2.24, upgrading"
  fi
  log 'Installing Docker Engine and the Compose plugin'
  apt-get update -y
  apt-get install -y ca-certificates curl
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
}

create_deploy_user() {
  if id "$DEPLOY_USER" >/dev/null 2>&1; then
    log "User $DEPLOY_USER already exists"
  else
    log "Creating user $DEPLOY_USER"
    adduser --disabled-password --gecos '' "$DEPLOY_USER"
  fi
  # Members of the docker group can control Docker, which is effectively root on this machine.
  usermod -aG docker "$DEPLOY_USER"

  if [ -n "$DEPLOY_SSH_KEY" ]; then
    log "Authorizing the given SSH key for $DEPLOY_USER"
    ssh_dir="/home/$DEPLOY_USER/.ssh"
    install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$ssh_dir"
    touch "$ssh_dir/authorized_keys"
    if ! grep -qxF "$DEPLOY_SSH_KEY" "$ssh_dir/authorized_keys"; then
      # Start on a new line even if the file did not end with one.
      [ ! -s "$ssh_dir/authorized_keys" ] || [ -z "$(tail -c1 "$ssh_dir/authorized_keys")" ] || echo >> "$ssh_dir/authorized_keys"
      echo "$DEPLOY_SSH_KEY" >> "$ssh_dir/authorized_keys"
    fi
    chown "$DEPLOY_USER:$DEPLOY_USER" "$ssh_dir/authorized_keys"
    chmod 600 "$ssh_dir/authorized_keys"
  fi
}

configure_firewall() {
  log 'Configuring the UFW firewall (SSH, 80 and 443 only)'
  apt-get install -y ufw
  # Allow the port sshd really listens on (22 unless it was changed), or enabling UFW locks you out.
  ssh_port="$(sshd -T 2>/dev/null | awk '$1 == "port" { print $2; exit }')"
  ssh_port="${ssh_port:-22}"
  ufw default deny incoming
  ufw default allow outgoing
  ufw allow "$ssh_port"/tcp
  ufw allow 80/tcp
  ufw allow 443/tcp
  # Allow SSH above before enabling, or this would lock you out of the server.
  ufw --force enable
}

require_root_on_ubuntu
install_docker
create_deploy_user
configure_firewall

[ -n "$DEPLOY_SSH_KEY" ] || log "No DEPLOY_SSH_KEY given: $DEPLOY_USER has no login key. Use 'su - $DEPLOY_USER' from root, or add a key to /home/$DEPLOY_USER/.ssh/authorized_keys."
log 'Done. Next: become the deploy user, clone the repository, create .env, then run infra/scripts/deploy.sh'
