# ADR 0010 — Website sample-request form: own endpoint instead of formsubmit.co

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** research 04 (compliance), `legal/privacy.html` (row "Website form submissions")

## Context

The marketing site's "Get this week's issue" form posted to `https://formsubmit.co/hello@patentsonar.com`,
a third-party relay left in place as a placeholder. Problems: (1) prospect email addresses left our
infrastructure and were processed by a vendor with no contract or DPA, which contradicts the privacy
notice ("used only to send the sample"); (2) nothing was written to company memory, so a request
could be lost between sessions; (3) no founder alert, so the sales cycle could not start the same day;
(4) the relay had no bot protection or rate limiting.

## Options

1. Keep formsubmit.co and forward to a mailbox — cheapest, but the three problems above remain and
   the inbound mailbox (Postmark inbound) does not exist yet.
2. **Own endpoint on the existing webhook server** (`POST /api/sample-request`, Node, behind Caddy),
   writing to Supabase and alerting on Telegram — no new service, no new credential.
3. A Supabase Edge Function — one more deployable surface and a public anon key on the site; the
   project policy is service-role only from the VPS.

## Decision

Option 2.
- Route `POST /api/sample-request` in `src/webhooks/server.ts`; logic in `src/site/sample-request.ts`;
  Caddy proxies `/api/*` (`infra/Caddyfile`, applied with `ops.sh caddy-sync`).
- Storage: `ps.sample_requests` (migration 0005) via the atomic function `ps.record_sample_request`
  (unique per email, repeats bump `request_count`). Raw IP is never stored: `sha256(ip|UTC day)`.
  The consent wording shown next to the form is stored with every row.
- Each new request creates a `ps.tasks` row for the `sales` agent (priority 2, or 4 for free-mail
  domains) and a Telegram alert to the founder. A Telegram or task failure never loses the row.
- Abuse controls: honeypot field (`website`), 10 kB body cap, 5 requests / 10 min per source and
  60 / 10 min overall. Honeypot hits are dropped silently with a normal redirect.
- HTML posts are redirected (303) to `/sample-requested.html`; JSON clients get JSON.
- Retention: the privacy notice says 12 months for form submissions; a cleanup task deletes
  `sample_requests` older than 12 months that never became customers (to add to the Friday cycle
  once the first rows exist).

## Evidence

- Unit and HTTP integration tests: `tests/sample-request.test.ts`, `tests/sample-request-route.test.ts`.
- Live check after deploy: `bash infra/vps/ops.sh site-check` (index 200, thank-you page 200,
  `GET /api/sample-request` 404, invalid JSON post 400).
