-- 2026-09-26: no homologação project on the free Notaas plan; schema aligned from the docs; first real note gated by the founder.
set search_path to ps, public;
update ps.tasks set status = 'done', outcome = 'Payload alinhado à documentação do Notaas (sessão VPS). Sem projeto de homologação no plano gratuito; a primeira NFS-e real é aprovada pelo fundador no Telegram (ADR 0002).'
where (title like 'Notaas (PRODUÇÃO%' or title like 'Notaas: read docs%') and status <> 'done';
