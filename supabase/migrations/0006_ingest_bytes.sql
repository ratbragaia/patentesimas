-- BigQuery cost accounting (ADR 0009/0011): bytes processed per run, so the monthly free-tier
-- position (1 TB) can be read from ps.ingest_runs instead of the GCP console.
set search_path to ps, public;
alter table ps.ingest_runs add column if not exists bytes_processed bigint;
alter table ps.ingest_runs add column if not exists mode text;   -- 'monthly' | 'backfill' | 'file' (bigquery only)
create or replace view ps.v_bigquery_month as
  select date_trunc('month', started_at)::date as month, count(*) as runs,
         coalesce(sum(bytes_processed),0) as bytes_processed,
         round(coalesce(sum(bytes_processed),0) / 1e9) as gb_processed
  from ps.ingest_runs where source = 'bigquery' group by 1 order by 1 desc;
