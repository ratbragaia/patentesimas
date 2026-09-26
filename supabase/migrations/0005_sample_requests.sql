-- Sample-issue requests from the website form (POST /api/sample-request on the webhook server).
-- Replaces the third-party formsubmit.co action: the request is stored here, a `sales` task is
-- queued and the founder is notified on Telegram. Re-runnable.
set search_path to ps, public;

create table if not exists ps.sample_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_domain text generated always as (split_part(lower(email), '@', 2)) stored,
  company text,
  source text not null default 'site',            -- 'site' | 'manual' | 'referral'
  status text not null default 'new' check (status in ('new','sent','declined','spam')),
  request_count int not null default 1,           -- same email asking again bumps this, never a duplicate row
  last_requested_at timestamptz not null default now(),
  ip_hash text,                                   -- sha256(ip + daily salt); never the raw IP
  user_agent text,
  consent_text text,                              -- exact wording shown next to the form when submitted
  sent_issue_number int,
  sent_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists sample_requests_email_lower_idx on ps.sample_requests (lower(email));
create index if not exists sample_requests_status_created_idx on ps.sample_requests (status, created_at);
create or replace trigger sample_requests_updated before update on ps.sample_requests for each row execute function ps.set_updated_at();
alter table ps.sample_requests enable row level security;

-- Atomic insert-or-bump, used by the endpoint. Returns the row and whether it was new.
create or replace function ps.record_sample_request(
  p_email text, p_company text, p_source text, p_ip_hash text, p_user_agent text, p_consent_text text)
returns table (request_id uuid, is_new boolean, requests int) language plpgsql as $$
declare v_id uuid; v_new boolean; v_count int;
begin
  insert into ps.sample_requests (email, company, source, ip_hash, user_agent, consent_text)
  values (lower(trim(p_email)), nullif(trim(p_company), ''), coalesce(p_source, 'site'), p_ip_hash, p_user_agent, p_consent_text)
  on conflict (lower(email)) do update
    set request_count = ps.sample_requests.request_count + 1,
        last_requested_at = now(),
        company = coalesce(nullif(trim(excluded.company), ''), ps.sample_requests.company),
        ip_hash = excluded.ip_hash, user_agent = excluded.user_agent
  returning ps.sample_requests.id, (xmax = 0), ps.sample_requests.request_count into v_id, v_new, v_count;
  return query select v_id, v_new, v_count;
end $$;
