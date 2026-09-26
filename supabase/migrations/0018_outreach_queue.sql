-- Outreach mailer (ADR 0003 amendment): drafts wait in ps.outreach_messages with sent_at null; the mailer
-- re-checks compliance, sends through the outreach mailbox (SMTP) and records the result. Re-runnable.
set search_path to ps, public;
alter table ps.outreach_messages add column if not exists error text;
alter table ps.outreach_messages add column if not exists template text;           -- 'first_touch' | 'follow_up' | 'reply'
alter table ps.outreach_messages add column if not exists to_email text;           -- denormalised for the mailer and reconciliation
create index if not exists outreach_messages_queue_idx on ps.outreach_messages (direction, sent_at) where sent_at is null;
