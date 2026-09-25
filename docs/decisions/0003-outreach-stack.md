# ADR 0003 — Email streams: Postmark is not used for cold outreach

Date: 2026-09-25 · Status: accepted

## Context
Briefing planned Postmark for both outreach and newsletter. Research (`04-compliance-and-payments.md`
§2) confirms Postmark's terms require permission-based lists and prohibit unsolicited email; Broadcast
streams require an unsubscribe link. Sending cold email through Postmark risks account termination
and would take the paid newsletter down with it.

## Decision
- **Postmark**: transactional stream (receipts, onboarding, unsubscribe confirmations) + Broadcast
  stream for the paid newsletter to `rf.v_active_recipients` only.
- **Cold outreach**: separate domain (candidate: getrarefree.com / rarefree-intel.com), two Google
  Workspace mailboxes, sent via a tool that permits B2B outreach (Instantly ~US$37/mo, Smartlead
  ~US$39/mo or Lemlist ~US$39/user/mo), ≤30 sends per mailbox per day, warm-up enabled, own
  SPF/DKIM/DMARC. Every draft passes `checkOutreach()` before it is queued.
- **One suppression list** (`rf.do_not_contact`) shared by the outreach tool, Postmark webhooks and
  the CRM. Any unsubscribe/complaint anywhere suppresses everywhere.
- Opt-in-only jurisdictions (DE, AT, IT, KR, CN, and JP except self-published addresses) receive no
  cold email to named individuals; use role mailboxes, referrals, conferences and inbound instead.

## Consequences
`OUTREACH_FROM` and the outreach tool API key are added to the handoff list; the founder buys the
second domain. Postmark webhook handler already suppresses bounces/complaints.
