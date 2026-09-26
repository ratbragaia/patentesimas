# Handoff checklist (founder → agent)

Only items requiring identity, card or legal signature. Status is updated by the agent when the item arrives.

| # | Item | Where it goes | Status |
|---|---|---|---|
| 1 | CNPJ opened (Ltda, **Lucro Presumido**) + accountant's fiscal parameters for service export (NFS-e service code, ISS treatment, CNAE) | `docs/decisions/0002-fiscal-parameters.md` | ✅ 2026-09-26: CNPJ 40.435.866/0001-40, Ltda, Lucro Presumido, CNAE 63.19-4-00; fiscal parameters decided by the agent at the founder's request (ADR 0002, research 05). Municipal service code read from NFe.io at item 12 |
| 2 | Hostinger VPS (dedicated, Ubuntu 24.04): **IP 2.25.249.69**, keys `founder-notebook` + `patentsonar-agent` installed. Agent private key still to be added as environment secret `VPS_SSH_PRIVATE_KEY` | `infra/vps/setup.sh` (ADR 0007) | ✅ bootstrapped + hardened 2026-09-25; both keys verified. `/etc/patentsonar/env` installed 2026-09-26. Pending: agent key as env secret (only needed for cloud sessions) |
| 3 | Domain **patentsonar.com** bought at Cloudflare Registrar 2026-09-25 (+ .io/.ai/.co optional). DNS: A @ and A www → 2.25.249.69, DNS-only | `infra/dns-records.md` | ✅ bought, DNS pointed, env installed 2026-09-26 |
| 4 | GitHub deploy key for the VPS agent: add the key printed by `infra/vps/github-deploy-key.sh` at repo → Settings → Deploy keys, **Allow write access** | `infra/vps/github-deploy-key.sh` | ✅ 2026-09-26 (`ssh -T git@github.com` authenticates; pushes from the VPS work) |
| 5 | Claude Code logged in on the VPS as user `patentsonar`. Account is on the **Max** plan (briefing assumed Pro), so 24/7 operation has far more headroom | VPS | ✅ 2026-09-26 |
| 6 | Supabase project `patentsonar-prod` (us-east-1): URL, secret key, DB URL in `/etc/patentsonar/env`; schema applied | `SUPABASE_*` | ✅ 2026-09-26 |
| 7 | ~~PatentsView API key~~ **Deferred** (portal offline; ODP key needs ID.me, see ADR 0008). US coverage via EPO OPS + BigQuery | `PATENTSVIEW_API_KEY` | ⏸ deferred |
| 8 | EPO OPS consumer key/secret (register at developers.epo.org → My Apps; free tier ~4 GB/week) — **primary data source** | `EPO_OPS_*` | ⬜ |
| 9 | GCP project with BigQuery enabled + service-account JSON (**priority raised**, ADR 0008; free tier is enough, card required by Google) | `GCP_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` | ✅ 2026-09-26: project `patentsonar-prod`, SA `patentsonar-bq` (BigQuery Job User), key `600`; first 90-day backfill loaded (ADR 0009) |
| 10 | Paddle seller account (verify Brazil eligibility first — see research 04) + webhook secret | `PADDLE_*` | ✅ 2026-09-26: live API key + webhook secret stored, `PADDLE_ENVIRONMENT=production`; signature/replay/stale tests pass; notification destination active (9 events). Sandbox catalog created 2026-09-26 (3 products, 5 prices; ids in `ps.plans.paddle_price_id_*_sandbox`); live catalog still empty |
| 11 | USD receiving account (Wise Business or alternative per research 04) | Paddle payout settings | ⬜ |
| 12 | ~~NFe.io~~ **Notaas** account + e-CNPJ A1 certificate (research 06) | `NOTAAS_API_KEY` | ✅ 2026-09-26: founder already issues NFS-e on Notaas in **production** for this CNPJ; A1 uploaded; key on the VPS. Payload validation by `cli invoices preview` only (no test note in production); first real note = first Paddle payout |
| 13 | Postmark server token, verified sender domain (DKIM/Return-Path) | `POSTMARK_*` | ✅ 2026-09-26: server `PatentSonar` (Free), domain verified, test email delivered, bounce/complaint webhooks registered. DMARC `p=none` added 2026-09-26 |
| 14 | Outreach mailbox on a separate domain (ADR 0003: buy `patentsonar.org` + one Hostinger Business Email mailbox, e.g. `analyst@patentsonar.org`; paste address + password into the VPS) | `OUTREACH_FROM`, `OUTREACH_SMTP_USER`, `OUTREACH_SMTP_PASS` (hosts default to Hostinger) | ⬜ mailer code deployed 2026-09-26; waits only for the mailbox |
| 15 | Telegram bot token + founder chat id | `TELEGRAM_*` | ✅ 2026-09-26 (bot `@patentsonar_bot`; chat id stored; test weekly report delivered) |
| 16 | Lawyer review of `legal/` drafts + quick trademark clearance of "PatentSonar" (USPTO, EUIPO, INPI) | `legal/REVIEW_STATUS.md` | ✅ 2026-09-26: legal templates v1.0 reviewed by the agent at the founder's direction and published (ADR 0014); trademark search running on the VPS (task, output `docs/research/07-trademark-clearance.md`). Founder later: INPI filing needs gov.br login + GRU payment |
| 17 | Company postal address for email footers | `COMPANY_POSTAL_ADDRESS` | ✅ 2026-09-26: Rockfort Hub de Inovação Ltda, Av. Tiradentes 209, Centro, São João del Rei/MG, 36307-346 (`src/lib/company.ts`) |

## First-run sequence once items arrive
1. `bash infra/vps/setup.sh` on the VPS; fill `/etc/patentsonar/env`.
2. `psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql` then `-f supabase/migrations/0002_seed_plans.sql`.
3. `npm run ingest` for a 90-day backfill (set `from` manually once), triage, build issue #1, QA.
4. Point DNS, verify Postmark DKIM, send issue #1 to the founder's test address.
   (Site form already stores requests in `ps.sample_requests` and alerts Telegram — ADR 0010; no credential needed.)
5. Start the Thursday prospecting cycle.
