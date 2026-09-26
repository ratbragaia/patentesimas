-- Follow-up tasks from the 2026-09-26 cloud session (ADR 0010/0011). Idempotent (keyed by title).
set search_path to ps, public;

insert into ps.tasks (agent, title, priority, payload)
select 'production', 'Triage the families first published in August 2026 and the trailing-12-month top applicants before the landscape report 202608 is sent (cli report monthly 2026-08 rebuilds it)', 2,
       '{"issue_number": 202608, "adr": "0011"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'Triage the families first published in August 2026%');

insert into ps.tasks (agent, title, priority, payload)
select 'production', 'BigQuery: most CN rows have empty assignee_harmonized ("applicant not recorded"); evaluate raw assignee (Chinese) + translation or the google_patents_research table for applicant names', 3,
       '{"adr": "0011"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'BigQuery: most CN rows have empty assignee_harmonized%');

insert into ps.tasks (agent, title, priority, payload)
select 'finance', 'Friday cycle: delete ps.sample_requests older than 12 months that never became customers (privacy notice retention, ADR 0010)', 6,
       '{"adr": "0010", "recurring": "monthly"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'Friday cycle: delete ps.sample_requests older than 12 months%');

-- The endpoint smoke test of 2026-09-26 (source ops-test) is not a lead.
update ps.sample_requests set status = 'declined', notes = 'endpoint smoke test from the cloud session, 2026-09-26' where source = 'ops-test' and status = 'new';
update ps.tasks set status = 'canceled', outcome = 'endpoint smoke test, not a lead' where agent = 'sales' and status = 'pending' and payload->>'source' = 'ops-test';
