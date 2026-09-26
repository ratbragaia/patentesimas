-- Follow-ups from the legal review (ADR 0014). Idempotent.
set search_path to ps, public;
insert into ps.tasks (agent, title, priority, payload)
select 'finance', 'Cloudflare Email Routing: rotear billing@, legal@, privacy@ e support@patentsonar.com para o Email Worker de entrada (token tem Email Routing Rules Edit); manter founder@ → caixa do fundador; testar um e-mail em cada', 2,
       '{"adr": "0014"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'Cloudflare Email Routing: rotear billing@%');
