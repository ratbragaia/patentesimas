# ADR 0005 — Data source roles and identifier policy

Date: 2026-09-25 · Status: accepted

## Context
`docs/research/03-patent-data-sources.md` found that (a) PatentsView's PatentSearch database is
refreshed **quarterly** and is being migrated to the USPTO Open Data Portal from March 2026 with
possible interruptions; (b) EPO OPS (DOCDB) is updated weekly, covers US/EP/WO/CN/JP/KR bibliographic
data with English titles/abstracts where available, exposes the DOCDB simple-family id, and has a
free tier of roughly 4 GB/week with per-minute throttling headers; (c) Google Patents Public Data on
BigQuery is quarterly, CC BY 4.0, and shares the same DOCDB family id.

## Decision
| Need | Primary | Secondary |
|---|---|---|
| Detect new publications (all six offices) | EPO OPS `published-data/search/biblio`, `pd within` window | USPTO ODP weekly XML (to be specified) |
| US enrichment: disambiguated assignee, cpc_current, claims | PatentsView `patent`, `publication`, `g_claim` | — |
| Family grouping, legal status | OPS `@family-id`, `/family`, `/legal` | BigQuery `family_id` |
| CN/JP/KR English abstracts | OPS English abstract when present | BigQuery research dataset (flag `abstract_is_mt`) |
| Back-fill and landscape counts | BigQuery | — |

- Canonical identifier: `CC-NUMBER-KIND` exactly as BigQuery (`US-10068689-B2`). Raw ids are kept.
- Ingest window is always the last 21 days; "new" means first seen by us, not publication date.
- Client rules: honour PatentsView `Retry-After` (45 req/min); parse OPS `X-Throttling-Control` and
  pace; switch bulk pulls to BigQuery when OPS weekly quota passes 80%.
- Attribution to PatentsView and Google Patents Public Data is permanent footer text. OPS data is
  used inside the editorial product only; never republished as bulk data.
- Tiering after retrieval: A = RE-free core (include CPC, no H01F1/05x), B = RE-lean (H01F1/057 +
  RE-lean keyword), C = RE-free motor design. B and C go to editor review; A auto-drafts.

## Open items (from research §8)
PatentsView `publication` endpoint field names; OPS `pd within` separator (space vs comma) to test on
day one; exact CPC titles for a few sub-groups before they are printed; BigQuery bytes-billed
measurement before scheduling.
