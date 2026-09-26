#!/usr/bin/env bash
# Prints the agent's GitHub deploy key (creating it on first run) and switches the repo remote to
# SSH so the agent on the VPS can push docs/decisions and code. The founder adds the printed public
# key once at: GitHub repo -> Settings -> Deploy keys -> Add deploy key -> tick "Allow write access".
set -euo pipefail
KEY="$HOME/.ssh/id_ed25519"
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
[ -f "$KEY" ] || ssh-keygen -t ed25519 -N "" -C "patentsonar-vps-deploy" -f "$KEY" >/dev/null
grep -q github.com "$HOME/.ssh/known_hosts" 2>/dev/null || ssh-keyscan -t ed25519 github.com >> "$HOME/.ssh/known_hosts" 2>/dev/null
cd /opt/patentsonar
git config user.name "PatentSonar Agent (VPS)"; git config user.email "agent@patentsonar.com"
git remote set-url origin git@github.com:ratbragaia/patentesimas.git
echo "== Add this deploy key to GitHub (Settings -> Deploy keys, allow write access):"
cat "$KEY.pub"
echo "== Then test with: ssh -T git@github.com  (expect: 'Hi ratbragaia/patentesimas! ... successfully authenticated')"
