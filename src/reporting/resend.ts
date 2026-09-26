/**
 * `cli report resend`: re-send, in Brazilian Portuguese, the founder notifications already issued in
 * English before the language rule (2026-09-26). Rebuilt from the database, not from logs, so every number
 * is what the tables hold now. Idempotent to run again; it only messages.
 */
import { db } from "../lib/db.js";
import { notifyFounder } from "./telegram.js";
import { buildWeeklyReport } from "./weekly.js";
import { sampleRequestMessage } from "../site/sample-request.js";
import { backfillMessage } from "../patents/ingest.js";
import { landscapeReadyMessage, monthlyIssueNumber } from "../content/landscape.js";

export async function resendFounderNotices(): Promise<string[]> {
  const out: string[] = [];
  out.push("🔁 Reenvio em português dos avisos já enviados hoje em inglês. A partir de agora tudo para você sai em pt-BR; o que é para cliente continua em inglês.");

  const { data: samples } = await db().from("sample_requests").select("email,company,request_count,email_domain").order("created_at");
  for (const s of samples ?? []) out.push(sampleRequestMessage(s.email, s.company, false, true, s.request_count) + (s.email.startsWith("ops-test@") ? "\n(Era o teste do endpoint, já marcado como descartado.)" : ""));

  const { data: run } = await db().from("ingest_runs").select("window_start,window_end,fetched,inserted,bytes_processed").eq("source", "bigquery").eq("mode", "backfill").eq("status", "succeeded").order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (run) {
    const [{ count: pubs }, { count: fams }] = await Promise.all([
      db().from("patent_publications").select("*", { count: "exact", head: true }),
      db().from("patent_families").select("*", { count: "exact", head: true }),
    ]);
    out.push(backfillMessage({ from: run.window_start, to: run.window_end }, run.fetched ?? 0, pubs ?? 0, run.inserted ?? 0, fams ?? 0, Number(run.bytes_processed ?? 0), 0, 0)
      + "\n(Após a limpeza do classificador, o banco tem os totais acima; os números do aviso original em inglês eram anteriores à limpeza.)");
  }

  const { data: issues } = await db().from("issues").select("issue_number,period_start,qa_passed,family_ids").eq("kind", "monthly_report").order("issue_number");
  for (const i of issues ?? []) {
    const month = i.period_start.slice(0, 7);
    if (i.qa_passed) out.push(landscapeReadyMessage(month, monthlyIssueNumber(month), (i.family_ids ?? []).length, 0).replace(/, 0 nos últimos doze meses/, ""));
  }

  out.push(await buildWeeklyReport());
  for (const m of out) await notifyFounder(m);
  return out;
}
