-- ADR 0002 (revised 2026-09-26): NFS-e are issued per Paddle payout to the Paddle entity on the reverse
-- invoice, not per end-customer transaction. Re-runnable.
set search_path to ps, public;
alter table ps.invoices alter column customer_id drop not null;
alter table ps.invoices add column if not exists paddle_payout_id text unique;
alter table ps.invoices add column if not exists payer_entity text;          -- 'UK' | 'US' | 'IE' (Paddle entity code, src/lib/company.ts)
alter table ps.invoices add column if not exists payout_date date;
alter table ps.invoices add column if not exists reverse_invoice_ref text;   -- Paddle reverse invoice number, for reconciliation
alter table ps.invoices add column if not exists federal_service_code text;  -- LC 116 item printed on the NFS-e (1.09)
alter table ps.invoices add column if not exists taxation_type text;         -- 'Export' for foreign payers
