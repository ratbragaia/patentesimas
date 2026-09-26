#!/usr/bin/env bash
# Apply all Supabase migrations in order, then restart the webhook server.
# Reads SUPABASE_DB_URL from /etc/patentsonar/env without executing the file (safe with any password).
# Usage (on the VPS): bash /opt/patentsonar/infra/vps/apply-migrations.sh
set -euo pipefail
export PGOPTIONS="-c client_min_messages=warning"
ENV_FILE=/etc/patentsonar/env
APP_DIR=/opt/patentsonar
DB="$(grep -E '^SUPABASE_DB_URL=' "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']$//")"
if [ -z "$DB" ]; then echo "SUPABASE_DB_URL not set in $ENV_FILE"; exit 1; fi
case "$DB" in *'[YOUR-PASSWORD]'*) echo "SUPABASE_DB_URL still contains [YOUR-PASSWORD]"; exit 1;; esac
echo "== connection test"
psql "$DB" -X -q -c "select current_database(), version();" -t | head -1
echo "== migrations"
for f in "$APP_DIR"/supabase/migrations/*.sql; do
  if psql "$DB" -X -q -v ON_ERROR_STOP=1 -f "$f"; then echo "ok $(basename "$f")"; else echo "FAILED $(basename "$f") — stopping"; exit 1; fi
done
echo "== tables in schema ps"
psql "$DB" -X -q -t -c "select count(*) from information_schema.tables where table_schema='ps';" | tr -d ' '
systemctl restart patentsonar-webhooks && echo "webhooks restarted"
