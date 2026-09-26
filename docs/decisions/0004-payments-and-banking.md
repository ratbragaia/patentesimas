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

## Update 2026-09-26 (research 04 §7)
- Paddle: re-checked; Brazil is not on Paddle's excluded-seller list, payouts by bank transfer / PayPal /
  Payoneer, US$100 minimum, no Paddle payout fee. Written confirmation at onboarding still required.
- Nomad (founder's question): **ruled out**. PF-only, no CNPJ account; paying company revenue into a
  personal account would break the NFS-e export flow. Ranking stays Wise Business → Payoneer; Husky
  (Nomad's PJ acquisition) only as a third check if both fail.

## Update 2026-09-26 (sequencing)
Paddle first, Wise later: Paddle holds the balance and only needs payout details when a payout is due (created
on the 1st, sent by the 15th, US$100 minimum). Open Wise Business when the first payout approaches; its
verification takes days, so start it as soon as the first sale lands, not on payout day.

## Update 2026-09-26 (sandbox alongside live)
The founder opted to test the full flow in Paddle's sandbox (a separate sign-up at sandbox-vendors.paddle.com,
same e-mail allowed). Both accounts post to the same `/webhooks/paddle`; the server picks the environment by
which secret verifies the signature (`PADDLE_SANDBOX_WEBHOOK_SECRET`). Sandbox customers, subscriptions and
events are tagged `environment='sandbox'` (migration 0014) and excluded from `v_mrr` and
`v_active_recipients`, so test data never reaches revenue numbers or the newsletter list; Telegram alerts
from the sandbox are prefixed 🧪 [SANDBOX] and open no dunning tasks.

## Evidence 2026-09-26 (sandbox validation)
`cli paddle plans-sync sandbox` created the 3 products / 5 prices; `cli paddle simulate sandbox <event>` for
transaction.completed, subscription.created, subscription.activated, subscription.canceled and
transaction.payment_failed: all delivered, signature verified, 5 rows in `ps.billing_events`
(environment=sandbox), 1 sandbox customer + subscription, no dunning task from the sandbox failure, `v_mrr`
unaffected. Paddle requires the destination's traffic source to include simulations and the API key to hold
"Notification simulations: write" (founder set both).

## Decision
1. Apply to Paddle first; request **written confirmation** of Brazilian seller eligibility and payout
   route at onboarding. Sandbox integration is built and tested against signature verification.
2. USD receiving account: Wise Business if the entity is a Ltda/SLU; otherwise Payoneer (native
   Paddle payout) as primary.
3. Every completed Paddle transaction creates exactly one `ps.invoices` row keyed by transaction id;
   NFS-e is issued in BRL at PTAX of the day (see ADR 0002 for the pending fiscal parameters).
