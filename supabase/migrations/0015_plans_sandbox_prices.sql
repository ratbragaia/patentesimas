-- Paddle price ids differ per environment; keep sandbox ids beside the live ones (ADR 0004 update). Re-runnable.
set search_path to ps, public;
alter table ps.plans add column if not exists paddle_price_id_month_sandbox text;
alter table ps.plans add column if not exists paddle_price_id_year_sandbox text;
alter table ps.plans add column if not exists paddle_product_id text;
alter table ps.plans add column if not exists paddle_product_id_sandbox text;
