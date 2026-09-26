# Runbook — first sessions of the agent on the VPS

You (Claude Code) are running on the company VPS as user `patentsonar` in `/opt/patentsonar`.
Work through this list top to bottom; tick items by editing this file and committing.

## 0. Orientation (every session)
- [ ] `git pull --ff-only` and read `docs/handoff-checklist.md` for what the founder has provided.
- [ ] `cat /etc/patentsonar/env | sed 's/=.*/=<set>/'` to see which credentials exist (never print values).
- [ ] `systemctl list-timers 'patentsonar-*'` and `tail -n 20 /var/log/patentsonar/*.log` for failures.

## 1. Platform checks
- [ ] Supabase reachable: `npm run cli -- tasks list` returns a table (empty is fine).
- [ ] Deploy key added on GitHub: `ssh -T git@github.com` authenticates. If not, print the key with
      `cat ~/.ssh/id_ed25519.pub` and ask the founder (Telegram once configured, else in the terminal).
- [ ] https://patentsonar.com serves the site (`curl -sI https://patentsonar.com | head -1`).

## 2. Credentials still missing (ask the founder for each; they create the account, you configure)
- [ ] EPO OPS consumer key/secret (developers.epo.org → My Apps). Primary patent source.
- [ ] PatentsView API key (PatentsView support portal).
- [ ] Telegram bot token (@BotFather) + founder chat id. Then `npm run report:weekly` must deliver.
- [ ] GCP project + service account for BigQuery (can wait until the first monthly report).
- [ ] Postmark server token + DNS records (`infra/dns-records.md`), Paddle sandbox, NFe.io, outreach mailbox.
Append each as `KEY=value` to `/etc/patentsonar/env`, then `sudo systemctl restart patentsonar-webhooks`.

## 3. First product cycle (as soon as EPO OPS key exists)
- [ ] Backfill: temporarily run `npm run ingest` with a 90-day window (edit `computeWindow` fallback or
      insert an `ingest_runs` row) and check `ps.patent_publications` counts by office.
- [ ] Triage families (`production` agent instructions) and write analyst notes for `include` ones.
- [ ] `npm run newsletter:build -- <from> <to>`; QA must pass. Save the markdown of issue #0 to
      `docs/samples/issue-000.md` and commit: it is the sales sample.
- [ ] Send issue #0 to the founder's own address only (create a test customer/subscriber) once Postmark exists.

## 4. Go-to-market prep (in parallel, no credentials needed)
- [ ] Load the 38 verified accounts from `docs/research/02-target-accounts.md` into `ps.accounts`.
- [ ] Draft the first 15 personal hooks (one factual sentence each, with evidence URL) into `ps.leads.notes`.
- [ ] Do not send any outreach until the outreach domain, mailbox and `legal/REVIEW_STATUS.md` allow it.

## 5. Operating rhythm
Once 1–3 are done, follow `docs/runbooks/weekly-cycle.md`. Report to the founder weekly via Telegram.
