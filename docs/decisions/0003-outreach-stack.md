# ADR 0003 — Email streams: Postmark is not used for cold outreach

Date: 2026-09-25 · Status: accepted

## Context
Briefing planned Postmark for both outreach and newsletter. Research (`04-compliance-and-payments.md`
§2) confirms Postmark's terms require permission-based lists and prohibit unsolicited email; Broadcast
streams require an unsubscribe link. Sending cold email through Postmark risks account termination
and would take the paid newsletter down with it.

## Decision
- **Postmark**: transactional stream (receipts, onboarding, unsubscribe confirmations) + Broadcast
  stream for the paid newsletter to `ps.v_active_recipients` only.
- **Cold outreach**: separate domain (candidate: patentsonar-mail.com / patentsonar-intel.com), two Google
  Workspace mailboxes, sent via a tool that permits B2B outreach (Instantly ~US$37/mo, Smartlead
  ~US$39/mo or Lemlist ~US$39/user/mo), ≤30 sends per mailbox per day, warm-up enabled, own
  SPF/DKIM/DMARC. Every draft passes `checkOutreach()` before it is queued.
- **One suppression list** (`ps.do_not_contact`) shared by the outreach tool, Postmark webhooks and
  the CRM. Any unsubscribe/complaint anywhere suppresses everywhere.
- Opt-in-only jurisdictions (DE, AT, IT, KR, CN, and JP except self-published addresses) receive no
  cold email to named individuals; use role mailboxes, referrals, conferences and inbound instead.

## Consequences
`OUTREACH_FROM` and the outreach tool API key are added to the handoff list; the founder buys the
second domain. Postmark webhook handler already suppresses bounces/complaints.

## Amendment 2026-09-26 — no paid outreach tool at launch

The founder judged US$37–39/month for Instantly/Smartlead too much before the first customer. The
volume rule already in place (hand-picked ABM, ≤ 25 first-touch emails per day, ≤ 30 per mailbox) does
not need a sequencing tool; what those tools add (warm-up, rotation, reply detection) can be done by our
own code and a manual ramp at this scale.

**Launch stack (≈ US$1/month + domain):**
- Second domain for outreach (~US$10/year at Cloudflare Registrar), as before, for reputation isolation.
- **One mailbox on Zoho Mail Lite: US$1/user/month** (US$12/year), with IMAP/SMTP and custom domain
  ([Zoho Mail pricing](https://www.zoho.com/mail/zohomail-pricing.html)). Google Workspace Business Starter
  is the alternative at ~US$7–8.40/user/month, or BRL 33 in Brazil
  ([Google Workspace pricing](https://workspace.google.com/pricing)). Zoho's free plan is web-only (no
  IMAP/SMTP), so it cannot be driven by the agent.
- **Hostinger Business Email is an equally valid choice** (founder's question, 2026-09-26): Business
  Starter US$0.99/mailbox/month on a 2-year term (10 GB), full IMAP/SMTP (`imap.hostinger.com:993`,
  `smtp.hostinger.com:465/587`), 1,000 outgoing emails/day, SPF/DKIM/DMARC supported. Same shared-IP
  caveat as Zoho; the domain must still be the separate outreach domain, never patentsonar.com. Pick
  whichever is simpler to buy alongside the domain; the agent's SMTP/IMAP code is provider-agnostic.
  ([Hostinger email pricing](https://hostadvice.com/hosting-company/hostinger-reviews/hostinger-email-pricing/),
  [Hostinger SMTP/IMAP settings](https://smtpedia.com/hostinger-email-settings/))
- Sending and replies by the agent through SMTP/IMAP (`src/outreach/`, to build: sender with
  `checkOutreach()` gate, IMAP poll for replies into `ps.outreach_messages`, suppression on any
  unsubscribe). SPF/DKIM/DMARC on the outreach domain configured by the agent.
- Manual warm-up ramp: week 1 ≤ 5/day (mostly to our own and known addresses), week 2 ≤ 10, week 3 ≤ 20,
  then the 25/day cap. Bounce rate > 3% or any spam complaint pauses sending for the week.

**Upgrade trigger:** move to Instantly/Smartlead only when a second mailbox is needed (sustained > 25
qualified first touches per day) or after the first paying customer, whichever comes first. Recorded as a
future `spend_approvals`-free change (below the per-action cap) but decided by the founder, not the agent.

## Amendment 2026-09-26 (b) — provider comparison at renewal prices

Research 05 (`docs/research/05-outreach-mailbox-providers.md`) compared Hostinger, HostGator, Zoho,
Google Workspace, Microsoft 365, Migadu, MXroute and Purelymail at **renewal** prices and on their
cold-email policies. Zoho Mail's usage policy explicitly prohibits cold/bulk email and enforcement is
reported at low volumes, so **Zoho is dropped**. HostGator resells the same Titan platform as
Hostinger at 2–5× the renewal price. **Launch mailbox: Hostinger Business Starter** (5 GB), budgeted at the
renewal price verified on the vendor pages 2026-09-26 (R$6.99/month on 24 months, or US$1.59 on the
US site), bought on a 24-month term; fallback if deliverability
degrades: Google Workspace Business Starter (US$7/month annual).
