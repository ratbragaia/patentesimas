# DNS records (main domain: patentsonar.com, registered at Cloudflare 2026-09-25)

In Cloudflare keep the A records **DNS only (grey cloud)**: Caddy on the VPS issues the Let's Encrypt
certificate itself. Turning the orange proxy on later is fine once SSL mode is "Full (strict)".

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | @ | `<VPS IP>` | site + webhooks (Caddy) |
| A | www | `<VPS IP>` | |
| TXT | @ | `v=spf1 include:_spf.mx.cloudflare.net ~all` | SPF for Cloudflare forwarding. Postmark needs no SPF entry (custom Return-Path covers it, confirmed in its DNS panel) |
| TXT | `20260926021414pm._domainkey` | `k=rsa;p=MIGf...` (value from Postmark → Sender Signatures → patentsonar.com) | Postmark DKIM. Verified 2026-09-26 |
| CNAME | pm-bounces | `pm.mtasv.net` | Postmark custom return-path. Verified 2026-09-26 |
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@patentsonar.com; fo=1` | DMARC. Added 2026-09-26 via API (`ops.sh dns-dmarc`, token "ClaudePatentSonar": zone DNS Edit + Email Routing Rules Edit, account Workers Scripts Edit, IP-locked to the VPS). Move to `p=quarantine` after 2 clean weeks (≈ 2026-10-10). Reports land in the catch-all → founder |
| MX | @ | `route1.mx.cloudflare.net` (27), `route2.mx.cloudflare.net` (91), `route3.mx.cloudflare.net` (2) | Cloudflare Email Routing (free): `founder@patentsonar.com` → founder's mailbox. Added 2026-09-26 |
| TXT | `cf2024-1._domainkey` | value set by Cloudflare Email Routing | DKIM for Cloudflare forwarding (separate from Postmark's selector) |

Inbound today: `support@patentsonar.com` → Email Worker `patentsonar-inbound-email` → VPS webhook (ADR 0012);
Cloudflare Email Routing forwards `founder@patentsonar.com` (and the catch-all) to the founder (used for vendor
sign-ups that reject public-domain addresses: Postmark, Paddle, NFe.io, Wise). Replies to outreach land in the
outreach mailbox, not here.

Outreach uses a **separate domain** (e.g. `patentsonar-intel.com`) with its own SPF/DKIM/DMARC and a
mailbox provider that permits B2B outreach; see `docs/research/04-compliance-and-payments.md`.
