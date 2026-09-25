# PatentSonar

Autonomous, agent-operated company selling a weekly patent-intelligence subscription on
**rare-earth-free permanent magnets** (iron nitride, Mn–Bi, Mn–Al, advanced ferrites, L10 FeNi,
rare-earth-lean designs, RE-free motor topologies) to IP, R&D and strategy teams worldwide.

- Operating manual for the agent: [`CLAUDE.md`](CLAUDE.md)
- Founder briefing (pt-BR): [`docs/00-founder-briefing.pt-BR.txt`](docs/00-founder-briefing.pt-BR.txt)
- Research that grounds every decision: [`docs/research/`](docs/research/)
- Decisions: [`docs/decisions/`](docs/decisions/)
- What the founder must hand over: [`docs/handoff-checklist.md`](docs/handoff-checklist.md)

## Stack
Node 22 + TypeScript · Supabase (Postgres, schema `ps`) · USPTO PatentsView, EPO OPS, Google Patents BigQuery ·
Paddle (merchant of record) · NFe.io (NFS-e) · Postmark (newsletter + transactional) · Telegram (founder alerts) ·
Hostinger VPS (Ubuntu 24.04, systemd timers, Caddy).

## Develop
```bash
npm install
npm run typecheck && npm test
npm run cli -- --help
```

## Deploy (VPS)
```bash
ssh root@<ip> 'REPO_URL=<git url> BRANCH=main bash -s' < infra/vps/setup.sh
# fill /etc/patentsonar/env, then
psql "$SUPABASE_DB_URL" -f supabase/migrations/0001_init.sql -f supabase/migrations/0002_seed_plans.sql
systemctl list-timers 'patentsonar-*'
```

## Layout
See the repository map in `CLAUDE.md` §2.
