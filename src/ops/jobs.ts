/**
 * Fixed catalogue of operations a cloud session may trigger over HTTPS (see src/ops/server routes).
 * No free-form commands: each job is a named script with a bounded argument list, so a leaked token
 * cannot be turned into a shell. All runs are written to ps.audit_log.
 */
import { spawn } from "node:child_process";

export interface JobResult { job: string; ok: boolean; code: number | null; stdout: string; stderr: string; ms: number }

const APP_DIR = process.env["APP_DIR"] ?? "/opt/patentsonar";
const CLI_SUBCOMMANDS = new Set(["tasks list", "report weekly", "invoices issue", "newsletter build-latest", "newsletter send-latest", "ingest"]);

type Job = { argv: string[]; timeoutMs?: number };

export function resolveJob(name: string, args: string[] = []): Job | null {
  switch (name) {
    case "status": return { argv: ["bash", "-lc", "sudo systemctl is-active caddy patentsonar-webhooks; sudo systemctl list-timers 'patentsonar-*' --no-pager; git -C " + APP_DIR + " log --oneline -3; df -h / | tail -1; free -m | head -2; uptime"] };
    case "logs": {
      const unit = args[0] ?? "";
      if (!/^(patentsonar-[a-z-]+|caddy)$/.test(unit)) return null;
      const n = Math.min(Number(args[1] ?? 100) || 100, 500);
      return { argv: ["sudo", "journalctl", "-u", unit, "-n", String(n), "--no-pager"] };
    }
    case "env-keys": return { argv: ["bash", "-lc", "sed -E 's/=.*/=<set>/' /etc/patentsonar/env"] };
    case "git-pull": return { argv: ["git", "-C", APP_DIR, "pull", "--ff-only"] };
    case "npm-ci": return { argv: ["bash", "-lc", `cd ${APP_DIR} && npm ci --omit=dev --no-audit --no-fund && npm install --no-save tsx`], timeoutMs: 300_000 };
    case "test": return { argv: ["bash", "-lc", `cd ${APP_DIR} && npm run typecheck && npm test`], timeoutMs: 300_000 };
    case "migrate": return { argv: ["bash", `${APP_DIR}/infra/vps/apply-migrations.sh`], timeoutMs: 300_000 };
    case "restart": {
      const unit = args[0] ?? "patentsonar-webhooks";
      if (!/^(patentsonar-[a-z-]+|caddy)$/.test(unit)) return null;
      return { argv: ["sudo", "systemctl", "restart", unit] };
    }
    case "cli": {
      const sub = args.join(" ");
      if (!CLI_SUBCOMMANDS.has(sub)) return null;
      return { argv: ["bash", "-lc", `cd ${APP_DIR} && npx tsx src/cli.ts ${sub}`], timeoutMs: 1_800_000 };
    }
    case "sql-count": {
      // read-only row counts for the company tables; no free SQL
      return { argv: ["bash", "-lc", `cd ${APP_DIR} && DB=$(grep -E '^SUPABASE_DB_URL=' /etc/patentsonar/env | cut -d= -f2- | tr -d '"') && psql "$DB" -X -q -t -c "select table_name, (xpath('/row/c/text()', query_to_xml('select count(*) as c from ps.'||table_name, false, true, '')))[1]::text::int as rows from information_schema.tables where table_schema='ps' and table_type='BASE TABLE' order by 1"`] };
    }
    default: return null;
  }
}

export function runJob(name: string, args: string[] = []): Promise<JobResult> {
  const job = resolveJob(name, args);
  const started = Date.now();
  if (!job) return Promise.resolve({ job: name, ok: false, code: null, stdout: "", stderr: "unknown job or invalid arguments", ms: 0 });
  return new Promise((resolve) => {
    const child = spawn(job.argv[0]!, job.argv.slice(1), { env: { ...process.env, HOME: process.env["HOME"] ?? "/home/patentsonar" } });
    let stdout = "", stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), job.timeoutMs ?? 120_000);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ job: name, ok: code === 0, code, stdout: stdout.slice(-60_000), stderr: stderr.slice(-20_000), ms: Date.now() - started });
    });
  });
}
