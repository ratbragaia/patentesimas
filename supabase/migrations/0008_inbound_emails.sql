-- Inbound email (Cloudflare Email Routing → Email Worker → /webhooks/inbound). One row per message,
-- idempotent on message_id; a `sales` task is opened per new message (ADR 0010).
set search_path to ps, public;

create table if not exists ps.inbound_emails (
  id uuid primary key default gen_random_uuid(),
  message_id text unique,                 -- RFC 5322 Message-ID (may be null on malformed mail → falls back to a content hash)
  content_hash text not null unique,      -- sha256 of raw MIME, dedups retries even without Message-ID
  from_email text not null,
  from_name text,
  to_email text not null,                 -- envelope recipient (support@, hello@, reply address...)
  subject text,
  text_body text,
  html_body text,
  in_reply_to text,
  references_ids text[] default '{}',
  headers jsonb default '{}'::jsonb,
  raw_size int,
  received_at timestamptz not null default now(),
  task_id uuid references ps.tasks(id) on delete set null,
  replied_at timestamptz,
  status text not null default 'new' check (status in ('new','answered','ignored','suppressed'))
);
create index if not exists inbound_emails_status_received_at_idx on ps.inbound_emails (status, received_at);
create index if not exists inbound_emails_from_email_idx on ps.inbound_emails (from_email);
