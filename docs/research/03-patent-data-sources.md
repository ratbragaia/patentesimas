# 03 - Patent Data Sources: Technical Specification for the PatentSonar Data Layer

**Date:** 2026-09-25
**Owner:** Data engineering
**Status:** Draft v1 for review
**Scope:** Rare-earth-free and rare-earth-lean permanent magnets (Fe16N2 iron nitride, MnBi, MnAl-C, advanced hexaferrites, L10 FeNi/tetrataenite, Ce/La-substituted magnets) and RE-free motor topologies.

## 0. Ground rules and how to read this document

The business has one hard rule: **never invent a patent number, date, assignee, or claim.** Every number that appears in the newsletter must be traceable to a row in our raw ingestion table, and that row must have been written by an official API response we persisted verbatim. This document specifies the sources, their auth/quotas/formats, the classification and keyword strategy, the weekly pipeline, and the licensing envelope.

**Verification status.** During this research pass the sandbox egress proxy blocked direct fetches of `patentsview.org`, `search.patentsview.org`, `developers.epo.org`, `epo.org`, `uspto.gov`, `cooperativepatentclassification.org`, `wipo.int`, `lens.org`, `patents.google.com`, `data.uspto.gov` and `kipris.or.kr`. Facts about those services were therefore taken from (a) indexed search-engine excerpts of the official pages, and (b) well-maintained open-source client libraries and their documentation (python-epo-ops-client, patent-dev/epo-ops, rOpenSci `patentsview`, mustberuss PatentSearch tutorial, google/patents-public-data). Each fact below is tagged:

- **[V]** verified from an official page or the official GitHub repository of the data provider (fetched directly or via an indexed excerpt of the official URL);
- **[S]** reported by a secondary but credible source (maintained client library, WIPO analytics manual, etc.);
- **[?]** ambiguous, contradictory across sources, or not confirmable in this pass. Treat as an open item to confirm before implementation.

Before go-live, the engineer implementing each connector must open the linked official page from an unblocked network and tick off every [S] and [?] item.

---

## 1. USPTO PatentsView PatentSearch API

Base URL: `https://search.patentsview.org/api/v1/` [V]. Documentation hub: `https://search.patentsview.org/docs/` [V]; Swagger UI: `https://search.patentsview.org/swagger-ui/` [S, referenced by the rOpenSci maintainers]; endpoint dictionary: `https://search.patentsview.org/docs/docs/Search%20API/EndpointDictionary/` [V].

### 1.1 Authentication and key request

- Auth is an API key sent in the request header `X-Api-Key: <key>` [V, PatentSearch API Reference; S, dltHub and connector docs].
- Keys are requested through the PatentsView support portal: `https://patentsview-support.atlassian.net/servicedesk/customer/portals` [S]. The legacy public (keyless) API was discontinued on 1 May 2025 [V, USPTO PatentsView page].
- **Rate limit: 45 requests per minute per key.** Exceeding it returns HTTP 429 with a `Retry-After` header giving seconds to wait [V, PatentsView forum "API rate limits"; S, rOpenSci getting-started]. Our client must honour `Retry-After` and additionally keep a client-side token bucket at 40/min.
- HTTP 400 responses carry an `X-Status-Reason` header with the parse error [S, mustberuss tutorial].

### 1.2 Endpoints relevant to us

The API grew from 7 to 27 endpoints; names are **singular** (`patent`, not `patents`) [S, rOpenSci api-changes vignette]. Relevant ones [V, Endpoint Dictionary]:

| Endpoint | Content | Key |
|---|---|---|
| `/api/v1/patent/` | Granted patents. Response groups include `applicants, application, assignees, attorneys, botanic, cpc_at_issue, cpc_current, examiners, figures, foreign_priority, gov_interest_*, granted_pregrant_crosswalk, inventors` | `patent_id` |
| `/api/v1/publication/` | Pre-grant publications (PGPubs). Groups: `publications, assignees, cpc_at_issue, cpc_current, foreign_priority, gov_interest_organizations, granted_pregrant_crosswalk, inventors, ipcr, pct_data, us_related_documents, us_parties, uspc_at_issue, wipo`; default sort `document_number` | `document_number` |
| `/api/v1/g_claim/` | Claims text of granted patents (`pg_claim` for PGPubs). Sorted by `patent_id`/`document_number` then `claim_sequence` | `patent_id` + `claim_sequence` |
| `/api/v1/g_brf_sum_text/`, `/g_detail_desc_text/`, `/g_draw_desc_text/` (+ `pg_` twins) | Brief summary, detailed description, drawing description | as above |
| `/api/v1/assignee/` | Disambiguated assignee entities | `assignee_id` |
| `/api/v1/cpc_class/`, `/cpc_subclass/`, `/cpc_group/` | CPC lookup tables | code |
| `/api/v1/publication/rel_app_text/` | Related-application text for PGPubs | |

Gotcha: single-id lookups for CPC groups must replace `/` with `:` in the path (e.g. `GET /api/v1/cpc_group/H01F1:047/`) [V, Endpoint Dictionary].

### 1.3 Query language (q, f, s, o)

Requests are GET with URL-encoded JSON parameters, or POST with a JSON body when the query exceeds roughly 2,000 characters [V, API Reference]. Parameters [V]:

- `q` (required): criteria object. Operators [V, legacy and current query language docs]: `_eq, _neq, _gt, _gte, _lt, _lte` (int/float/date/string), `_begins, _contains` (string), `_text_all, _text_any, _text_phrase` (full-text fields), combinators `_and, _or, _not`.
- `f`: list of fields to return. Nested fields are dotted (`application.filing_date`) or you can name the group (`assignees`) to get all its sub-fields [S, rOpenSci].
- `s`: list of `{field: "asc"|"desc"}`.
- `o`: options `{"size": N, "after": <cursor>}`.

### 1.4 Pagination

- `size` default 100, **hard maximum 1000** per request; larger values are accepted but silently capped [S, mustberuss tutorial quoting API docs].
- `after` is a **cursor**: pass the sort-field value(s) of the last row of the previous page. If you sort on several fields, pass the vector of last values. **The sort key must be row-unique** (`patent_id`, `document_number`); sorting only on `patent_date` skips rows at page boundaries [S, rOpenSci result-set-paging vignette]. Always sort `[{"patent_id":"asc"}]` (or `document_number`) when paging.

### 1.5 Field map for our schema

| Our column | `patent` endpoint | `publication` endpoint |
|---|---|---|
| title | `patent_title` | `publication_title` [?] |
| abstract | `patent_abstract` | `publication_abstract` [?] |
| grant date | `patent_date` | n/a |
| publication date | (grant date) | `publication_date` [?] |
| filing date | `application.filing_date` | `application.filing_date` [?] |
| assignee | `assignees.assignee_organization`, `assignees.assignee_id`, `assignees.assignee_type` | `assignees.*` |
| CPC current | `cpc_current.cpc_group_id`, `cpc_current.cpc_subclass_id`, `cpc_current.cpc_class_id`, `cpc_current.cpc_type` (values `inventional` / `additional`), `cpc_current.cpc_sequence` [V/S] | `cpc_current.*` |
| claims | `g_claim` endpoint: `claim_text`, `claim_sequence`, `dependent`, `exemplary` [S] | `pg_claim` |
| foreign priority | `foreign_priority.*` group exists [V]; exact sub-field names (country, date, kind, application number) must be read from Swagger [?] | `foreign_priority.*` [V] |

The publication endpoint's exact primary text field names (`publication_title` vs `title`) were not confirmable in this pass and are marked [?]; the Swagger schema resolves this in one click.

### 1.6 Family and foreign-priority data

PatentsView exposes **foreign priority claims** (country, date, application number) on both grant and PGPub endpoints and a **granted_pregrant_crosswalk** linking a PGPub to the later grant [V]. It does **not** expose a DOCDB/INPADOC family identifier or non-US family members. Family deduplication therefore has to come from EPO OPS (section 2) or BigQuery `family_id` (section 3).

### 1.7 Data freshness (important)

PatentsView bulk data and the PatentSearch database are refreshed **quarterly**, not weekly [V, PatentsView forum "Data Updates"; V, USPTO "PatentsView releases Q4 2025 data update"]. USPTO is migrating PatentsView to the USPTO Open Data Portal (ODP) beginning 20 March 2026 and warned of "temporary interruptions" to the PatentSearch API with "no estimate" for re-launch of updated functions [V, USPTO PatentsView page and ODP transition guide]. Consequence for us: PatentsView is an **enrichment and QA source** for US documents (disambiguated assignees, `cpc_current`, claims text), **not** the detector of "new this week". See section 6.

### 1.8 Example request bodies

Iron-nitride grants with RE-free CPC, excluding RE-alloy CPC, last 90 days:

```json
POST https://search.patentsview.org/api/v1/patent/
X-Api-Key: <key>
Content-Type: application/json

{
  "q": {"_and": [
    {"_gte": {"patent_date": "2026-06-25"}},
    {"_or": [
      {"_text_phrase": {"patent_abstract": "iron nitride"}},
      {"_text_any":    {"patent_abstract": "Fe16N2 MnBi MnAl tetrataenite hexaferrite"}},
      {"_text_phrase": {"patent_title":    "rare earth free"}},
      {"_eq": {"cpc_current.cpc_group_id": "H01F1/047"}}
    ]},
    {"_not": {"_begins": {"cpc_current.cpc_group_id": "H01F1/05"}}}
  ]},
  "f": ["patent_id","patent_title","patent_abstract","patent_date",
        "application.filing_date","assignees.assignee_organization",
        "cpc_current.cpc_group_id","cpc_current.cpc_type",
        "foreign_priority","granted_pregrant_crosswalk"],
  "s": [{"patent_id": "asc"}],
  "o": {"size": 1000}
}
```

Claims for one patent (used to verify any claim quoted in the newsletter):

```json
POST https://search.patentsview.org/api/v1/g_claim/
{"q": {"_eq": {"patent_id": "10068689"}},
 "f": ["patent_id","claim_sequence","claim_text","dependent"],
 "s": [{"claim_sequence":"asc"}], "o": {"size": 200}}
```

Note: `_not` + `_begins` on `cpc_current.cpc_group_id` excludes any patent that carries *any* H01F 1/05x code; use it for a strict RE-free tier and run a second, looser query for the RE-lean tier (section 4.5).

---

## 2. EPO Open Patent Services (OPS) 3.2

Developer portal: `https://developers.epo.org/` [V]. REST base: `https://ops.epo.org/3.2/rest-services/` [V, python-epo-ops-client source]. Token endpoint: `https://ops.epo.org/3.2/auth/accesstoken` [V, python-epo-ops-client source].

### 2.1 Registration

Create an account at `https://developers.epo.org/user/register`, confirm by e-mail, open **My Apps**, **Add a new App**; the portal issues a **Consumer Key** and **Consumer Secret** [S, PatZilla setup guide; S, EPO registration walkthrough PDF]. Two access methods exist: "Non-paying" (free, capped weekly volume) and "Paying" (unlimited volume, quoted at EUR 2,800/year) [S, PatZilla].

### 2.2 OAuth2 client-credentials flow

```http
POST /3.2/auth/accesstoken HTTP/1.1
Host: ops.epo.org
Authorization: Basic base64(consumer_key:consumer_secret)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
```

Response JSON contains `access_token`; subsequent calls send `Authorization: Bearer <access_token>` [V, python-epo-ops-client source]. Token lifetime is short (commonly cited as about 20 minutes) [?]; implement refresh-on-401 rather than relying on a fixed TTL.

### 2.3 Fair use, quotas and throttling headers

- Free registered volume: **4 GB per week** [S, patent-dev/epo-ops; S, Apify OPS actor]. One older source states 3.5 GB/week [S, PatZilla] - treat 3.5 GB as the conservative planning figure [?]. Users must comply with the EPO **Fair use charter** (2018) and the OPS Terms and Conditions v2.0 [V, referenced from developers.epo.org].
- Response headers [S, python-epo-ops-client and patent-dev/epo-ops]:
  - `X-Throttling-Control`, e.g. `idle (retrieval=green:200, search=yellow:20, inpadoc=red:30, images=green:200, other=green:1000)`. System state is `idle|busy|overloaded`; each service (`retrieval`, `search`, `inpadoc`, `images`, `other`) has a colour `green|yellow|red|black` and a per-minute request allowance. Throttling operates on a one-minute rolling window.
  - `X-IndividualQuotaPerHour-Used` and `X-RegisteredQuotaPerWeek-Used` (bytes consumed).
  - On rejection, `X-Rejection-Reason` is `IndividualQuotaPerHour` or `RegisteredQuotaPerWeek` (HTTP 403).
- Client rule: parse `X-Throttling-Control` after every call; if a service is `red` sleep to stay under its stated limit; if `black` stop that service for the rest of the minute; if weekly quota used > 80 %, switch the pipeline to BigQuery for bulk bibliographic pulls and reserve OPS for family/legal lookups.

### 2.4 Endpoints and URL grammar

General form: `{base}/{service}/{reference-type}/{input-format}/{number}[/{endpoint}][/{constituents}]` [V, python-epo-ops-client]. Reference types: `publication`, `application`, `priority`. Input formats: `docdb`, `epodoc`, `original`.

| Service | URL example | Notes |
|---|---|---|
| Search | `GET /published-data/search?q=<CQL>` with header `X-OPS-Range: 1-100` (or `Range` query param) | Default 25/page, **max 100 per page, hard cap 2,000 results per query** [S, Go client, Apify]. Constituent variants: `/published-data/search/biblio`, `/published-data/search/abstract`, `/published-data/search/full-cycle` return richer records per hit. |
| Biblio | `GET /published-data/publication/docdb/US.10068689.B2/biblio` | Titles, abstracts (all languages present), applicants, inventors, IPC/CPC, priority claims, **DOCDB family id** attribute on `exchange-document` [S] |
| Abstract | `.../abstract` | |
| Claims | `.../claims` | Full text is only available for EP, WO and a subset of authorities [?]; US claims should come from PatentsView |
| Description / fulltext | `.../description`, `.../fulltext` | same caveat |
| Equivalents | `.../equivalents` | |
| Family | `GET /family/publication/docdb/US.10068689.B2` and `/family/publication/docdb/<n>/biblio`, `/family/publication/docdb/<n>/legal` | INPADOC (extended) family members with `@family-id`; constituents `biblio`, `legal` [V, python client; S, Go client] |
| Legal | `GET /legal/publication/docdb/<n>` | INPADOC legal events (country, code, date, description) [S] |
| Number service | `GET /number-service/publication/original/<n>/docdb` | converts original/epodoc/docdb formats |
| Register | `/register/...` | EP procedural data only |

### 2.5 CQL syntax (published-data search)

Field codes reported consistently across clients [S, navisbio MCP, patent-dev cql, abdullahatrash OPS.md]: `ti` title, `ab` abstract, `ta` title+abstract, `txt` title+abstract+claims (verify [?]), `cl` IPC+CPC, `ic` IPC, `cpc` CPC, `pa` applicant, `in` inventor, `pn` publication number, `ap` application number, `pr` priority number, `pd` publication date, `ad` application date, `ct` cited documents. Operators `AND OR NOT` (uppercase), proximity `prox/distance<=n`, right-truncation `*` on `ta/ti/ab/pa/in` only.

Date ranges: use `pd within "20260918 20260925"`; the `pd>=x AND pd<=y` form triggers a `CLIENT.FuzzyDateRanges` fault [S, patent-dev/epo-ops]. The separator inside the quotes is reported as a space by one client and a comma by another [?] - test both on day one. Classification codes are written without spaces: `cpc=H01F1/047`; a trailing `*` is not needed for hierarchical match (CPC search is hierarchical in OPS) [?].

Example CQL for our niche (one week, all authorities):

```text
(cpc=H01F1/047 OR cpc=H01F1/06 OR cpc=H01F1/08 OR cpc=H01F1/11 OR cpc=C22C22/00 OR cpc=C01B21/0622 OR cpc=C04B35/26)
AND (ta="iron nitride" OR ta=Fe16N2 OR ta=MnBi OR ta="manganese bismuth" OR ta=MnAl OR ta="manganese aluminium" OR ta=tetrataenite OR ta="L10 FeNi" OR ta=hexaferrite OR ta="rare earth free" OR ta="free of rare earth" OR ta="without rare earth")
AND pd within "20260918 20260925"
```

Because of the 2,000-hit cap, run the query per authority (`AND pn=CN*` is not valid - instead split by date day-by-day, or by CPC sub-block) so that no single query can exceed 2,000 [S]. In practice a one-week window in this niche returns well under 500 records.

### 2.6 Deduplicating international families with the DOCDB family id

DOCDB's **simple family** groups publications sharing exactly the same priority claims; OPS `biblio` records expose it as the `@family-id` attribute of `exchange-document`, and the `/family` service returns INPADOC (extended) family members [S]. Pipeline rule:

1. For every hit, store `docdb_family_id` from the biblio response.
2. Group the week's hits by `docdb_family_id`; the newsletter counts a **family** once and lists all members (US, EP, WO, CN, JP, KR) under it.
3. A family is "new" when no earlier run stored any member of that family id. A new member of an already-reported family is reported as "family extension" (e.g. CN entry of a US case we covered).
4. BigQuery `family_id` is also the DOCDB simple family id (section 3), so both sources reconcile on the same key [V, Google schema: "Grouping on family ID will return all publications associated with a simple patent family"].

### 2.7 CN / JP / KR coverage in OPS

DOCDB (the EPO master documentation database behind OPS) carries bibliographic data and abstracts from 100+ authorities including CNIPA, JPO, KIPO and WIPO [S, Apify/iiindex descriptions of DOCDB]. Abstracts arrive in the original language and, where the office or the EPO supplies one, in English (historically English abstracts for JP via PAJ, and English abstracts for CN and KR in a large share of recent publications) [?]. When several abstracts are present, select `@lang="en"` first, else fall back to the original and flag `needs_translation=true` [S]. Titles for CN/JP/KR are commonly available in English in DOCDB [?]. Claims/description full text for CN/JP/KR are **not** in OPS; use Google BigQuery `google_patents_research` machine translations (section 3) or the office platforms (section 5) for reading.

---

## 3. Google Patents Public Datasets on BigQuery

Dataset: `patents-public-data` (project) with tables `patents.publications` and `google_patents_research.publications` [V, google/patents-public-data schema page]. Provider: IFI CLAIMS Patent Services and Google; licence CC BY 4.0 [V]. Marketplace listing states expected update frequency **quarterly** [V, Google Cloud Marketplace]; community reports note delays [S]. The GitHub examples repository was archived (read-only) on 18 April 2026 [V, GitHub] - the dataset itself is still served, but treat the project as low-touch and monitor the table's "last modified" metadata each run.

### 3.1 Schema (patents.publications) [V]

| Field | Type | Notes |
|---|---|---|
| `publication_number` | STRING | DOCDB-compatible, e.g. `US-7650331-B1` (hyphen-separated CC-number-kind) |
| `application_number`, `application_number_formatted`, `application_kind` | STRING | |
| `country_code`, `kind_code` | STRING | kind distinguishes application (A1) vs grant (B1/B2) |
| `family_id` | STRING | DOCDB simple family; group on it to collapse a family |
| `title_localized`, `abstract_localized`, `claims_localized`, `description_localized` | REPEATED RECORD (`text` STRING, `language` STRING, `truncated` BOOL) | `truncated` marks XML cut at 9 MB [S] |
| `cpc`, `ipc` | REPEATED RECORD (`code`, `inventive` BOOL, `first` BOOL, `tree` ARRAY) | `tree` holds all ancestor codes, which makes hierarchical filtering trivial |
| `assignee_harmonized`, `inventor_harmonized` | REPEATED RECORD (`name`, `country_code`) | |
| `priority_date`, `filing_date`, `publication_date`, `grant_date` | INTEGER, `YYYYMMDD` | `grant_date = 0` if not granted; `priority_date` = earliest priority or filing date [V] |
| `citation`, `priority_claim`, `entity_status`, `art_unit` | | |

Table size is roughly 0.9 TB (2018 figure, larger now) [V/S], so **never `SELECT *`**; BigQuery bills by columns scanned. Filtering on `publication_date` does not prune bytes unless the table is partitioned (it is not, as far as documented [?]); the cost driver is which columns you touch.

### 3.2 Schema (google_patents_research.publications) [V]

`publication_number`, `title` (English, possibly machine-translated), `title_translated` BOOL, `abstract` (English), `abstract_translated` BOOL (true when Google Translate produced it), `top_terms` ARRAY<STRING>, `embedding_v1` ARRAY<FLOAT>, `url`, plus `cited_by`/`similar` arrays. This is the practical source of **English abstracts for CN/JP/KR** documents; always keep `abstract_translated` and print "machine translation" in the newsletter when true.

### 3.3 Cost model

Free tier: **1 TB of query processing per month and 10 GB storage** without a credit card (BigQuery sandbox) [V/S, BigQuery pricing and third-party summaries]; on-demand price beyond that USD 6.25 per TiB scanned [S, 2026 pricing summaries]. Budget: a weekly query touching `publication_number, family_id, country_code, kind_code, publication_date, cpc, title_localized, abstract_localized, assignee_harmonized` scans an estimated 150-250 GB; four runs a month stay inside the free tier only if we **materialise a niche subset once** and query the subset thereafter (recommended: create `patentsonar.publications_niche` refreshed after each quarterly upstream update).

### 3.4 Example SQL

```sql
-- Niche candidates, last 8 weeks, one row per publication, with English abstract when available
WITH base AS (
  SELECT p.publication_number, p.family_id, p.country_code, p.kind_code,
         p.publication_date, p.filing_date, p.priority_date,
         (SELECT t.text FROM UNNEST(p.title_localized) t WHERE t.language='en' LIMIT 1) AS title_en,
         (SELECT a.text FROM UNNEST(p.abstract_localized) a WHERE a.language='en' LIMIT 1) AS abstract_en,
         ARRAY(SELECT c.code FROM UNNEST(p.cpc) c) AS cpc_codes,
         ARRAY(SELECT h.name FROM UNNEST(p.assignee_harmonized) h) AS assignees
  FROM `patents-public-data.patents.publications` p
  WHERE p.publication_date >= 20260801
    AND p.country_code IN ('US','EP','WO','CN','JP','KR')
    AND EXISTS (SELECT 1 FROM UNNEST(p.cpc) c
                WHERE REGEXP_CONTAINS(c.code, r'^(H01F1/(047|06|08|10|11|113)|C22C22/00|C22C38/001|C01B21/06|C01G49/|C04B35/26|H02K19/1|H02K21/)'))
)
SELECT b.*, r.abstract AS abstract_google_en, r.abstract_translated
FROM base b
LEFT JOIN `patents-public-data.google_patents_research.publications` r USING (publication_number)
WHERE REGEXP_CONTAINS(LOWER(COALESCE(b.title_en,'') || ' ' || COALESCE(b.abstract_en,'') || ' ' || COALESCE(r.abstract,'')),
      r'iron nitride|fe16n2|fe₁₆n₂|mnbi|manganese[- ]bismuth|mnal|manganese[- ]alumin|tau[- ]phase|tetrataenite|l1[0₀][- ]?feni|hexaferrite|la[- ]?co ferrite|rare[- ]earth[- ](free|lean)|free of rare earth|without rare earth|reduced dysprosium|dysprosium[- ]free')
  AND NOT EXISTS (SELECT 1 FROM UNNEST(b.cpc_codes) c WHERE c LIKE 'H01F1/05%')   -- strict RE-free tier
ORDER BY b.publication_date DESC;
```

Family-level roll-up: `SELECT family_id, ARRAY_AGG(publication_number), MIN(priority_date) ... GROUP BY family_id`.

### 3.5 Usefulness for CN/JP/KR

BigQuery is the only free source in our stack with (a) CN/JP/KR bibliographic records, (b) English machine translations of their titles and abstracts, and (c) a family id, all in SQL. Its weakness is latency (quarterly), so it is the **back-fill and translation** layer, while OPS detects the week's new CN/JP/KR publications.

---

## 4. CPC/IPC and keyword strategy

CPC symbols follow `Section Class Subclass Main-group/Sub-group` (e.g. `H01F 1/047`). All titles below come from the USPTO/EPO CPC scheme H01F, C22C, C01B, C01G, C04B, H02K (scheme and definition PDFs at `https://www.uspto.gov/web/patents/classification/cpc/html/cpc-H01F.html` etc.). Titles marked [V] were confirmed from indexed excerpts of the official scheme in this pass; [?] means the code is known to be used for the topic but its exact title text should be re-read from the scheme before it is printed anywhere.

### 4.1 Magnet materials (H01F 1/xx)

| Code | Title (scheme) | Use |
|---|---|---|
| H01F 1/00 | Magnets or magnetic bodies characterised by the magnetic materials therefor; selection of materials for their magnetic properties [V] | root |
| H01F 1/01 > 1/03 > 1/032 | of inorganic materials > characterised by their coercivity > of hard-magnetic materials [V] | hierarchy only |
| H01F 1/04 | metals or alloys [V] | |
| **H01F 1/047** | **Alloys characterised by their composition** [V] | core include: Fe16N2, MnBi, MnAl-C, FeNi patents sit here |
| H01F 1/053 | containing rare earth metals [V] | **exclude / flag** |
| H01F 1/055 | ... and magnetic transition metals, e.g. SmCo5 [V] | exclude |
| H01F 1/057 | ... and IIIa elements, e.g. Nd2Fe14B (R-T-B magnets) [V] | exclude, or include only with RE-lean keywords (Ce/La substitution, reduced Dy) |
| H01F 1/058 | ... and IVa elements [?] | exclude |
| H01F 1/059 | ... and Va elements, e.g. Sm2Fe17N2 [V] | exclude; note the *nitride* trap: Sm2Fe17Nx is an RE nitride, not iron nitride |
| H01F 1/06 | hard-magnetic metals/alloys in the form of particles, e.g. powder [?] | include (powder-route RE-free magnets) |
| H01F 1/08 | ... pressed, sintered or bound together [?] | include (bonded/sintered RE-free) |
| H01F 1/10 | hard-magnetic non-metallic substances, e.g. ferrites [V] | include |
| **H01F 1/11** | ... in the form of particles (hexaferrites (Ba,Sr)O(Fe2O3)6) [V] | include (La-Co, advanced ferrites) |
| H01F 1/113 | ... in a bonding agent [?] | include |

Scheme note: within H01F 1/053-1/059 an alloy is classified in the **last appropriate place** [V], so an RE-containing alloy will always carry at least one 1/05x code; absence of any 1/05x code is a strong RE-free signal.

### 4.2 Alloys and compounds

| Code | Title | Use |
|---|---|---|
| C22C 22/00 | Alloys based on manganese [V] | MnBi, MnAl(-C) |
| C22C 38/00 | Ferrous alloys, e.g. steel alloys [V]; last-place rule applies [V] | Fe-N, Fe-Ni; noisy, always combine with H01F 1/0x or keywords |
| C22C 38/001 | Ferrous alloys containing N [?] | Fe16N2 |
| C22C 38/08 | Ferrous alloys containing nickel [?] | L10 FeNi |
| C22C 19/03 | Alloys based on nickel [?] | some FeNi 50:50 filings |
| C22C 2202/02 | Magnetic materials of the hard type (indexing code) [?] | useful positive filter |
| C01B 21/06 | Binary compounds of nitrogen with metals, silicon or boron (nitrides) [V] | iron nitride synthesis |
| C01B 21/0622 | (sub-group used by iron-nitride powder patents) [?] | verify title |
| C01G 49/00 | Compounds of iron [V] | ferrite chemistry, iron nitride compounds |
| C04B 35/26 | Ferrite ceramics [V]; C04B 35/2683 hexaferrites containing alkaline earth (Ba/Sr) [?] | sintered ferrite magnets |

### 4.3 Motors (H02K)

| Code | Title | Use |
|---|---|---|
| H02K 1/27 | Rotor cores with permanent magnets [V]; 1/276 magnets embedded in the core, 1/2766 flux-concentrating arrangement [?] | PM rotor designs using ferrite/RE-free magnets |
| H02K 19/00 | Synchronous motors or generators (no PM) [V] | |
| H02K 19/10 / 19/103 | reluctance motors; stator windings with variable-reluctance soft-iron rotor [V, from EP3298681 classification] | synchronous reluctance (RE-free by construction) |
| H02K 21/00 | Synchronous motors/generators having permanent magnets [V]; 21/14 magnets rotating within the armature [?] | filter with ferrite/RE-free keywords |
| H02K 1/24, 1/246 | reluctance rotor details [S] | PM-assisted SynRM |

### 4.4 Keyword list (title/abstract/claims only; never description)

Positive terms (case-insensitive, both hyphen and space variants):
`iron nitride`, `Fe16N2`, `alpha''-Fe16N2` / `α″-Fe16N2` / `Fe8N`, `MnBi` / `manganese bismuth`, `MnAl` / `Mn-Al-C` / `manganese aluminium` / `tau phase` / `τ-phase`, `tetrataenite`, `L10 FeNi` / `L1₀-FeNi` / `FeNi ordered`, `hexaferrite` / `strontium ferrite` / `barium ferrite` / `La-Co ferrite` / `La-Co substituted`, `rare earth free` / `rare-earth-free` / `free of rare earth` / `without rare earth` / `rare-earth-lean` / `reduced dysprosium` / `Dy-free` / `heavy rare earth free`, `cerium substituted` / `Ce-Fe-B` / `La-Ce`, `magnet-free motor` / `magnetless` / `synchronous reluctance`.

Negative/noise terms (used for *scoring*, not hard exclusion): `Nd2Fe14B`, `NdFeB`, `neodymium`, `Sm2Fe17`, `SmCo`, `samarium`, `dysprosium` (unless preceded by `reduced|low|free`), `grain boundary diffusion`.

### 4.5 Composite boolean and noise control

Tiering rule applied after retrieval (implemented in SQL/Python, identical across sources):

- **Tier A - RE-free core:** (positive material keyword in title or abstract or independent claim) AND (has any of H01F 1/047, 1/06, 1/08, 1/10, 1/11, C22C 22/00, C01B 21/06, C04B 35/26) AND (no H01F 1/053-1/059 code).
- **Tier B - RE-lean:** has H01F 1/057 (or 1/053) AND (`rare-earth-lean|reduced dysprosium|Dy-free|Ce|La` keyword in title/abstract/claim 1).
- **Tier C - RE-free motor design:** (H02K 19/10x) OR (H02K 1/27 or 21/xx AND `ferrite|rare earth free|magnet-free` keyword).
- **Reject:** any document whose only match is a positive keyword in the *description* or in a *dependent* claim; any NdFeB document that mentions `iron nitride` incidentally (detected as: negative term in title/abstract AND positive term absent from title/abstract/claim 1). PatentsView `_text_phrase` on `patent_abstract`/`patent_title` and `g_claim.claim_sequence = 1` implement this cleanly; BigQuery uses `claims_localized` regex on the first claim; OPS search is limited to `ta` so OPS hits are always re-scored after biblio fetch.

Human review: Tier B and C items are queued for editor confirmation; Tier A auto-passes into the draft.

---

## 5. Other sources (now or later)

| Source | API | Cost / terms | Verdict |
|---|---|---|---|
| **Lens.org** (`https://docs.api.lens.org/`) | Patent & Scholarly REST APIs, JSON | Trial API access 14 days, non-commercial only; commercial/institutional subscription required; individual commercial agreement USD 1,000/yr; API keys "may not be transferred, sold or re-licensed"; attribution to lens.org required; "Commercial Use" is any use with a business outcome [S, about.lens.org terms; S, support.lens.org]. Cambia sold The Lens to a new Australian non-profit, The Lens Limited, on 1 June 2026 [S] | Later, if we want one API with family + legal + CN/JP/KR; budget line needed |
| **WIPO PATENTSCOPE** | Free web UI with WIPO Translate and CLIR; paid SOAP web service and PCT data feeds | PCT-Week CHF 400/yr; PCT-Text XML CHF 2,000/yr; full product non-derivative CHF 3,900/yr, derivative CHF 19,500/yr; web service subscription quoted at CHF 600/yr in one WIPO page and CHF 2,000/yr in another [?]; redistribution requires derivative licence with "added value" [V/S, wipo.int data pages and terms] | Later; WO coverage already comes via OPS/BigQuery. Use the UI manually for machine translation of WO/CN full text |
| **CNIPA** | `pss-system.cponline.cnipa.gov.cn` free after registration, 9 languages; no public REST API documented in English [S] | Unclear for automated/commercial reuse | Manual verification only |
| **J-PlatPat / JPO** | J-PlatPat free UI with English MT; JPO "特許情報取得API" (trial since Jan 2022) returns dossier/status data for JP and IP5 (OPD), not bulk bibliographic search [S, JPO guide v1.3] | Free, registration required, Japanese docs | Manual verification; API not needed for detection |
| **KIPRIS Plus** | REST Open API, 11 data types incl. English abstracts and machine translations; also on data.go.kr [S] | Free up to 1,000 cases/month; flat annual fee USD 1,783 beyond [S, KIPRIS Plus fee page] | Optional later for KR English abstracts if BigQuery lag hurts |
| **USPTO Open Data Portal bulk data** (`https://data.uspto.gov/bulkdata`) | Weekly grant (Tuesday) and PGPub (Thursday) XML; ODP search/PFW APIs | Free, US government work | **Recommended US fallback** for weekly freshness when PatentsView lags; to be specified in a follow-up [?] |

---

## 6. Weekly pipeline architecture

### 6.1 Source roles

| Need | Primary | Secondary / QA |
|---|---|---|
| Detect **new this week** for US, EP, WO, CN, JP, KR | **EPO OPS** `published-data/search` with `pd within` the issue week, CPC + `ta` CQL (DOCDB is updated weekly and covers all six offices) | BigQuery (quarterly) back-fill; USPTO ODP weekly XML for US if OPS misses US grants [?] |
| US grant/PGPub enrichment: claims text, disambiguated assignee, `cpc_current`, foreign priority | **PatentsView** `patent`, `publication`, `g_claim`, `pg_claim` | ODP full-text |
| Family grouping, INPADOC legal status | **OPS** `biblio` (`@family-id`), `/family`, `/legal` | BigQuery `family_id` |
| English abstracts for CN/JP/KR | OPS English abstract when present | BigQuery `google_patents_research.abstract` (flag `abstract_translated`) |
| Historical baselines, landscape counts | **BigQuery** | |

Timing: run every Friday 06:00 UTC (EP/WO publish Wednesdays, US grants Tuesdays, PGPubs Thursdays, CN Tuesdays/Fridays, JP/KR various). Query window = `[issue_end - 21 days, issue_end]` to catch late DOCDB loading; "new this week" is decided by *first-seen*, not by publication date alone (6.3).

### 6.2 Identifier reconciliation

Canonical key: **`CC-NUMBER-KIND`** exactly as BigQuery's `publication_number` (e.g. `US-10068689-B2`, `US-20240012345-A1`, `EP-3298681-A1`, `WO-2015169712-A1`, `CN-118000000-A`). Mapping rules:

| Source | Native id | Normalisation to canonical |
|---|---|---|
| PatentsView `patent` | `patent_id` = `10068689`, `D0912345`, `RE048123`, `PP034567` (no country, no kind) | Prefix `US-`; kind from `patent_type` + `granted_pregrant_crosswalk` (B2 if a PGPub exists, else B1; `S1` design, `E1` reissue, `P2/P3` plant) [?]. Keep the raw id too |
| PatentsView `publication` | `document_number` = `20240012345` (11 digits) | `US-20240012345-A1` (kind A1/A2/A9 from `kind` field if present, default A1 [?]) |
| OPS docdb | `US.10068689.B2` (country.number.kind) | replace `.` with `-` |
| OPS epodoc | `US10068689`, `US2024012345A1` (note: epodoc PGPub numbers may be 10 or 11 digits [?]) | use OPS `number-service` to convert to docdb, then as above |
| BigQuery | `US-10068689-B2` | canonical |

Store `source`, `source_id_raw`, `canonical_pub_id`, `docdb_family_id` in every row; never overwrite raw ids. Unit tests must cover design/reissue/plant ids, EP A1 vs B1, WO with `A1/A2/A3`, JP with `A/B2`, KR `A/B1`, CN `A/B/U`.

### 6.3 Idempotent "new this week"

Tables (Postgres or DuckDB):

- `raw_ingest(source, endpoint, request_hash, response_json, fetched_at, run_id)` - append-only verbatim responses.
- `pub(canonical_pub_id PK, source_ids JSONB, family_id, country, kind, pub_date, filing_date, priority_date, title_en, abstract_en, abstract_is_mt, assignees JSONB, cpc JSONB, tier, first_seen_run_id, last_seen_run_id, payload_hash)`.
- `claims(canonical_pub_id, seq, text, source)`.
- `run(run_id PK, issue_week, started_at, queries JSONB, counts JSONB, status)`.

Algorithm each run: (1) execute the fixed query set (queries are versioned strings in git; the exact CQL/JSON/SQL sent is written to `run.queries`); (2) upsert into `pub` keyed on `canonical_pub_id`, setting `first_seen_run_id` only when inserting; (3) `new_this_week = pub WHERE first_seen_run_id = :run_id AND pub_date BETWEEN issue_start AND issue_end`; `late_additions = first_seen_run_id = :run_id AND pub_date < issue_start`; (4) collapse both sets by `family_id`, marking a family "new" only if no member has an earlier `first_seen_run_id`; (5) emit `issue_<week>.json` with deterministic ordering (family_id, canonical_pub_id). Re-running the same run_id after a crash replays from `raw_ingest` and produces byte-identical output; running a *new* run over the same week yields an empty `new_this_week` set (idempotence).

### 6.4 QA gates (block publication on failure)

1. **Existence:** every token matching `/(US|EP|WO|CN|JP|KR)[- ]?\d{6,12}[- ]?[A-Z]\d?/` in the newsletter body must resolve to a `pub.canonical_pub_id` present in the current or a previous run, and that row must link to at least one `raw_ingest` record.
2. **Field fidelity:** printed title, publication date, assignee and CPC must equal the stored values (exact for dates/ids, normalised-string equality for names).
3. **Claim quotes:** any quoted claim text must match `claims.text` with similarity >= 0.97 (after whitespace normalisation) and the claim number must match `seq`.
4. **Machine translation flag:** if `abstract_is_mt` is true, the paragraph must carry "(machine translation)".
5. **Link check:** each item links to the official record (`https://worldwide.espacenet.com/patent/search?q=pn%3D<epodoc>` or `https://ppubs.uspto.gov/pubwebapp/` for US) and the link returns HTTP 200.
6. **Family consistency:** no two items in one issue share a `family_id` unless explicitly labelled as family members.
7. **Source quota log:** the run stores the last `X-Throttling-Control`, `X-RegisteredQuotaPerWeek-Used`, PatentsView 429 count and BigQuery bytes billed; the editor sees them in the issue checklist.

---

## 7. Licensing and redistribution constraints

| Source | Licence / terms | What we may do | What we must not do |
|---|---|---|---|
| PatentsView | CC BY 4.0, now explicitly applied to PatentSearch API output as well as bulk files; attribution "Source: PatentsView, www.patentsview.org" [V] | Use, adapt, redistribute commercially with attribution | Omit attribution |
| Google Patents Public Data / Research Data | CC BY 4.0, attribute "Google Patents Public Data by IFI CLAIMS Patent Services and Google" [V] | Same as above; include the attribution in the newsletter colophon | Omit attribution; imply IFI/Google endorsement |
| EPO OPS | Terms and Conditions OPS 2.0 (Sept 2017) + Fair use charter (2018). Section 3.1 permits using OPS data "in their own machine-readable databases, products and services" and distributing it "as part of these products"; section 3.2 forbids making "the data as such available to the public"; no royalties (4.6) [V, terms PDF cited via developers.epo.org] | Cite bibliographic facts, family and legal status inside our editorial product | Publish raw OPS dumps, bulk exports or a public mirror of OPS records; exceed fair-use volume; resell the data as data |
| WIPO PATENTSCOPE data products | Paid licences; redistribution only under the derivative licence and with "added value" [V/S] | Nothing until a licence is bought; free UI use is fine for manual checks | Scrape or redistribute PCT feed data |
| Lens.org | Non-commercial by default; commercial use requires subscription; no transfer/re-licensing of API access; attribution to lens.org [S] | Only after signing a commercial agreement | Use trial keys in production |
| KIPRIS Plus | Fee schedule; ToS govern reuse [S] | Up to 1,000 free cases/month for verification | Assume redistribution rights without reading the ToS |
| Underlying facts | Patent numbers, dates, titles, classifications and claims are official public records; the constraints above attach to the *databases and services*, not to the facts | Quote and analyse | Copy database-specific enrichments (e.g. Lens/IFI harmonised names) without permission |

Practical policy: the newsletter cites facts and links to the official register; we never distribute bulk tables derived from OPS or Lens; attribution lines for PatentsView and Google are permanent footer text.

---

## 8. Open items to confirm before implementation

1. PatentsView `publication` endpoint text field names and `foreign_priority` sub-fields (read from Swagger UI).
2. Whether PatentSearch API stays available during the ODP migration; decide on USPTO ODP weekly XML as US fallback.
3. OPS free weekly volume: 4 GB vs 3.5 GB; token TTL; `pd within` separator (space vs comma).
4. Exact scheme titles for H01F 1/06, 1/08, 1/058, 1/113; C22C 38/001, 38/08, 2202/02; C01B 21/0622; C04B 35/2683; H02K 1/276, 1/2766, 21/14 (open the USPTO CPC scheme pages).
5. BigQuery table partitioning and current size; measure bytes billed of the niche query before scheduling.
6. WIPO web-service price (CHF 600 vs 2,000) if we ever need PCT feeds.

---

## Sources

PatentsView / USPTO
- https://search.patentsview.org/docs/
- https://search.patentsview.org/docs/docs/Search%20API/SearchAPIReference/
- https://search.patentsview.org/docs/docs/Search%20API/EndpointDictionary/
- https://search.patentsview.org/swagger-ui/
- https://search.patentsview.org/docs/2024/02/16/2.0-release/
- http://search.patentsview.org/docs/2025/03/11/2.3.1-release/
- https://patentsview.org/forum/7/topic/781 (API rate limits: 45 calls/min, 429 + Retry-After)
- https://patentsview.org/forum/7/topic/94 (Data updates cadence)
- https://patentsview.org/forum/7/topic/106 and https://patentsview.org/forum/7/topic/112 (cpc_current inventional/additional)
- https://patentsview.org/apis/api-query-language (operators)
- https://patentsview.org/about/terms-privacy (CC BY 4.0, attribution)
- https://patentsview-support.atlassian.net/servicedesk/customer/portals (API key request)
- https://www.uspto.gov/ip-policy/economic-research/patentsview (legacy API retired 1 May 2025; ODP migration)
- https://www.uspto.gov/subscription-center/2026/patentsview-releases-q4-2025-data-update
- https://data.uspto.gov/support/transition-guide/patentsview
- https://data.uspto.gov/bulkdata and https://data.uspto.gov/apis/bulk-data/search
- https://catalog.data.gov/dataset/patentsview-patentsearch-api-version-2-3-0
- https://docs.ropensci.org/patentsview/articles/getting-started.html
- https://docs.ropensci.org/patentsview/articles/result-set-paging.html
- https://docs.ropensci.org/patentsview/articles/writing-queries.html
- https://docs.ropensci.org/patentsview/articles/api-changes.html
- https://ropensci.org/blog/2026/03/10/patentsview-breaking-release/
- https://github.com/mustberuss/PatentsView-Code-Snippets/blob/master/07_PatentSearch_API_demo/PV%20PatentSearch%20API%20tutorial.ipynb
- https://github.com/LaszloSomi/uspto-patent-connector/blob/main/API_KEY_SETUP.md
- https://dlthub.com/context/source/patentsview

EPO OPS
- https://developers.epo.org/
- https://developers.epo.org/user/register
- https://developers.epo.org/sites/default/files/terms_and_conditions_OPS%202.0%20EN_DE_FR.pdf
- https://worldwide.espacenet.com/?locale=en_EP&view=fairusecharter
- https://www.epo.org/en/searching-for-patents/data/web-services/ops
- https://github.com/ip-tools/python-epo-ops-client and https://github.com/ip-tools/python-epo-ops-client/blob/main/epo_ops/api.py
- https://pypi.org/project/python-epo-ops-client/
- https://github.com/patent-dev/epo-ops and https://pkg.go.dev/github.com/patent-dev/epo-ops
- https://github.com/abdullahatrash/epo-ops-sdk/blob/main/OPS.md
- https://github.com/navisbio/OPS-patent-search-mcp/blob/main/README.md
- https://github.com/pipeworx-io/mcp-epo-ops
- https://docs.ip-tools.org/patzilla/configure/epo-ops.html
- https://www.interhost.de/opsanmeldung_en.pdf
- https://apify.com/ryanclinton/epo-patent-search
- https://worldwide.espacenet.com/help?locale=en_EP&method=handleHelpTopic&topic=legalstatusqh (INPADOC legal status)
- https://iiindex.org/datasets/docdb/
- https://github.com/bucket-foundation/x402-research-gateway/issues/68 (verified terms summary for EPO, WIPO, Google)

Google Patents Public Datasets / BigQuery
- https://github.com/google/patents-public-data
- https://github.com/google/patents-public-data/blob/master/tables/dataset_Google%20Patents%20Public%20Datasets.md
- https://console.cloud.google.com/marketplace/product/google_patents_public_datasets/google-patents-public-data
- https://cloud.google.com/blog/topics/public-datasets/google-patents-public-datasets-connecting-public-paid-and-private-patent-data
- https://cloud.google.com/bigquery/public-data
- https://cloud.google.com/bigquery/pricing
- https://www.kaggle.com/datasets/bigquery/patents
- https://www.ificlaims.com/news/public-patent-data-now-available-on-google-bigquery/
- https://www.aipla.org/list/innovate-articles/programmatic-patent-searches-using-google-s-bigquery-public-patent-data
- https://airbyte.com/data-engineering-resources/bigquery-pricing

CPC
- https://www.uspto.gov/web/patents/classification/cpc/html/cpc-H01F.html
- https://www.uspto.gov/web/patents/classification/cpc/html/defH01F.html
- https://www.uspto.gov/web/patents/classification/cpc/pdf/cpc-scheme-H01F.pdf
- https://www.uspto.gov/web/patents/classification/cpc/pdf/cpc-definition-H01F.pdf
- https://www.uspto.gov/web/patents/classification/cpc/html/cpc-C22C.html and .../pdf/cpc-definition-C22C.pdf
- https://www.uspto.gov/web/patents/classification/cpc/html/defC01B.html
- https://www.uspto.gov/web/patents/classification/cpc/pdf/cpc-scheme-C01G.pdf
- https://www.uspto.gov/web/patents/classification/cpc/html/cpc-C04B.html
- https://www.uspto.gov/web/patents/classification/cpc/html/cpc-H02K.html and .../html/defH02K.html
- https://www.cooperativepatentclassification.org/sites/default/files/cpc/definition/H/definition-H02K.pdf
- https://patents.google.com/patent/WO2015169712A1/en (MnBi, H01F1/047)
- https://patents.google.com/patent/US10068689B2/en (iron nitride permanent magnet)
- https://patents.google.com/patent/US20150110664A1/en (MnBi process, H01F1/047)
- https://patents.google.com/patent/EP2003657A2/en (ferrite powder, H01F1/11)
- https://data.epo.org/gpi/EP3298681A1 (PM-assisted synchronous reluctance motor; H02K1/246, 1/2766, 19/103, 21/14)

Other sources and terms
- https://about.lens.org/lens-api-terms-of-use/
- https://about.lens.org/policies/
- https://about.lens.org/individual-commercial-use/
- https://about.lens.org/changes-to-accounts/
- https://support.lens.org/knowledge-base/lens-patent-and-scholar-api/
- https://docs.api.lens.org/
- https://www.wipo.int/en/web/patentscope/data/index
- https://www.wipo.int/en/web/patentscope/data/terms
- https://www.wipo.int/en/web/patentscope/data/terms_patentscope
- https://www.wipo.int/en/web/ai-tools-services/wipo-translate
- https://cnipa.ai/blog/chinese-patent-search-guide
- https://english.cnipa.gov.cn/
- https://www.jpo.go.jp/system/laws/sesaku/data/api-provision.html
- https://ip-data.jpo.go.jp/files/%E7%89%B9%E8%A8%B1%E6%83%85%E5%A0%B1%E5%8F%96%E5%BE%97API%E3%81%AE%E5%88%A9%E7%94%A8%E3%81%AE%E6%89%8B%E5%BC%95%E3%81%8Dv1.3.pdf
- https://www.j-platpat.inpit.go.jp/
- https://plus.kipris.or.kr/eng/use/paymentMmg.do?menuNo=310105
- https://plus.kipris.or.kr/eng/main/contents.do?menuNo=300024
- https://www.data.go.kr/data/15065437/openapi.do
- https://wipo-analytics.github.io/manual/databases.html
- https://www.patsnap.com/resources/blog/articles/rare-earth-free-magnets-2026-mnbi-and-fe%E2%82%81%E2%82%86n%E2%82%82/
- https://patents.justia.com/assignee/niron-magnetics-inc
