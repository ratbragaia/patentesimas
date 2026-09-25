# DNS records (main domain: patentsonar.com — verify availability at purchase; fallbacks .io / .ai)

| Type | Host | Value | Purpose |
|---|---|---|---|
| A | @ | `<VPS IP>` | site + webhooks (Caddy) |
| A | www | `<VPS IP>` | |
| TXT | @ | `v=spf1 include:spf.mtasv.net -all` | Postmark SPF (bounce domain) |
| CNAME | `<postmark-dkim-selector>._domainkey` | value from Postmark "Sender Signatures → DKIM" | DKIM |
| CNAME | pm-bounces | `pm.mtasv.net` | Postmark custom return-path |
| TXT | _dmarc | `v=DMARC1; p=quarantine; rua=mailto:dmarc@patentsonar.com; fo=1` | DMARC (start `p=none` for 2 weeks, then quarantine) |
| MX | @ | provider of the inbox that receives replies (Google Workspace / Fastmail) | inbound mail |

Outreach uses a **separate domain** (e.g. `patentsonar-intel.com`) with its own SPF/DKIM/DMARC and a
mailbox provider that permits B2B outreach; see `docs/research/04-compliance-and-payments.md`.
