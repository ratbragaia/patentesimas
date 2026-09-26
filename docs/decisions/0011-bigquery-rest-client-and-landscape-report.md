# ADR 0011 — BigQuery through the REST API; five-year landscape backfill; monthly report design

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** ADR 0005 (source roles), ADR 0009 (BigQuery cadence and cost, revised the same day to weekly)

## Context

ADR 0009 (revised) runs BigQuery every Monday inside `cli ingest` with a 45-day window through the `bq`
CLI, accepting ~US$1/month above the free tier. Two sessions worked on this the same day: the VPS
session wired the weekly source; this cloud session built a REST client with a dry-run gate and cost
accounting. This ADR records how the two were merged. Separately, the monthly landscape report promised
on the pricing page ("filing trends by applicant, country and technology bucket, with quarter-on-quarter
movement") had no generator and only 90 days of history to draw on.

Measured in ADR 0009: the niche query scans ~268 GB **regardless of the window**, because the table
is not partitioned and cost follows the columns read. A five-year window therefore costs the same as a
60-day one.

## Decision

1. **REST client first, `bq` CLI as fallback.** `src/patents/bigquery.ts` authenticates with the
   service account JSON in `GOOGLE_APPLICATION_CREDENTIALS` (RS256 JWT → OAuth2 token, `node:crypto`
   only) and runs `jobs.query` with named parameters, polling and pagination. Every run is **dry-run
   first** and refused when the estimate exceeds `BQ_MAX_BYTES_BILLED` (300 GB). If the REST path fails
   for any other reason, the verified `bq` CLI path runs instead, so a Monday ingest never loses
   BigQuery to a client bug. Bytes processed are recorded per run (`ps.ingest_runs.bytes_processed`,
   `mode`; view `ps.v_bigquery_month`, migration 0006).
2. **Cost gate.** Passing the 1 TB free tier is accepted as ADR 0009 decided (~US$1/month). The
   on-demand run refuses only when its own incremental charge would exceed `SPEND_CAP_USD_PER_ACTION`
   (CLAUDE.md rule 3), which the 300 GB cap makes unreachable (≤ US$1.9). The weekly founder report
   can read the month's position from `ps.v_bigquery_month`.
3. **Windows.** Monday ingest: 45 days (ADR 0009). On demand: `cli ingest bigquery` = same 45 days;
   `cli ingest bigquery backfill` = trailing **five years**, one-off, to give the landscape report its
   history at the same scan cost. September 2026 total after the backfill ≈ 0.8 TB before the
   2026-09-28 Monday run (≈ 1.07 TB, ≈ US$0.45 on demand). Both are in the ops job catalogue
   (`ops.sh cli ingest bigquery [backfill] [dry-run]`).
4. **Monthly report** (`src/content/landscape.ts`, `cli report monthly [YYYY-MM] [print]`):
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
5. **Cadence.** The report is built on the first business day after the month's first Monday ingest
   (runbook `weekly-cycle.md`, monthly row). Until a systemd timer is added, the orchestrator triggers
   it through the ops channel.

6. **Classifier tightened, stored rows re-classified.** The backfill exposed two defects in
   `classify()`: short chemical tokens matched as substrings (`NiCoCuMnAl` catalysts → "MnAl"), and a
   bare "rare-earth-free" phrase admitted aluminium alloys, catalysts and drugs. Short keywords now match
   as tokens, and a keyword-only hit needs magnet / electric-machine context (`MAGNET_CONTEXT_RE`) or an
   included CPC. `cli patents reclassify [apply]` re-runs the classifier on stored rows so a fix reaches
   data loaded before it; families an analyst marked `include` are never dropped, and `triage_status` /
   `analyst_summary` survive the family rebuild.

## Consequences

- Five-year backfill (run 2026-09-26): 25,878 candidate rows → 1,600 on-topic under the old classifier
  → **1,094 publications in 652 families** after the two re-classification passes (102 + 404 rows
  removed; 375 empty families deleted). Historic families enter as `new` and feed counts only; triage
  stays focused on the current window and on the families a report prints.
- `ps.ingest_runs` gains `bytes_processed` and `mode`; the weekly founder report can show the month's
  BigQuery position from `ps.v_bigquery_month`. Runs before 2026-09-26 have no bytes recorded.
- Analyst triage remains the quality gate for anything printed: the August 2026 listing still shows a
  ferrite-particle termite tracer, which only a human marks `exclude`. Task queued (migration 0007).
- Applicant names: most CN rows carry an empty `assignee_harmonized` ("applicant not recorded"), which
  weakens the applicant table. Task queued (migration 0007) to evaluate the raw `assignee` field and the
  research dataset before changing the SQL (a changed query text is a cache miss: one more 268 GB scan).

## Evidence

- Tests: `tests/bigquery.test.ts` (JWT verified with the public key, row conversion, DECLARE stripping,
  row mapping), `tests/landscape.test.ts` (aggregation, quarter series, QA pass, table HTML).
- Live runs 2026-09-26 (ops channel): dry-run 267.7 GB for the five-year window (identical to 45 days);
  first REST run 267.7 GB billed, job `job_aloxM_pvnOGSPpcikewIl38Kwhgu`, 25,878 rows; the failed first
  load also triggered one `bq` CLI scan (268 GB) before the fallback was narrowed to query errors; the
  two re-runs after fixes were cache hits (0 bytes). September 2026 BigQuery total ≈ 1.07 TB before the
  2026-09-28 Monday run (≈ US$0.45 on demand so far, ≈ US$2.1 after Monday; ADR 0009 accepted ~US$1/month,
  the overage this month comes from the one-off backfill and the fallback scan).
- First report: `ps.issues` 202608 (`monthly_report`, QA passed, status `ready`, 13 families in August,
  115 over twelve months). Markdown: `docs/samples/landscape-2026-08.md`. Not sent: no subscribers yet
  and triage pending.
