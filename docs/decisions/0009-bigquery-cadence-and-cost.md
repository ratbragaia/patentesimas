# ADR 0009 — BigQuery (Google Patents Public Data): monthly cadence, cost cap, known gaps

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** ADR 0005 (data-source roles), ADR 0008 (PatentsView deferred)

## Context

The GCP service account `patentsonar-bq` (project `patentsonar-prod`) went live today with
`roles/bigquery.jobUser`. First measurements against `patents-public-data.patents.publications`
with the niche query in `src/patents/bigquery.sql`:

| Measurement | Result |
|---|---|
| Dry run, 7-day window (2026-09-14..20) | 267.7 GB processed |
| Dry run, 112-day window (2026-06-01..09-20) | 267.7 GB processed (identical) |
| Real 90-day run (2026-06-28..09-26) | 815 candidate rows → 81 on-topic after `classify()` → 76 families |
| Free tier | 1 TB processed per month; beyond that US$6.25/TB (research 03) |

The table is not partitioned by `publication_date`, so the scan cost is set by the columns read
(title/abstract/cpc/assignee arrays), not by the window. Four weekly runs (~1.07 TB) would exceed
the free tier; one run per month with any window costs ~0.27 TB.

Dataset freshness per office (max `publication_date` on 2026-09-26): DE 09-24, US 09-17,
EP 09-16, CN 09-08, JP 09-04, WO 09-03, TW 09-01, KR 08-31. Asian offices lag 2–4 weeks, so a
weekly "last Mon–Sun" window would systematically miss them.

Two defects found and fixed in the query/loader:
1. Dates are INT64 `yyyymmdd` with `0` for unknown; `PARSE_DATE` aborted the job ("Failed to parse
   input string \"0\""). Now `SAFE.PARSE_DATE(... NULLIF(x, 0) ...)`.
2. `bq query --format=json` on a script with `DECLARE` nests the result set (`[[{...}]]`); the
   `ingest bigquery` loader now unwraps it.

English text availability in the 90-day sample: CN 250/250 rows with `title_en` and `abstract_en`;
US 187/187; WO 43/43; EP 131 titles / 55 abstracts; KR 55 titles / 0 abstracts; **JP 0/0; DE 0/0**.
`classify()` needs text to match niche terms, so JP and DE contribute nothing today.

## Options

1. Weekly BigQuery runs (as the SQL header originally said): exceeds the free tier, still misses
   the Asian lag.
2. **Monthly BigQuery run with a trailing 60-day window** (upsert is idempotent, so re-scanning
   the overlap is free of side effects), plus a hard `--maximum_bytes_billed` cap. Weekly
   freshness comes from EPO OPS once its key exists.
3. Materialise a partitioned copy of the table in our project: one-off ~268 GB scan per refresh,
   then cheap partitioned reads; storage cost and refresh complexity not justified at this stage.

## Decision

Option 2.
- BigQuery runs **once a month**, window = last 60 days, `--maximum_bytes_billed=300000000000`
  (300 GB; a run that would exceed it fails instead of spending). Trigger: the monthly report
  cycle, or on demand via `bq query ... < src/patents/bigquery.sql | npm run cli -- ingest bigquery`.
- Spend: within the free tier (~0.27 TB/month) → no `spend_approvals` row needed. Any change that
  pushes a run above 1 TB/month requires one.
- EPO OPS stays the weekly source (ADR 0005/0008). PatentsView remains deferred.

## Known gap and follow-up (task in `ps.tasks`)

JP/DE (and KR abstracts) lack English text in `patents.publications`. Candidate fix: the
`patents-public-data.google_patents_research.publications` table carries machine-translated
English `title`/`abstract` for all offices. Before adopting it: dry-run its scan cost with the
same window and compare on-topic yield for JP/DE against the current query. Until then, JP
coverage relies on EPO OPS bibliographic data (English abstracts for JP publications).

## Evidence

- `bq` dry-run and job outputs, 2026-09-26 (this session); loader log:
  `{"msg":"bigquery loaded","rows":815,"onTopic":81,"inserted":81}`, `families rebuilt: 76`.
- `ps.patent_publications` by office after load: CN 57, US 10, EP 8, KR 4, WO 2.
- Pricing/free tier: `docs/research/03-patent-data-sources.md` (BigQuery pricing sources).
