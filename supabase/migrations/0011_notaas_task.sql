-- Follow-up from research 06 (2026-09-26). Idempotent.
set search_path to ps, public;
insert into ps.tasks (agent, title, priority, payload)
select 'finance', 'Notaas: read docs.notaas.com.br, align toNotaasPayload() (tomador no exterior, exportação, cTribNac 1.09) with the real schema, issue one NFS-e in the sandbox, then set NOTAAS_SCHEMA_CONFIRMED=1 in /etc/patentsonar/env', 3,
       '{"adr": "0002", "research": "06", "blocked_on": "founder: Notaas account + A1 certificate (handoff item 12)"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'Notaas: read docs.notaas.com.br%');
