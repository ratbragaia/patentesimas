-- Google Patents Public Data (BigQuery). Run WEEKLY (Monday ingest) with a 45-day trailing window (ADR 0009).
-- Cost (measured 2026-09-26): ~268 GB per run regardless of window (table is not partitioned; the scan is
-- driven by the columns read). ~1.15 TB/month at weekly cadence => ~US$1/month above the free tier; capped
-- per run by --maximum_bytes_billed in src/patents/bigquery.ts.
-- Dates are INT64 yyyymmdd with 0 for 'unknown' => NULLIF before parsing (see ADR 0009).
-- Covers CN/JP/KR/WO with English `title_localized`/`abstract_localized` when available.
DECLARE window_start DATE DEFAULT @window_start;
DECLARE window_end   DATE DEFAULT @window_end;

WITH base AS (
  SELECT
    publication_number, country_code, kind_code, CAST(family_id AS STRING) AS family_id,
    (SELECT text FROM UNNEST(title_localized)    WHERE language = 'en' LIMIT 1) AS title_en,
    (SELECT text FROM UNNEST(abstract_localized) WHERE language = 'en' LIMIT 1) AS abstract_en,
    ARRAY(SELECT code FROM UNNEST(cpc)) AS cpc_codes,
    ARRAY(SELECT name FROM UNNEST(assignee_harmonized)) AS applicants,
    ARRAY(SELECT name FROM UNNEST(inventor_harmonized)) AS inventors,
    SAFE.PARSE_DATE('%Y%m%d', CAST(NULLIF(priority_date, 0) AS STRING))    AS priority_date,
    SAFE.PARSE_DATE('%Y%m%d', CAST(NULLIF(filing_date, 0) AS STRING))      AS filing_date,
    SAFE.PARSE_DATE('%Y%m%d', CAST(NULLIF(publication_date, 0) AS STRING)) AS publication_date,
    SAFE.PARSE_DATE('%Y%m%d', CAST(NULLIF(grant_date, 0) AS STRING))       AS grant_date,
    application_number
  FROM `patents-public-data.patents.publications`
  WHERE publication_date BETWEEN CAST(FORMAT_DATE('%Y%m%d', window_start) AS INT64)
                             AND CAST(FORMAT_DATE('%Y%m%d', window_end)   AS INT64)
    AND country_code IN ('CN','JP','KR','WO','EP','US','DE','TW')
)
SELECT * FROM base
WHERE EXISTS (SELECT 1 FROM UNNEST(cpc_codes) c WHERE
        STARTS_WITH(c,'H01F1/047') OR STARTS_WITH(c,'H01F1/06') OR STARTS_WITH(c,'H01F1/08')
     OR STARTS_WITH(c,'H01F1/1')   OR STARTS_WITH(c,'C04B35/26') OR STARTS_WITH(c,'C01B21/06')
     OR STARTS_WITH(c,'C22C22/00') OR STARTS_WITH(c,'H02K19/10') OR STARTS_WITH(c,'H02K1/246'))
   OR REGEXP_CONTAINS(LOWER(CONCAT(IFNULL(title_en,''),' ',IFNULL(abstract_en,''))),
        r'iron nitride|fe16n2|mnbi|manganese bismuth|mnal|manganese alumin|tetrataenite|l10 feni|hexaferrite|strontium ferrite|barium ferrite|la-co ferrite|rare[- ]earth[- ]free|free of rare earth|without rare earth|rare[- ]earth[- ]lean|reduced dysprosium|dysprosium-free|cerium magnet|ce-substituted');
