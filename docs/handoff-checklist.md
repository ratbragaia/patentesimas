# Handoff checklist (founder → agent)

Only items requiring identity, card or legal signature. Status is updated by the agent when the item arrives.

| # | Item | Where it goes | Status |
|---|---|---|---|
| 1 | CNPJ opened (ME/EPP, Simples Nacional) + accountant's fiscal parameters for service export (NFS-e service code, ISS treatment, CNAE) | `docs/decisions/0002-fiscal-parameters.md` | ⬜ |
| 2 | Hostinger VPS (KVM 2, Ubuntu 24.04): IP + SSH public key installed for root | run `infra/vps/setup.sh` | ⬜ |
| 3 | Domain purchased (rarefree.com or fallback) + DNS access | `infra/dns-records.md` | ⬜ |
| 4 | GitHub organisation + this repo transferred/mirrored; deploy key on VPS | `infra/vps/setup.sh` REPO_URL | ⬜ |
| 5 | Claude Code credentials on the VPS (Pro now; enable extra usage) | `/etc/rarefree/env` | ⬜ |
| 6 | Supabase project (dedicated): URL, service role key, DB connection string | `SUPABASE_*` | ⬜ |
| 7 | PatentsView API key (free, form on search.patentsview.org) | `PATENTSVIEW_API_KEY` | ⬜ |
| 8 | EPO OPS consumer key/secret (free registration, developer portal) | `EPO_OPS_*` | ⬜ |
| 9 | GCP project with BigQuery enabled + service-account JSON | `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | ⬜ |
| 10 | Paddle seller account (verify Brazil eligibility first — see research 04) + webhook secret | `PADDLE_*` | ⬜ |
| 11 | USD receiving account (Wise Business or alternative per research 04) | Paddle payout settings | ⬜ |
| 12 | NFe.io account + company registered | `NFEIO_*` | ⬜ |
| 13 | Postmark server token, verified sender domain (DKIM/Return-Path) | `POSTMARK_*` | ⬜ |
| 14 | Outreach mailbox on a separate domain (see research 04) | `OUTREACH_FROM` | ⬜ |
| 15 | Telegram bot token + founder chat id | `TELEGRAM_*` | ⬜ |
| 16 | Lawyer review of `legal/` drafts | `legal/REVIEW_STATUS.md` | ⬜ |
| 17 | Company postal address for email footers | `COMPANY_POSTAL_ADDRESS` | ⬜ |

## First-run sequence once items arrive
1. `bash infra/vps/setup.sh` on the VPS; fill `/etc/rarefree/env`.
2. `psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql` then `-f supabase/migrations/0002_seed_plans.sql`.
3. `npm run ingest` for a 90-day backfill (set `from` manually once), triage, build issue #1, QA.
4. Point DNS, verify Postmark DKIM, send issue #1 to the founder's test address.
5. Start the Thursday prospecting cycle.
