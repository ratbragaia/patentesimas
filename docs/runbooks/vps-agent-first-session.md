# Runbook — first sessions of the agent on the VPS

You (Claude Code) are running on the company VPS as user `patentsonar` in `/opt/patentsonar`.
Work through this list top to bottom; tick items by editing this file and committing.

## 0. Orientation (every session)
- [x] `git pull --ff-only` and read `docs/handoff-checklist.md` for what the founder has provided.
- [x] `cat /etc/patentsonar/env | sed 's/=.*/=<set>/'` to see which credentials exist (never print values).
- [x] `systemctl list-timers 'patentsonar-*'` and `tail -n 20 /var/log/patentsonar/*.log` for failures.

## 1. Platform checks
- [x] Supabase reachable: `npm run cli -- tasks list` returns a table (empty is fine). (2026-09-26: schema `ps` was
      exposed and granted but PostgREST's cache was stale → `PGRST205`; fixed with `notify pgrst, 'reload schema'`,
      now part of `apply-migrations.sh`.)
- [x] Deploy key added on GitHub: `ssh -T git@github.com` authenticates. (verified 2026-09-26) If not, print the key with
      `cat ~/.ssh/id_ed25519.pub` and ask the founder (Telegram once configured, else in the terminal).
- [x] https://patentsonar.com serves the site (HTTP/2 200, 2026-09-26) (`curl -sI https://patentsonar.com | head -1`).

## 1b. HTTPS ops channel for cloud sessions (do once)
- [x] (2026-09-26: token generated and stored; Caddy reloaded; `status` job answers `ok:true`, no-token request gets 401)
      `git pull`, `npm ci --omit=dev && npm install --no-save tsx`, then `openssl rand -hex 32` → append
      `OPS_TOKEN=<value>` to `/etc/patentsonar/env`, `sudo cp infra/Caddyfile /etc/caddy/Caddyfile && sudo systemctl reload caddy`,
      `sudo systemctl restart patentsonar-webhooks`. Test: `curl -s -X POST https://patentsonar.com/ops/run -H "Authorization: Bearer $OPS_TOKEN" -H 'Content-Type: application/json' -d '{"job":"status"}'`.
- [x] (told 2026-09-26, in the terminal) Tell the founder (one line, Portuguese) to add the same `OPS_TOKEN=<value>` to the "PatentSonar" cloud
      environment variables at claude.ai/code, so cloud sessions can run `infra/vps/ops.sh`.

## 2. Credentials still missing (ask the founder for each; they create the account, you configure)
- [ ] EPO OPS consumer key/secret (developers.epo.org → My Apps). Primary patent source.
- [x] Telegram bot token (@BotFather) + founder chat id. Then `npm run report:weekly` must deliver.
      (done 2026-09-26: chat id captured from `getUpdates` after the founder's `/start`; test report delivered)
- [x] GCP project + service account for BigQuery (ADR 0008: now the second data source, needed for US claims text and back-fill).
      (done 2026-09-26: Job User granted, 90-day BigQuery backfill loaded; cadence and cost in ADR 0009)
- [ ] Postmark server token + DNS records (`infra/dns-records.md`), Paddle sandbox, NFe.io, outreach mailbox.
Append each as `KEY=value` to `/etc/patentsonar/env`, then `sudo systemctl restart patentsonar-webhooks`.
Status 2026-09-26: all five requested from the founder (Portuguese message, first VPS session); each is a
`blocked` row in `ps.tasks` (agent `orchestrator`) so the ask survives the session.

## 3. First product cycle (as soon as EPO OPS key exists)
- [ ] (BigQuery half done 2026-09-26: 815 candidates → 81 on-topic, 76 families, CN 57 / US 10 / EP 8 / KR 4 / WO 2;
      EPO OPS half waits for the key; BigQuery now runs weekly inside `ingest`, ADR 0009) Backfill: temporarily run `npm run ingest` with a 90-day window (edit `computeWindow` fallback or
      insert an `ingest_runs` row) and check `ps.patent_publications` counts by office.
- [ ] Triage families (`production` agent instructions) and write analyst notes for `include` ones.
- [ ] `npm run newsletter:build -- <from> <to>`; QA must pass. Save the markdown of issue #0 to
      `docs/samples/issue-000.md` and commit: it is the sales sample.
- [ ] Send issue #0 to the founder's own address only (create a test customer/subscriber) once Postmark exists.

## 3b. Monthly landscape report (ADR 0011)
- [ ] `bash infra/vps/ops.sh cli ingest bigquery backfill dry-run` then without `dry-run` (one-off five-year history, ~268 GB).
- [ ] `bash infra/vps/ops.sh cli report monthly 2026-08 print` → review → `cli report monthly 2026-08`; commit the markdown to `docs/samples/`.

## 4. Go-to-market prep (in parallel, no credentials needed)
- [x] Load the 38 verified accounts from `docs/research/02-target-accounts.md` into `ps.accounts`. (2026-09-26,
      `supabase/migrations/0004_seed_accounts.sql`, idempotent)
- [x] Draft the first 15 personal hooks (one factual sentence each, with evidence URL) into `ps.leads.notes`.
      (2026-09-26, same migration; leads in stage `identified`, contact null until a public path is verified)
- [x] Do not send any outreach until the outreach domain, mailbox and `legal/REVIEW_STATUS.md` allow it.

## 5. Operating rhythm
Once 1–3 are done, follow `docs/runbooks/weekly-cycle.md`. Report to the founder weekly via Telegram.
