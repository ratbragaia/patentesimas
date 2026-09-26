# ADR 0011 — BigQuery through the REST API; five-year landscape backfill; monthly report design

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** ADR 0005 (source roles), ADR 0009 (BigQuery cadence and cost)

## Context

ADR 0009 set BigQuery to one run per month, driven by hand with the `bq` CLI on the VPS
(`bq query ... | npm run cli -- ingest bigquery <file.json>`). That left the monthly run outside the
job catalogue (cloud sessions and systemd could not trigger it) and the cost accounting in the GCP
console only. The monthly landscape report promised on the pricing page ("filing trends by applicant,
country and technology bucket, with quarter-on-quarter movement") had no generator and only 90 days of
history to draw on.

Measured in ADR 0009: the niche query scans ~268 GB **regardless of the window**, because the table
is not partitioned and cost follows the columns read. A five-year window therefore costs the same as a
60-day one.

## Decision

1. **REST client, no gcloud dependency.** `src/patents/bigquery.ts` authenticates with the service
   account JSON in `GOOGLE_APPLICATION_CREDENTIALS` (RS256 JWT → OAuth2 token, `node:crypto` only) and
   runs `jobs.query` with named parameters, polling and pagination. Every run is **dry-run first** and
   refused when the estimate exceeds `BQ_MAX_BYTES_BILLED` (300 GB, ADR 0009) or when the month's
   accumulated bytes (`ps.ingest_runs.bytes_processed`, view `ps.v_bigquery_month`, migration 0006)
   plus the estimate would pass the 1 TB free tier without a `spend_approvals` row (CLAUDE.md rule 3).
   The `bq --format=json` file loader stays as a fallback (`cli ingest bigquery <file.json>`).
2. **Windows.** `cli ingest bigquery` = trailing 60 days (monthly, ADR 0009).
   `cli ingest bigquery backfill` = trailing **five years**, one-off, to give the landscape report its
   history; same scan cost, so the September 2026 total is ~0.54 TB, inside the free tier. Both are
   in the ops job catalogue (`ops.sh cli ingest bigquery [backfill] [dry-run]`).
3. **Monthly report** (`src/content/landscape.ts`, `cli report monthly [YYYY-MM] [print]`):
   - Stored in `ps.issues` with `kind = monthly_report` and `issue_number = YYYYMM` (idempotent per
     month, far from the weekly sequence). Weekly numbering, the "already cited" rule and the Wednesday
     `send-latest` timer now consider `kind = weekly` only, so a report never blocks or replaces a
     weekly issue. Sending a report to subscribers is a deliberate step: `newsletter send YYYYMM`.
   - Content: month summary; eight quarters of new families and publications (family counted in the
     quarter of its **first** publication, incomplete quarter flagged); by office, by technology bucket
     and top-15 applicants over the trailing twelve months versus the twelve before; every family first
     published in the month (excluded families omitted; analyst notes where present); data notes with
     the latest publication date per office in the data and the known JP/DE gap.
   - Same QA gate as the weekly issue (`runQa`): unknown numbers or date mismatches → `qa_failed`,
     founder alerted, nothing published. Rule 1 holds because every printed number, date and applicant
     is read from `ps.patent_publications`.
   - Default month = previous calendar month. Because the dataset lags Asian offices by 2–4 weeks,
     the report states the per-office "data through" dates and the next edition revises the tail.
4. **Cadence.** BigQuery monthly run on the first Monday of the month, report built on the following
   business day (runbook `weekly-cycle.md`, monthly row). Until a systemd timer is added, the
   orchestrator triggers both through the ops channel.

## Consequences

- Five-year backfill adds roughly 1.5–2 k on-topic publications (extrapolating 81 per 90 days),
  which enter `ps.patent_families` as `new`. Triage stays focused on families published in the
  current window; historic families feed counts only.
- `ps.ingest_runs` gains `bytes_processed` and `mode`; the weekly founder report can show the month's
  BigQuery position from `ps.v_bigquery_month`.

## Evidence

- Tests: `tests/bigquery.test.ts` (JWT verified with the public key, row conversion, DECLARE stripping,
  row mapping), `tests/landscape.test.ts` (aggregation, quarter series, QA pass, table HTML).
- First live backfill and first report: outcomes recorded in `docs/runbooks/vps-agent-first-session.md`
  §3 and in `docs/samples/` once run.
