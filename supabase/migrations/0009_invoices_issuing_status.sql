-- Notaas issues asynchronously (POST /emitir → 202, then polling). An invoice row is marked 'issuing' BEFORE
-- the provider call so a crash between the call and the DB update never re-issues (idempotent money, rule 2).
set search_path to ps, public;
alter table ps.invoices drop constraint if exists invoices_status_check;
alter table ps.invoices add constraint invoices_status_check check (status in ('pending','issuing','issued','failed','canceled'));
