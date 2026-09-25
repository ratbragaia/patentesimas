-- Google Patents Public Data (BigQuery). Run weekly with the window parameters.
-- Free tier: 1 TB processed/month. Restrict columns + partition on publication_date to stay cheap.
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
    PARSE_DATE('%Y%m%d', CAST(priority_date AS STRING))    AS priority_date,
    PARSE_DATE('%Y%m%d', CAST(filing_date AS STRING))      AS filing_date,
    PARSE_DATE('%Y%m%d', CAST(publication_date AS STRING)) AS publication_date,
    PARSE_DATE('%Y%m%d', CAST(grant_date AS STRING))       AS grant_date,
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
