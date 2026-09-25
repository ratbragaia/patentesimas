#!/usr/bin/env bash
# PatentSonar — VPS bootstrap (Hostinger KVM 2, Ubuntu 24.04 LTS). Run once as root.
# Usage: ssh root@<ip> 'bash -s' < infra/vps/setup.sh
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive

APP_USER=patentsonar
APP_DIR=/opt/patentsonar
REPO_URL="${REPO_URL:-https://github.com/ratbragaia/patentesimas.git}"
BRANCH="${BRANCH:-main}"

echo "== packages"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl git ufw fail2ban unattended-upgrades jq postgresql-client caddy || true

echo "== node 22 (NodeSource)"
if ! command -v node >/dev/null || [[ "$(node -v)" != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "== caddy (official repo if apt lacked it)"
if ! command -v caddy >/dev/null; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y && apt-get install -y caddy
fi

echo "== google cloud cli (bq) for BigQuery exports"
if ! command -v bq >/dev/null; then
  curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" > /etc/apt/sources.list.d/google-cloud-sdk.list
  apt-get update -y && apt-get install -y google-cloud-cli
fi

echo "== app user + dirs"
id -u $APP_USER >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash $APP_USER
mkdir -p $APP_DIR /etc/patentsonar /var/log/patentsonar
chown -R $APP_USER:$APP_USER $APP_DIR /var/log/patentsonar
chmod 750 /etc/patentsonar

echo "== clone / update repo"
if [ ! -d $APP_DIR/.git ]; then sudo -u $APP_USER git clone --branch "$BRANCH" "$REPO_URL" $APP_DIR; fi
cd $APP_DIR && sudo -u $APP_USER git pull --ff-only && sudo -u $APP_USER npm ci --omit=dev --no-audit --no-fund && sudo -u $APP_USER npm install --no-save tsx >/dev/null

echo "== env file (fill in from the handoff package)"
[ -f /etc/patentsonar/env ] || { cp $APP_DIR/.env.example /etc/patentsonar/env; chown root:$APP_USER /etc/patentsonar/env; chmod 640 /etc/patentsonar/env; }

echo "== claude code (agent runtime)"
sudo -u $APP_USER npm install -g @anthropic-ai/claude-code 2>/dev/null || npm install -g @anthropic-ai/claude-code

echo "== systemd units"
cp $APP_DIR/infra/systemd/patentsonar-*.service $APP_DIR/infra/systemd/patentsonar-*.timer /etc/systemd/system/
mkdir -p /etc/systemd/system/caddy.service.d
cp $APP_DIR/infra/systemd/caddy-override.conf /etc/systemd/system/caddy.service.d/override.conf
systemctl daemon-reload
systemctl enable --now patentsonar-webhooks.service
for t in patentsonar-ingest patentsonar-newsletter-build patentsonar-newsletter-send patentsonar-invoices patentsonar-report; do systemctl enable --now $t.timer; done

echo "== caddy reverse proxy"
cp $APP_DIR/infra/Caddyfile /etc/caddy/Caddyfile
if caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile >/dev/null 2>&1; then
  systemctl restart caddy || echo "WARN: caddy failed to start; check: journalctl -xeu caddy"
else
  echo "WARN: Caddyfile invalid; site not served. Run: caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile"
fi

bash $APP_DIR/infra/vps/harden.sh
echo "== status"
systemctl is-active caddy patentsonar-webhooks || true
systemctl list-timers 'patentsonar-*' --no-pager || true
echo "== done. Fill /etc/patentsonar/env, then: systemctl restart patentsonar-webhooks && systemctl list-timers 'patentsonar-*'"
