# Runbook — weekly operating cycle

| Day | Job | Command / timer | Done when |
|---|---|---|---|
| Mon 06:00 | Ingest | `patentsonar-ingest.timer` → `npm run ingest` | `ps.ingest_runs` shows `succeeded` for each configured source |
| Mon | Triage + analyst notes | production agent | all `new` families have `triage_status` and `include` ones have `analyst_summary` |
| Tue 06:00 | Build issue | `patentsonar-newsletter-build.timer` | `ps.issues.status = ready`, founder got preview |
| Wed 13:00 UTC | Send | `patentsonar-newsletter-send.timer` (sends latest `ready`) | `deliveries` rows `sent`; failures < 2% |
| Thu | Prospecting + outreach batch | prospecting → sales agents | ≤ 25 compliant first-touch emails, all logged |
| Fri | Reconciliation + report | `patentsonar-invoices` (daily) + `patentsonar-report.timer` | Telegram report delivered |
| Daily 07:00 | Invoices | `patentsonar-invoices.timer` → `invoices issue` | no `pending` invoice older than 24h |
| Weekdays 07/10/13/16/19 UTC | Headless operator | `patentsonar-agent.timer` → `infra/agent/run.sh` (`claude -p`, ADR 0012) | drains `ps.tasks`, answers `ps.inbound_emails`; log in `/var/log/patentsonar/agent/` |
| Always | Webhooks | `patentsonar-webhooks.service` | `/healthz` 200 |
| Daily | Sample requests | `cli samples list` → sales agent sends the current issue by hand, sets `sample_requests.status = sent` | no `new` request older than one business day |
| Monthly (Tue after 1st Mon) | Landscape report | `ops.sh cli report monthly` (previous month; BigQuery data came in with Monday's ingest) | `ps.issues` has `kind = monthly_report` for the previous month in status `ready`; founder got the preview; `newsletter send YYYYMM` by hand after review |

## Incident: issue failed QA
1. Read `qa_report` on the issue row. 2. Fix the analyst note (never the QA code). 3. Rebuild. 4. If unresolved by Wed 12:00 UTC, skip the week and notify the founder with the reason; log an ADR if a systemic cause.

## Incident: ingest source down
Retry once after 1h. If still failing, publish with the remaining sources and state the gap in the issue ("EPO data for this week pending"). Never fabricate coverage.

## Incident: payment failed
Webhook creates a `finance` task; follow the dunning schedule in `.claude/agents/finance.md`.
