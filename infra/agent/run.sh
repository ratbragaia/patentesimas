#!/usr/bin/env bash
# Headless operator run (ADR 0012). Started by patentsonar-agent.timer several times a day.
# One run = one Claude Code session in --print mode that drains the task queue and exits.
# Guards: single instance (flock), fresh checkout (git pull --ff-only), turn cap, wall-clock cap, log per run.
set -uo pipefail
APP=/opt/patentsonar
LOG_DIR=/var/log/patentsonar/agent; mkdir -p "$LOG_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"; LOG="$LOG_DIR/run-$STAMP.log"
exec 9>/run/lock/patentsonar-agent.lock 2>/dev/null || exec 9>/tmp/patentsonar-agent.lock
if ! flock -n 9; then echo "another run is active; skipping" | tee -a "$LOG"; exit 0; fi
cd "$APP" || exit 1
export HOME=/home/patentsonar
git pull --ff-only >>"$LOG" 2>&1 || echo "git pull failed (continuing on current checkout)" >>"$LOG"
MAX_TURNS="${AGENT_MAX_TURNS:-60}"; TIMEOUT="${AGENT_TIMEOUT:-40m}"
echo "== run $STAMP (max_turns=$MAX_TURNS timeout=$TIMEOUT)" >>"$LOG"
timeout --kill-after=60s "$TIMEOUT" claude -p "$(cat "$APP/infra/agent/prompt.md")" \
  --dangerously-skip-permissions --max-turns "$MAX_TURNS" --output-format json \
  >>"$LOG" 2>&1
RC=$?
echo "== exit $RC" >>"$LOG"
# Keep 60 days of run logs.
find "$LOG_DIR" -name 'run-*.log' -mtime +60 -delete 2>/dev/null
if [ $RC -ne 0 ]; then
  # 124 = timeout. Tell the founder only for real failures, not for a clean "nothing to do".
  cd "$APP" && npx tsx -e "import('./src/reporting/telegram.js').then(m=>m.notifyFounder('PatentSonar agent run $STAMP exited with code $RC (see $LOG)'))" >>"$LOG" 2>&1 || true
fi
exit 0
