#!/usr/bin/env bash
# Call the VPS ops endpoint over HTTPS from a claude.ai cloud session (environment "PatentSonar").
# Needs OPS_TOKEN in the cloud environment variables (same value as OPS_TOKEN in /etc/patentsonar/env).
# Usage: bash infra/vps/ops.sh <job> [args...]
#   jobs: status | logs <unit> [n] | env-keys | git-pull | npm-ci | test | migrate | caddy-sync | site-check | restart [unit] | cli <subcommand...> | sql-count
set -euo pipefail
[ -n "${OPS_TOKEN:-}" ] || { echo "OPS_TOKEN not set in this environment"; exit 2; }
JOB="${1:?job}"; shift || true
ARGS=$(python3 -c 'import json,sys; print(json.dumps(sys.argv[1:]))' "$@")
curl -sS --max-time 1900 -X POST "https://${OPS_HOST:-patentsonar.com}/ops/run" \
  -H "Authorization: Bearer $OPS_TOKEN" -H "Content-Type: application/json" \
  -d "{\"job\":\"$JOB\",\"args\":$ARGS}" | python3 -c '
import json,sys
r=json.load(sys.stdin)
print("== %s ok=%s code=%s %sms" % (r["job"], r["ok"], r["code"], r["ms"]))
if r["stdout"].strip(): print(r["stdout"].rstrip())
if r["stderr"].strip(): print("-- stderr --"); print(r["stderr"].rstrip())
sys.exit(0 if r["ok"] else 1)'
