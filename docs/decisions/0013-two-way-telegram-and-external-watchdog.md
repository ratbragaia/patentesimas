# ADR 0013 — Two-way Telegram for the founder; external watchdog for the VPS operator

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** rule 7 (visibility, not approval; founder-facing text in pt-BR), ADR 0012 (headless runner)

## Context

The founder asked whether the company runs with no computer, no answers and no configuration once the
handoff items are delivered. Two gaps remained: (1) Telegram was one-way, so any decision the rules
escalate (legal/compliance question, spend above cap, a refund outside policy) required opening a
Claude session; (2) if the headless operator on the VPS stopped (expired login, plan limits, a dead
timer), nothing outside the VPS would notice.

## Decision

1. **Two-way Telegram.** The bot registers a webhook to `POST /webhooks/telegram` (`cli telegram setup`).
   Telegram echoes a secret we derive from the bot token (`sha256(token|patentsonar-webhook)`), checked
   in constant time; no new credential. Only the founder's chat id is served. Every update is stored in
   `ps.founder_messages` (unique `update_id`, migration 0009). **Buttons, not commands** (founder
   feedback the same day): a persistent keyboard (📊 Status · 📋 Tarefas · ❓ Ajuda) and, on every
   escalation, inline ✅ Aprovar / 🚫 Cancelar buttons (`callback_data` `ok:<code>` / `nao:<code>`, one-shot:
   the message is rewritten with the outcome). Agents escalate with `cli tasks ask <task-id> "<question>"`,
   which marks the task `blocked` and sends the buttons. Typed commands (`/status`, `/tarefas`,
   `/ok <code>`, `/nao <code>`, `/ajuda`) still work. Any other text becomes an `orchestrator` task
   "Fundador (Telegram): …" with priority 2, answered with a 🚫 button to withdraw it; the headless prompt
   treats those tasks as founder instructions inside the rules.
2. **External watchdog.** A claude.ai/code scheduled routine in the "PatentSonar" cloud environment runs
   every morning (fresh session), calls `ops.sh status` and the new read-only `ops.sh agent-health` job
   (timers, last headless runs and exit codes, failed units, disk, last ingest runs, blocked tasks), and
   reports through the routine's push/e-mail notification; when the VPS is reachable it also posts the
   verdict on Telegram. It runs outside the VPS on purpose: it is the only check that survives the VPS
   itself being down or the operator's login expiring.

## What still needs the founder (unchanged, stated for the record)

Reading Telegram and answering escalations; identity and signature items (contracts by PO, lawyer,
accountant, A1 certificate, KYC reviews); the card behind every renewal; re-authenticating Claude on
the VPS when the subscription login expires; incidents outside our reach (VPS, Cloudflare, Supabase
accounts). Realistic steady state: minutes per week on Telegram, about one intervention a month.

## Evidence

- Tests: `tests/founder-inbox.test.ts` (command parsing, short codes, secret derivation), `tests/ops.test.ts`.
- Live 2026-09-26: `setWebhook` → `"Webhook was set"`, `getWebhookInfo` shows the VPS IP and 3 pending updates,
  which were then delivered and stored (`ps.founder_messages` = 3; two became tasks). Routine id
  `trig_01BrJWsNHhCRvRo4AJtksw3G` (daily 08:07 America/Sao_Paulo). See runbook §4b.
