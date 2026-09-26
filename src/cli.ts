#!/usr/bin/env tsx
/**
 * Operations entry point, called by systemd timers and by the orchestrator.
 *   cli ingest                         weekly ingest from all configured sources
 *   cli ingest bigquery <file.json>    load rows exported by `bq query --format=json`
 *   cli newsletter build <from> <to>   build weekly issue for period (ISO dates) + QA
 *   cli newsletter build-latest        build the issue for the last full Mon-Sun week
 *   cli newsletter send <issue#>       send a QA-passed issue (idempotent)
 *   cli newsletter send-latest         send the most recent issue in status 'ready' 
 *   cli invoices issue                 issue pending NFS-e via NFe.io
 *   cli report weekly                  send founder report to Telegram
 *   cli tasks list                     show open tasks
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
      const { upsertPublications, rebuildFamilies } = await import("./patents/ingest.js");
      const { classify } = await import("./patents/query.js");
      const { normalizePublicationNumber, normalizeCpc } = await import("./patents/normalize.js");
      const rows = JSON.parse(readFileSync(rest[0]!, "utf8")) as any[];
      const pubs = rows.map((r) => {
        const cpcs = (r.cpc_codes ?? []).map(normalizeCpc);
        const matched = classify({ title: r.title_en, abstract: r.abstract_en, cpc_codes: cpcs });
        return matched && { publication_number: normalizePublicationNumber(r.publication_number), country_code: r.country_code, kind_code: r.kind_code ?? null,
          family_id: r.family_id ?? null, title: r.title_en ?? null, abstract: r.abstract_en ?? null, applicants: r.applicants ?? [], inventors: r.inventors ?? [],
          cpc_codes: cpcs, priority_date: r.priority_date ?? null, filing_date: r.filing_date ?? null, publication_date: r.publication_date, grant_date: r.grant_date ?? null,
          application_number: r.application_number ?? null, source: "bigquery" as const, source_payload: r, matched_terms: matched };
      }).filter(Boolean) as any[];
      const n = await upsertPublications(pubs); await rebuildFamilies(pubs);
      log.info("bigquery loaded", { rows: rows.length, onTopic: pubs.length, inserted: n }); break;
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
      const { data } = await db().from("issues").select("issue_number").eq("status", "ready").order("issue_number", { ascending: false }).limit(1).maybeSingle();
      if (!data) { log.info("no issue in status ready; nothing to send"); break; }
      console.log(await sendIssue(data.issue_number)); break;
    }
    case "invoices issue": { const { issuePendingInvoices } = await import("./invoicing/nfeio.js"); console.log({ issued: await issuePendingInvoices() }); break; }
    case "report weekly": { const { sendWeeklyReport } = await import("./reporting/weekly.js"); await sendWeeklyReport(); break; }
    case "tasks list": {
      const { db } = await import("./lib/db.js");
      const { data, error } = await db().from("tasks").select("agent,title,status,priority,due_at").in("status", ["pending", "in_progress", "blocked"]).order("priority");
      if (error) throw new Error(`tasks query failed: ${error.code} ${error.message}${error.hint ? ` (${error.hint})` : ""}`);
      console.table(data ?? []); break;
    }
    default: console.log(readFileSync(new URL(import.meta.url), "utf8").split("*/")[0]); process.exitCode = 1;
  }
}
if (process.argv[1] && /cli\.(ts|js)$/.test(process.argv[1])) main().catch((err) => { log.error("cli failed", { err: String(err) }); process.exitCode = 1; });
