#!/usr/bin/env bash
# Create or update one DNS record in the patentsonar.com zone through the Cloudflare API (token from /etc/patentsonar/env).
# Idempotent: finds an existing record by type+name and updates it, else creates it. Prints what it did.
# Usage: bash infra/cloudflare/dns-upsert.sh <TYPE> <NAME> <CONTENT> [TTL=1] [PROXIED=false]
set -euo pipefail
# curl -4: the API token is IP-filtered to the VPS IPv4; over IPv6 Cloudflare answers 9109 "Cannot use the access token from location".
ENV_FILE=/etc/patentsonar/env
val() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']$//"; }
CF="$(val CLOUDFLARE_API_TOKEN)"; ZONE="$(val CLOUDFLARE_ZONE_ID)"
TYPE="${1:?type}"; NAME="${2:?name}"; CONTENT="${3:?content}"; TTL="${4:-1}"; PROXIED="${5:-false}"
[ -n "$CF" ] && [ -n "$ZONE" ] || { echo "missing CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID"; exit 1; }
API="https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records"
BODY=$(python3 -c 'import json,sys; print(json.dumps({"type":sys.argv[1],"name":sys.argv[2],"content":sys.argv[3],"ttl":int(sys.argv[4]),"proxied":sys.argv[5]=="true"}))' "$TYPE" "$NAME" "$CONTENT" "$TTL" "$PROXIED")
FQDN="$NAME"; case "$NAME" in *.*) ;; *) FQDN="$NAME.patentsonar.com";; esac; [ "$NAME" = "@" ] && FQDN="patentsonar.com"
EXISTING=$(curl -4 -sS --max-time 30 "$API?type=$TYPE&name=$FQDN" -H "Authorization: Bearer $CF")
ID=$(printf '%s' "$EXISTING" | python3 -c 'import sys,json
d=json.load(sys.stdin)
if not d.get("success"): print("ERROR:"+json.dumps(d.get("errors"))); sys.exit(0)
r=d.get("result") or []; print(r[0]["id"] if r else "")')
case "$ID" in ERROR:*) echo "lookup failed: ${ID#ERROR:}"; exit 2;; esac
if [ -n "$ID" ]; then
  RES=$(curl -4 -sS --max-time 30 -X PUT "$API/$ID" -H "Authorization: Bearer $CF" -H "Content-Type: application/json" --data "$BODY"); ACTION=updated
else
  RES=$(curl -4 -sS --max-time 30 -X POST "$API" -H "Authorization: Bearer $CF" -H "Content-Type: application/json" --data "$BODY"); ACTION=created
fi
printf '%s' "$RES" | python3 -c 'import sys,json
d=json.load(sys.stdin); a=sys.argv[1]
if d.get("success"): r=d["result"]; print("%s %s %s -> %s" % (a, r["type"], r["name"], r["content"]))
else: print("failed:", json.dumps(d.get("errors"))); sys.exit(3)' "$ACTION"
