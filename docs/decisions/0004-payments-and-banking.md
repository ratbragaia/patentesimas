# ADR 0004 — Paddle as merchant of record; USD receiving account

Date: 2026-09-25 · Status: accepted, with two confirmations pending

## Findings (`docs/research/04-compliance-and-payments.md` §3–4)
- Paddle supports sellers in Brazil (excluded only sanctioned countries); fee 5% + US$0.50; payouts
  by bank transfer, PayPal or Payoneer, US$100 minimum; B2B features: tax-ID reverse charge,
  invoices, manual invoicing for enterprise; webhooks at-least-once with HMAC signature (implemented
  in `src/billing/paddle.ts`). Confidence medium-high (help page seen via search excerpt only).
- Wise Business accepts Brazilian CNPJs only for EI/MEI, Ltda/SLU and single-lawyer firms; owner
  must hold the personal Wise account; R$250 activation; USD balance supported; BRL-origin transfer
  caps apply.
- Fallbacks if Paddle declines the business: Dodo Payments (Brazil supported, 4% + US$0.40),
  FastSpring (custom). Stripe Brazil settles in BRL only and shifts foreign VAT duty to us.

## Decision
1. Apply to Paddle first; request **written confirmation** of Brazilian seller eligibility and payout
   route at onboarding. Sandbox integration is built and tested against signature verification.
2. USD receiving account: Wise Business if the entity is a Ltda/SLU; otherwise Payoneer (native
   Paddle payout) as primary.
3. Every completed Paddle transaction creates exactly one `ps.invoices` row keyed by transaction id;
   NFS-e is issued in BRL at PTAX of the day (see ADR 0002 for the pending fiscal parameters).
