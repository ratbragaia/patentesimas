# DNS records (main domain: patentsonar.com, registered at Cloudflare 2026-09-25)

In Cloudflare keep the A records **DNS only (grey cloud)**: Caddy on the VPS issues the Let's Encrypt
certificate itself. Turning the orange proxy on later is fine once SSL mode is "Full (strict)".

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | @ | `<VPS IP>` | site + webhooks (Caddy) |
| A | www | `<VPS IP>` | |
| TXT | @ | `v=spf1 include:_spf.mx.cloudflare.net include:spf.mtasv.net ~all` | SPF: Cloudflare Email Routing (forwarding) + Postmark. One TXT only; merge, never two SPF records |
| CNAME | `<postmark-dkim-selector>._domainkey` | value from Postmark "Sender Signatures → DKIM" | DKIM |
| CNAME | pm-bounces | `pm.mtasv.net` | Postmark custom return-path |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:dmarc@patentsonar.com; fo=1` | DMARC (start `p=none` for 2 weeks, then quarantine) |
| MX | @ | `route1.mx.cloudflare.net` (27), `route2.mx.cloudflare.net` (91), `route3.mx.cloudflare.net` (2) | Cloudflare Email Routing (free): `founder@patentsonar.com` → founder's mailbox. Added 2026-09-26 |
| TXT | `cf2024-1._domainkey` | value set by Cloudflare Email Routing | DKIM for Cloudflare forwarding (separate from Postmark's selector) |

Inbound today: Cloudflare Email Routing forwards `founder@patentsonar.com` to the founder (used for vendor
sign-ups that reject public-domain addresses: Postmark, Paddle, NFe.io, Wise). Replies to outreach land in the
outreach mailbox, not here.

Outreach uses a **separate domain** (e.g. `patentsonar-intel.com`) with its own SPF/DKIM/DMARC and a
mailbox provider that permits B2B outreach; see `docs/research/04-compliance-and-payments.md`.
