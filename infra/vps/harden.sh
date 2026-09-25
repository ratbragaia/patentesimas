#!/usr/bin/env bash
# Basic hardening: SSH keys only, firewall, fail2ban, automatic security updates.
set -euo pipefail
echo "== sshd"
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/; s/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/; s/^#\?X11Forwarding.*/X11Forwarding no/' /etc/ssh/sshd_config
systemctl reload ssh || systemctl reload sshd
echo "== ufw"
ufw default deny incoming; ufw default allow outgoing
ufw allow OpenSSH; ufw allow 80/tcp; ufw allow 443/tcp
ufw --force enable
echo "== fail2ban"
cat > /etc/fail2ban/jail.d/sshd.local <<'J'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
J
systemctl enable --now fail2ban && systemctl restart fail2ban
echo "== unattended upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades
echo "== hardening done"
