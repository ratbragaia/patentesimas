# ADR 0002 — Fiscal parameters for the service export (NFS-e, ISS, PIS/COFINS, IRPJ/CSLL)

Date: 2026-09-25 · **Revised 2026-09-26** · Status: **accepted** (decided by the agent at the founder's request,
after research in `docs/research/05-fiscal-export-parameters.md`; the founder judged the accountant's input
unreliable). Two form-filling checks remain open (see "Residual checks").

## Entity
Rockfort Hub de Inovação Ltda (trading as PatentSonar), CNPJ 40.435.866/0001-40, Av. Tiradentes 209, Centro,
São João del Rei/MG, 36307-346. **Lucro Presumido.** CNAE 63.19-4-00 (portais, provedores de conteúdo e outros
serviços de informação na internet). Constants in `src/lib/company.ts`.

## Decision

| Parameter | Value | Basis |
|---|---|---|
| Who receives the NFS-e | **The Paddle entity named on each reverse invoice** (Paddle.com Market Ltd, UK; Paddle.com Inc., US; Paddle Payments Ltd, IE), tomador no exterior, no CNPJ/CPF | Paddle is the reseller/seller of record; we may not invoice buyers (Paddle MSA); Paddle's reverse invoice is our sales document (research 05 §1) |
| Amount and cadence | **One NFS-e per payout, for the payout amount (net)**, issued in BRL at **PTAX (venda) of the payout date** (previous business day if none), within the same month | Revenue under a reseller model is what the reseller pays us; matches the ingresso de divisas amount |
| Service code | **LC 116 item 1.09** (federal); municipal `cityServiceCode` taken from NFe.io's São João del Rei table at onboarding; fallback 17.01 if 1.09 is absent | research 05 §2 |
| ISS | **Not due: export of services** (LC 116 art. 2, I); NFS-e marked *Exportação de serviço*, ISS 0 | research 05 §3 |
| PIS / COFINS | **Exempt on export revenue** (MP 2.158-35 art. 14, III and §1); funds may stay abroad (Lei 11.371/2006; COSIT 179/2025) | research 05 §4 |
| IRPJ / CSLL | Presumption 32%; IRPJ 15% (+10% above R$60k/quarter), CSLL 9%; quarterly DARFs | Lei 9.249/95 arts. 15 and 20 (research 05 §5) |
| Evidence per payout | Paddle reverse invoice + statement, Wise/Payoneer credit, exchange receipt on conversion; resources kept abroad reported in the ECF | research 05 §4 |
| Domestic sale (if ever) | NFS-e to the customer, ISS at the municipal rate, PIS 0.65% + COFINS 3%; needs a separate `taxationType` | not implemented until a Brazilian customer exists |

## Implementation
- `ps.invoices` is keyed by **Paddle payout** (`paddle_payout_id`, migration 0010); `customer_id` became
  nullable; per-transaction rows are no longer created (Paddle transactions live in `billing_events` and
  `subscriptions` for reconciliation).
- `cli invoices enqueue-payout <payout_id> <UK|US|IE> <usd> <YYYY-MM-DD> [reverse_invoice_ref]` records a
  payout; the daily `invoices issue` timer converts at PTAX and calls NFe.io with `taxationType: Export`,
  `federalServiceCode: 1.09`, borrower = the Paddle entity. Until `NFEIO_CITY_SERVICE_CODE` is set (NFe.io
  onboarding), invoices stay `pending` with a clear error, never guessed.
- Finance agent: Friday reconciliation = Paddle payouts/reverse invoices of the month ↔ `ps.invoices` ↔ NFS-e
  issued ↔ Wise credits. Every reverse invoice has exactly one issued NFS-e for the same amount.

## Residual checks (form-filling, not design)
1. Confirm in NFe.io's municipality table that São João del Rei (Nfiss) offers item 1.09 for this CNAE and
   how it labels export non-incidence (`taxationType` value). Done during NFe.io onboarding.
2. Confirm with whoever files the ECF that the Wise Business USD balance is reported as export resources kept
   abroad. One paid hour of a tax professional is within the spend cap and recommended before the first NFS-e.

## Consequences
- The briefing's Simples Nacional assumptions (research 04 §5) no longer apply; effective tax on export
  revenue is ≈7.68% (IRPJ+CSLL) up to R$187.5k/quarter.
- Pricing (ADR 0001) is unaffected: prices are set in USD to the buyer; Paddle's fee and our taxes come out of
  the payout.
