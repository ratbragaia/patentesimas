-- PatentSonar — company memory schema
-- Apply with: psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql
-- All tables live in schema `ps`. Service-role key only; no anon access.

create extension if not exists pgcrypto;
create schema if not exists ps;
set search_path to ps, public;

-- ---------- utilities ----------
create or replace function ps.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ---------- CRM: accounts, contacts, leads ----------
create type ps.account_segment as enum (
  'magnet_producer','automaker','emotor','wind','defense_aerospace','materials_chemicals',
  'consumer_electronics','industrial_motors','research_institute','investor','other');
create type ps.lead_stage as enum (
  'identified','researched','contacted','replied','qualified','trial','negotiation','won','lost','do_not_contact');

create table ps.accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text,
  country char(2),
  segment ps.account_segment not null default 'other',
  priority char(1) check (priority in ('A','B','C')) default 'B',
  why_they_care text,
  evidence_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);
create trigger accounts_updated before update on ps.accounts for each row execute function ps.set_updated_at();

create table ps.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ps.accounts(id) on delete cascade,
  full_name text,
  title text,
  email text,
  country char(2),
  source text,              -- how the contact was found (public page, conference list, ...)
  source_url text,
  consent_basis text,       -- 'legitimate_interest_b2b' | 'opt_in' | 'customer'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email)
);
create trigger contacts_updated before update on ps.contacts for each row execute function ps.set_updated_at();

create table ps.leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references ps.accounts(id) on delete cascade,
  contact_id uuid references ps.contacts(id) on delete set null,
  stage ps.lead_stage not null default 'identified',
  owner_agent text default 'prospecting',
  next_action text,
  next_action_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger leads_updated before update on ps.leads for each row execute function ps.set_updated_at();
create index on ps.leads (stage, next_action_at);

-- Suppression list: honoured before ANY outbound email.
create table ps.do_not_contact (
  email text primary key,
  domain text,
  reason text not null,      -- 'unsubscribed' | 'complaint' | 'bounce' | 'requested' | 'legal'
  created_at timestamptz not null default now()
);
create index on ps.do_not_contact (domain);

-- ---------- Outreach ----------
create table ps.outreach_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references ps.leads(id) on delete cascade,
  contact_id uuid references ps.contacts(id) on delete cascade,
  direction text not null check (direction in ('outbound','inbound')),
  sequence_step int,
  subject text,
  body text,
  provider_message_id text unique,
  compliance_checked boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index on ps.outreach_messages (contact_id, created_at);

-- ---------- Customers & subscriptions ----------
create type ps.subscription_status as enum ('trialing','active','past_due','paused','canceled');

create table ps.customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references ps.accounts(id),
  legal_name text not null,
  billing_email text not null,
  country char(2),
  tax_id text,
  paddle_customer_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger customers_updated before update on ps.customers for each row execute function ps.set_updated_at();

create table ps.plans (
  code text primary key,                 -- 'analyst' | 'team' | 'enterprise'
  name text not null,
  price_usd_month numeric(10,2) not null,
  price_usd_year numeric(10,2),
  seats int not null default 1,
  features jsonb not null default '{}'::jsonb,
  paddle_price_id_month text,
  paddle_price_id_year text,
  active boolean not null default true
);

create table ps.subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ps.customers(id) on delete cascade,
  plan_code text not null references ps.plans(code),
  status ps.subscription_status not null,
  paddle_subscription_id text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  seats int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger subscriptions_updated before update on ps.subscriptions for each row execute function ps.set_updated_at();

-- Recipients of the newsletter (customer seats). Suppression is checked at send time.
create table ps.subscribers (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references ps.subscriptions(id) on delete cascade,
  email text not null,
  full_name text,
  active boolean not null default true,
  unsubscribe_token text not null unique default encode(gen_random_bytes(16),'hex'),
  created_at timestamptz not null default now(),
  unique (subscription_id, email)
);

-- ---------- Billing events (idempotency) ----------
create table ps.billing_events (
  event_id text primary key,             -- Paddle event_id (or our idempotency key)
  event_type text not null,
  occurred_at timestamptz,
  payload jsonb not null,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz not null default now()
);

create table ps.invoices (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,  -- e.g. paddle transaction id
  customer_id uuid not null references ps.customers(id),
  subscription_id uuid references ps.subscriptions(id),
  paddle_transaction_id text unique,
  amount_usd numeric(12,2) not null,
  amount_brl numeric(12,2),
  fx_rate numeric(12,6),
  status text not null default 'pending' check (status in ('pending','issued','failed','canceled')),
  nfeio_invoice_id text unique,
  nfse_number text,
  issued_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger invoices_updated before update on ps.invoices for each row execute function ps.set_updated_at();

create table ps.spend_approvals (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount_usd numeric(12,2) not null,
  vendor text,
  approved_by text not null default 'agent-logged',  -- logged, founder notified
  notified_founder_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Patent data (the product) ----------
create table ps.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('patentsview','epo_ops','bigquery')),
  window_start date not null,
  window_end date not null,
  status text not null default 'running' check (status in ('running','succeeded','failed')),
  fetched int default 0,
  inserted int default 0,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

-- One row per publication (application or grant), any office. Source of truth for QA.
create table ps.patent_publications (
  publication_number text primary key,        -- normalised: CC-NUMBER-KIND e.g. US-12345678-B2
  country_code char(2) not null,
  kind_code text,
  family_id text,                              -- DOCDB family id (EPO) or BigQuery family_id
  title text,
  abstract text,
  applicants text[] default '{}',
  inventors text[] default '{}',
  cpc_codes text[] default '{}',
  priority_date date,
  filing_date date,
  publication_date date not null,
  grant_date date,
  application_number text,
  source text not null,                        -- which API supplied the row
  source_payload jsonb,                        -- raw response for audit
  matched_terms text[] default '{}',           -- which niche terms/CPCs matched
  first_seen_at timestamptz not null default now()
);
create index on ps.patent_publications (publication_date desc);
create index on ps.patent_publications (family_id);
create index on ps.patent_publications using gin (cpc_codes);

-- Deduplicated families with editorial layer.
create table ps.patent_families (
  family_id text primary key,
  representative_publication text references ps.patent_publications(publication_number),
  earliest_priority_date date,
  offices char(2)[] default '{}',
  technology_bucket text,                      -- 'iron_nitride' | 'mnbi' | 'mnal' | 'ferrite' | 'feni_l10' | 're_lean' | 'motor_topology' | 'other'
  relevance_score numeric(4,2),
  analyst_summary text,                        -- plain-English strategic note (agent-written)
  triage_status text not null default 'new' check (triage_status in ('new','include','exclude','watch')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger families_updated before update on ps.patent_families for each row execute function ps.set_updated_at();

-- ---------- Content ----------
create table ps.issues (
  id uuid primary key default gen_random_uuid(),
  issue_number int not null unique,
  kind text not null default 'weekly' check (kind in ('weekly','monthly_report','special')),
  title text not null,
  period_start date not null,
  period_end date not null,
  markdown text,
  html text,
  family_ids text[] default '{}',              -- every family cited; QA cross-checks against patent_families
  qa_passed boolean not null default false,
  qa_report jsonb,
  status text not null default 'draft' check (status in ('draft','qa_failed','ready','sent')),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger issues_updated before update on ps.issues for each row execute function ps.set_updated_at();

create table ps.deliveries (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references ps.issues(id) on delete cascade,
  subscriber_id uuid not null references ps.subscribers(id) on delete cascade,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued','sent','bounced','complained','failed')),
  sent_at timestamptz,
  unique (issue_id, subscriber_id)              -- idempotent send
);

-- ---------- Task queue (orchestrator memory) ----------
create table ps.tasks (
  id uuid primary key default gen_random_uuid(),
  agent text not null,                          -- market-research | prospecting | sales | production | finance | reporting | orchestrator
  title text not null,
  payload jsonb default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','in_progress','blocked','done','canceled')),
  priority int not null default 5,
  due_at timestamptz,
  outcome text,
  attempts int not null default 0,
  locked_by text,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger tasks_updated before update on ps.tasks for each row execute function ps.set_updated_at();
create index on ps.tasks (status, priority, due_at);

-- ---------- Audit log ----------
create table ps.audit_log (
  id bigserial primary key,
  actor text not null,
  action text not null,
  entity text,
  entity_id text,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- Views ----------
create view ps.v_active_recipients as
  select s.id as subscriber_id, s.email, s.full_name, s.unsubscribe_token, sub.plan_code, c.legal_name
  from ps.subscribers s
  join ps.subscriptions sub on sub.id = s.subscription_id
  join ps.customers c on c.id = sub.customer_id
  where s.active and sub.status in ('trialing','active','past_due')
    and not exists (select 1 from ps.do_not_contact d where d.email = s.email);

create view ps.v_funnel as
  select stage, count(*) as n from ps.leads group by stage;

create view ps.v_mrr as
  select coalesce(sum(p.price_usd_month * sub.seats),0) as mrr_usd, count(*) as active_subscriptions
  from ps.subscriptions sub join ps.plans p on p.code = sub.plan_code
  where sub.status in ('active','past_due');

-- ---------- RLS: lock everything to service role ----------
do $$ declare t record; begin
  for t in select tablename from pg_tables where schemaname = 'ps' loop
    execute format('alter table ps.%I enable row level security', t.tablename);
  end loop;
end $$;
