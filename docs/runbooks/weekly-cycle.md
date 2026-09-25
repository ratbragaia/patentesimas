# Runbook — weekly operating cycle

| Day | Job | Command / timer | Done when |
|---|---|---|---|
| Mon 06:00 | Ingest | `rarefree-ingest.timer` → `npm run ingest` | `rf.ingest_runs` shows `succeeded` for each configured source |
| Mon | Triage + analyst notes | production agent | all `new` families have `triage_status` and `include` ones have `analyst_summary` |
| Tue 06:00 | Build issue | `rarefree-newsletter-build.timer` | `rf.issues.status = ready`, founder got preview |
| Wed 13:00 UTC | Send | `rarefree-newsletter-send.timer` (sends latest `ready`) | `deliveries` rows `sent`; failures < 2% |
| Thu | Prospecting + outreach batch | prospecting → sales agents | ≤ 25 compliant first-touch emails, all logged |
| Fri | Reconciliation + report | `rarefree-invoices` (daily) + `rarefree-report.timer` | Telegram report delivered |
| Daily 07:00 | Invoices | `rarefree-invoices.timer` → `invoices issue` | no `pending` invoice older than 24h |
| Always | Webhooks | `rarefree-webhooks.service` | `/healthz` 200 |

## Incident: issue failed QA
1. Read `qa_report` on the issue row. 2. Fix the analyst note (never the QA code). 3. Rebuild. 4. If unresolved by Wed 12:00 UTC, skip the week and notify the founder with the reason; log an ADR if a systemic cause.

## Incident: ingest source down
Retry once after 1h. If still failing, publish with the remaining sources and state the gap in the issue ("EPO data for this week pending"). Never fabricate coverage.

## Incident: payment failed
Webhook creates a `finance` task; follow the dunning schedule in `.claude/agents/finance.md`.
