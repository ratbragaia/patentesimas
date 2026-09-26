# ADR 0012 — Inbound email via Cloudflare Email Workers; scheduled headless operator runs

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** ADR 0003 (email streams), ADR 0010 (sample requests), rule 7 (visibility, not approval)

## Context

Sending was live on 2026-09-26 (Postmark, domain verified). Two things were missing for the company to
run without a human: (1) customer email had no path into the system, and (2) nothing started an agent
session; the operator only existed while the founder had a terminal open. The founder asked directly
whether the agent "already answers customer emails". The honest answer was no.

Constraints: Postmark inbound needs the Pro plan (US$16.50/month; the Free plan has no inbound). The
founder's Gmail is personal infrastructure and is never read by the agent (CLAUDE.md rule 6). Reply
latency of hours is acceptable for a B2B subscription product.

## Options

1. Postmark Pro inbound stream → webhook. Works, US$16.50/month, one more vendor surface.
2. **Cloudflare Email Routing → Email Worker → VPS webhook.** Free, domain already on Cloudflare, raw
   MIME delivered to our endpoint; retries handled by the sending MTA on non-2xx.
3. IMAP polling of a mailbox. Needs a paid mailbox, polling loop, and credentials on the VPS.

For waking the agent: a systemd timer running `claude -p` on the VPS (direct access, same subscription
login as interactive sessions) versus claude.ai/code scheduled routines (cloud, would need the ops
channel for everything). VPS timer chosen; routines stay a fallback.

## Decision

- **Inbound:** option 2. `support@patentsonar.com` (and any address the founder routes to the Worker)
  → Worker `patentsonar-inbound-email` (`infra/cloudflare/inbound-email-worker.js`, deployed by
  `infra/cloudflare/deploy-worker.sh`) → `POST /webhooks/inbound` with a Bearer secret
  (`INBOUND_WEBHOOK_SECRET`, constant-time compare). The VPS parses the MIME (`postal-mime`), stores one
  row per message in `ps.inbound_emails` (unique on Message-ID and on a content hash; a retry gets 409),
  ignores auto-replies/daemons/list mail, honours `ps.do_not_contact`, and opens a `sales` task
  "Reply to <sender>: <subject>". `founder@` keeps going to the founder's mailbox, untouched.
- **Runner:** `patentsonar-agent.timer` → `infra/agent/run.sh` → `claude -p` with
  `infra/agent/prompt.md`, weekdays at 07, 10, 13, 16 and 19 UTC. Guards: flock (one run at a time),
  `--max-turns 60`, 40-minute wall clock, `git pull --ff-only` before each run, per-run log in
  `/var/log/patentsonar/agent/`, Telegram alert on a non-zero exit. The prompt drains `ps.tasks` in
  priority order, answers inbound mail through Postmark with the fixed templates, and escalates anything
  outside the templates as a `blocked` task plus a one-line Telegram alert. Founder-only tasks are
  never touched.
- **Cost:** Cloudflare Workers free tier (100k requests/day) and Email Routing are free. Runner usage
  counts against the Claude subscription; five short runs per weekday.

## Consequences

- Replies to customers arrive within hours on weekdays, not minutes. Stated plainly in templates.
- The Cloudflare API token on the VPS (replaced 2026-09-26) covers DNS edit, Workers Scripts edit and
  Email Routing rules edit, and is **IP-filtered to the VPS IPv4**: over IPv6 the API answers
  9109 "Cannot use the access token from location", so every script uses `curl -4`. The `support@`
  → Worker rule was created through the API; a message sent seconds after creation still went to the
  catch-all (propagation), the next one reached the webhook (`inbound email stored`, task created).
- When the outreach domain/mailbox exists (ADR 0003), its replies can take the same Worker → webhook
  path, or IMAP if the mailbox provider requires it; the storage and task flow do not change.

## Evidence

- Live tests 2026-09-26: `/webhooks/inbound` without token → 401; with token → `stored 200`; same message
  again → `duplicate 409`; `ps.inbound_emails` row created with a linked `sales` task.
- Worker upload accepted by the Cloudflare API (`deployed`); routing-rule creation via API → code 10000.
- Postmark pricing page (inbound only on Pro), 2026-09-26.
