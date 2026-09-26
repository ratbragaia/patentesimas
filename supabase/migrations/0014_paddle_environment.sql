-- Paddle sandbox and live can both post webhooks to the same server (ADR 0004 update 2026-09-26). Test data is
-- tagged and kept out of revenue and delivery views. Re-runnable.
set search_path to ps, public;
alter table ps.billing_events add column if not exists environment text not null default 'production' check (environment in ('production','sandbox'));
alter table ps.customers      add column if not exists environment text not null default 'production' check (environment in ('production','sandbox'));
alter table ps.subscriptions  add column if not exists environment text not null default 'production' check (environment in ('production','sandbox'));

create or replace view ps.v_active_recipients as
  select s.id as subscriber_id, s.email, s.full_name, s.unsubscribe_token, sub.plan_code, c.legal_name
  from ps.subscribers s
  join ps.subscriptions sub on sub.id = s.subscription_id
  join ps.customers c on c.id = sub.customer_id
  where s.active and sub.status in ('trialing','active','past_due') and sub.environment = 'production'
    and not exists (select 1 from ps.do_not_contact d where d.email = s.email);

create or replace view ps.v_mrr as
  select coalesce(sum(p.price_usd_month * sub.seats),0) as mrr_usd, count(*) as active_subscriptions
  from ps.subscriptions sub join ps.plans p on p.code = sub.plan_code
  where sub.status in ('active','past_due') and sub.environment = 'production';
