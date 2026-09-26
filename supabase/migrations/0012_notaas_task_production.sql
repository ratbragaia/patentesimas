-- 2026-09-26: the founder's Notaas account is production (A1 certificate uploaded, other NFS-e already issued
-- under the same CNPJ). Validation must not emit a test note. Idempotent.
set search_path to ps, public;
update ps.tasks
set title = 'Notaas (PRODUÇÃO, não emitir teste): ler docs.notaas.com.br, alinhar toNotaasPayload() em src/invoicing/nfse.ts (tomador no exterior, exportação, cTribNac 1.09) ao esquema real usando apenas `npm run cli -- invoices preview`; se a Notaas oferecer ambiente de homologação separado, emitir uma nota lá; caso contrário, não emitir nada. Ao terminar, NOTAAS_SCHEMA_CONFIRMED=1 no env. A primeira nota real é o primeiro repasse do Paddle.',
    payload = payload || '{"production_account": true, "never_emit_test_in_production": true, "blocked_on": null}'::jsonb,
    status = case when status = 'blocked' then 'pending' else status end
where title like 'Notaas: read docs.notaas.com.br%' or title like 'Notaas (PRODUÇÃO%';
