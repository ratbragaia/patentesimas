#!/usr/bin/env bash
# SSH to the company VPS from a claude.ai cloud session.
# Needs VPS_SSH_PRIVATE_KEY (environment variable of the "PatentSonar" cloud environment) and the
# hosts patentsonar.com / srv2010436.hstgr.cloud in that environment's allowed domains.
# Usage: bash infra/vps/agent-ssh.sh "<remote command>"      (no command = interactive test)
set -euo pipefail
HOST="${VPS_HOST:-srv2010436.hstgr.cloud}"
USER_="${VPS_USER:-root}"
KEY="$HOME/.ssh/patentsonar_agent"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ ! -f "$KEY" ]; then
  [ -n "${VPS_SSH_PRIVATE_KEY:-}" ] || { echo "VPS_SSH_PRIVATE_KEY is not set in this environment"; exit 2; }
  printf '%s\n' "$VPS_SSH_PRIVATE_KEY" > "$KEY"; chmod 600 "$KEY"
fi
# Route through the session's HTTPS proxy (HTTP CONNECT) when one is configured; direct otherwise.
PROXY_OPT=()
if [ -n "${HTTPS_PROXY:-}" ]; then
  PH="${HTTPS_PROXY#http://}"; PH="${PH#https://}"; PH="${PH%%/*}"
  cat > "$HOME/.ssh/connect-proxy.py" <<'PY'
import socket, sys, select
ph, pp, h, p = sys.argv[1], int(sys.argv[2]), sys.argv[3], int(sys.argv[4])
s = socket.create_connection((ph, pp))
s.sendall(f"CONNECT {h}:{p} HTTP/1.1\r\nHost: {h}:{p}\r\n\r\n".encode())
buf = b""
while b"\r\n\r\n" not in buf:
    c = s.recv(4096)
    if not c: sys.stderr.write("proxy closed\n"); sys.exit(1)
    buf += c
head, rest = buf.split(b"\r\n\r\n", 1)
if b" 200" not in head.split(b"\r\n")[0]:
    sys.stderr.write("proxy refused CONNECT: " + head.split(b"\r\n")[0].decode() + "\n"); sys.exit(1)
if rest: sys.stdout.buffer.write(rest); sys.stdout.buffer.flush()
si = sys.stdin.buffer; so = sys.stdout.buffer
while True:
    r, _, _ = select.select([s, si], [], [])
    if s in r:
        d = s.recv(65536)
        if not d: break
        so.write(d); so.flush()
    if si in r:
        d = si.read1(65536) if hasattr(si, "read1") else si.read(65536)
        if not d: break
        s.sendall(d)
PY
  PROXY_OPT=(-o "ProxyCommand=python3 $HOME/.ssh/connect-proxy.py ${PH%%:*} ${PH##*:} %h %p")
fi
exec ssh -i "$KEY" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o ConnectTimeout=20 "${PROXY_OPT[@]}" "$USER_@$HOST" "$@"
