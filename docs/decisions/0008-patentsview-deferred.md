# ADR 0008 — PatentsView removed from the critical path; US coverage via EPO OPS + BigQuery

Date: 2026-09-26 · Status: accepted

## Context
The briefing listed the USPTO PatentsView API as a free source. On 2026-09-26 the founder tried to
request a key: the PatentsView support portal (Atlassian) is offline. Research shows why:
- PatentsView migrated to the USPTO Open Data Portal (ODP) on 2026-03-20; the PatentSearch API is
  subject to "temporary interruptions" with "no estimate" for relaunch on ODP
  ([USPTO notice](https://www.uspto.gov/subscription-center/2026/patentsview-migrating-uspto-open-data-portal-march-20),
  [transition guide](https://data.uspto.gov/support/transition-guide/patentsview)).
- Old keys are not valid on ODP. An ODP key requires a USPTO.gov account verified through **ID.me**
  with MFA ([ODP getting started](https://data.uspto.gov/apis/getting-started),
  [ODP registration](https://data.uspto.gov/support/universal-registration)), a flow designed for US
  residents and a poor fit for a Brazilian founder.

## Decision
- PatentsView / ODP is **deferred**. Not a handoff item any more; revisit when ODP publishes a
  stable search API and a non-ID.me developer path, or if a US-resident collaborator joins.
- US coverage: **EPO OPS** (DOCDB carries US grants and applications with English abstracts and
  the DOCDB family id) for detection, and **Google Patents Public Data on BigQuery** for claims text,
  CPC and back-fill. Both already implemented (`src/patents/epo-ops.ts`, `src/patents/bigquery.sql`).
- Consequence for the founder checklist: the **GCP project** (free tier, 1 TB of BigQuery queries per
  month, requires a Google account with a billing card attached even at $0 usage) moves up in priority,
  right after EPO OPS and Telegram.

## What we lose and how we compensate
| Lost from PatentsView | Compensation |
|---|---|
| Disambiguated assignee names | Normalise applicant strings ourselves (`ps.accounts.name` mapping table, monthly review) |
| `cpc_current` (reclassified CPC) | BigQuery `cpc` (current at load) is refreshed quarterly; acceptable for a weekly editorial product |
| Claims text of US grants | BigQuery `claims_localized` |
| Weekly US freshness independent of DOCDB | DOCDB loads US within days; 21-day lookback window already covers late loads |
