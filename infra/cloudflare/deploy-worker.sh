#!/usr/bin/env bash
# Deploy the inbound Email Worker to Cloudflare with the API token in /etc/patentsonar/env.
# Idempotent: re-running uploads the current script and refreshes the secret binding.
set -euo pipefail
# curl -4: the API token is IP-filtered to the VPS IPv4; over IPv6 Cloudflare answers 9109 "Cannot use the access token from location".
ENV_FILE=/etc/patentsonar/env
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2-; }
CF="$(val CLOUDFLARE_API_TOKEN)"; ACC="$(val CLOUDFLARE_ACCOUNT_ID)"; SECRET="$(val INBOUND_WEBHOOK_SECRET)"
SITE="$(val PUBLIC_SITE_URL)"; NAME=patentsonar-inbound-email
[ -n "$CF" ] && [ -n "$ACC" ] && [ -n "$SECRET" ] || { echo "missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / INBOUND_WEBHOOK_SECRET"; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"
META=$(printf '{"main_module":"worker.js","compatibility_date":"2026-09-01","bindings":[{"type":"plain_text","name":"WEBHOOK_URL","text":"%s/webhooks/inbound"},{"type":"secret_text","name":"INBOUND_WEBHOOK_SECRET","text":"%s"}]}' "${SITE:-https://patentsonar.com}" "$SECRET")
curl -4 -sS --max-time 60 -X PUT "https://api.cloudflare.com/client/v4/accounts/$ACC/workers/scripts/$NAME" \
  -H "Authorization: Bearer $CF" \
  --form-string "metadata=$META" \
  -F "worker.js=@$DIR/inbound-email-worker.js;filename=worker.js;type=application/javascript+module" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print("deployed" if d.get("success") else d.get("errors"))'
