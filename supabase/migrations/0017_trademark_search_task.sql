-- Trademark clearance delegated to the VPS session (unrestricted egress). ADR 0014. Idempotent.
set search_path to ps, public;
insert into ps.tasks (agent, title, priority, payload)
select 'market-research', 'Busca de anterioridade da marca "PatentSonar" / "Patent Sonar" (e variações "Patent Sonar", "PatSonar") nas bases oficiais: INPI (busca.inpi.gov.br, classes 35, 42 e 45, radical e exata), EUIPO eSearch plus / TMview, USPTO Trademark Search, WIPO Global Brand Database. Registrar em docs/research/07-trademark-clearance.md: marcas idênticas ou semelhantes encontradas, classes, titulares, status, e um veredito (livre / risco baixo / conflito). Sem depósito ainda; o depósito no INPI exige login gov.br e pagamento de GRU pelo fundador (tarefa separada quando houver receita).', 3,
       '{"adr": "0014", "output": "docs/research/07-trademark-clearance.md"}'::jsonb
where not exists (select 1 from ps.tasks where title like 'Busca de anterioridade da marca%');
