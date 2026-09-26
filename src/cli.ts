#!/usr/bin/env tsx
/**
 * Operations entry point, called by systemd timers and by the orchestrator.
 *   cli ingest                         weekly ingest from all configured sources
 *   cli ingest bigquery [dry-run]      monthly BigQuery run (trailing 60 days) through the REST API, ADR 0009
 *   cli ingest bigquery backfill [dry-run]  one-off five-year landscape backfill (same scan cost), ADR 0011
 *   cli ingest bigquery <file.json>    load rows exported by `bq query --format=json`
 *   cli newsletter build <from> <to>   build weekly issue for period (ISO dates) + QA
 *   cli newsletter build-latest        build the issue for the last full Mon-Sun week
 *   cli newsletter send <issue#>       send a QA-passed issue (idempotent)
 *   cli newsletter send-latest         send the most recent issue in status 'ready' 
 *   cli invoices issue                 issue pending NFS-e via NFe.io
 *   cli report weekly                  send founder report to Telegram
 *   cli report monthly [YYYY-MM] [print]  build the monthly landscape report (default: previous month); `print` = markdown only
 *   cli tasks list                     show open tasks
 *   cli samples list                   website sample requests not yet served (status new)
 */
import { readFileSync } from "node:fs";
import { log } from "./lib/log.js";

const [cmd, sub, ...rest] = process.argv.slice(2);

/** Previous full ISO week (Monday..Sunday) relative to `today`, as ISO dates. */
export function lastFullWeek(today: Date): { from: string; to: string } {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const dow = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // Mon=1..Sun=7
  const lastSunday = new Date(d); lastSunday.setUTCDate(d.getUTCDate() - dow);
  const lastMonday = new Date(lastSunday); lastMonday.setUTCDate(lastSunday.getUTCDate() - 6);
  return { from: lastMonday.toISOString().slice(0, 10), to: lastSunday.toISOString().slice(0, 10) };
}

async function main() {
  switch (`${cmd} ${sub ?? ""}`.trim()) {
    case "ingest": { const { ingestAll } = await import("./patents/ingest.js"); await ingestAll(); break; }
    case "ingest bigquery": {
      const { ingestBigQuery } = await import("./patents/ingest.js");
      const file = rest.find((a) => a.endsWith(".json"));
      if (file) {
        const { upsertPublications, rebuildFamilies } = await import("./patents/ingest.js");
        const { mapBigQueryRow } = await import("./patents/bigquery.js");
        // `bq query --format=json` on a multi-statement script (DECLARE ...) nests the last result set: [[{...}]]
        let rows = JSON.parse(readFileSync(file, "utf8")) as any[];
        while (Array.isArray(rows) && rows.length === 1 && Array.isArray(rows[0])) rows = rows[0];
        const pubs = rows.map(mapBigQueryRow).filter((p): p is NonNullable<typeof p> => !!p);
        const n = await upsertPublications(pubs); const fams = await rebuildFamilies(pubs);
        log.info("bigquery file loaded", { rows: rows.length, onTopic: pubs.length, inserted: n, families: fams }); break;
      }
      const mode = rest.includes("backfill") ? "backfill" : "monthly";
      const out = await ingestBigQuery({ mode, dryRun: rest.includes("dry-run") });
      console.log(JSON.stringify({ ...out, gb: +(out.bytes / 1e9).toFixed(1), monthGb: +(out.monthBytes / 1e9).toFixed(1) })); break;
    }
    case "newsletter build": { const { buildWeeklyIssue } = await import("./content/newsletter.js"); console.log(await buildWeeklyIssue(rest[0]!, rest[1]!)); break; }
    case "newsletter build-latest": {
      const { buildWeeklyIssue } = await import("./content/newsletter.js");
      const { from, to } = lastFullWeek(new Date());
      console.log(await buildWeeklyIssue(from, to)); break;
    }
    case "newsletter send": { const { sendIssue } = await import("./email/postmark.js"); console.log(await sendIssue(Number(rest[0]))); break; }
    case "newsletter send-latest": {
      const { db } = await import("./lib/db.js"); const { sendIssue } = await import("./email/postmark.js");
      const { data } = await db().from("issues").select("issue_number").eq("status", "ready").eq("kind", "weekly").order("issue_number", { ascending: false }).limit(1).maybeSingle();
      if (!data) { log.info("no issue in status ready; nothing to send"); break; }
      console.log(await sendIssue(data.issue_number)); break;
    }
    case "invoices issue": { const { issuePendingInvoices } = await import("./invoicing/nfeio.js"); console.log({ issued: await issuePendingInvoices() }); break; }
    case "report weekly": { const { sendWeeklyReport } = await import("./reporting/weekly.js"); await sendWeeklyReport(); break; }
    case "report monthly": {
      const { buildMonthlyReport, previewMonthlyReport, previousMonth } = await import("./content/landscape.js");
      const month = rest.find((a) => /^\d{4}-\d{2}$/.test(a)) ?? previousMonth(new Date());
      if (rest.includes("print")) { console.log(await previewMonthlyReport(month)); break; }
      const out = await buildMonthlyReport(month);
      console.log(JSON.stringify({ month, issueNumber: out.issueNumber, qaPassed: out.qaPassed, families: out.families })); break;
    }
    case "tasks list": {
      const { db } = await import("./lib/db.js");
      const { data, error } = await db().from("tasks").select("agent,title,status,priority,due_at").in("status", ["pending", "in_progress", "blocked"]).order("priority");
      if (error) throw new Error(`tasks query failed: ${error.code} ${error.message}${error.hint ? ` (${error.hint})` : ""}`);
      console.table(data ?? []); break;
    }
    case "samples list": {
      const { db } = await import("./lib/db.js");
      const { data, error } = await db().from("sample_requests").select("email,company,status,request_count,source,last_requested_at").eq("status", "new").order("last_requested_at", { ascending: false });
      if (error) throw new Error(`sample_requests query failed: ${error.code} ${error.message}`);
      console.table(data ?? []); break;
    }
    default: console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]); process.exitCode = 1;
  }
}
if (process.argv[1] && /cli\.(ts|js)$/.test(process.argv[1])) main().catch((err) => { log.error("cli failed", { err: String(err) }); process.exitCode = 1; });
