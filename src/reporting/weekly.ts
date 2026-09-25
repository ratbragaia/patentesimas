import { db } from "../lib/db.js";
import { notifyFounder } from "./telegram.js";

/** Weekly founder report: funnel, revenue, production, incidents. Visibility only. */
export async function buildWeeklyReport(): Promise<string> {
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [funnel, mrr, issues, runs, invoices, spend, tasks] = await Promise.all([
    db().from("v_funnel").select("*"),
    db().from("v_mrr").select("*").single(),
    db().from("issues").select("issue_number,status,sent_at").gte("updated_at", since),
    db().from("ingest_runs").select("source,status,fetched,inserted").gte("started_at", since),
    db().from("invoices").select("status,amount_usd").gte("created_at", since),
    db().from("spend_approvals").select("description,amount_usd").gte("created_at", since),
    db().from("tasks").select("agent,status").in("status", ["pending", "blocked"]),
  ]);
  const f = Object.fromEntries((funnel.data ?? []).map((r: any) => [r.stage, r.n]));
  const lines = [
    `📊 RareFree Intelligence — weekly report (${new Date().toISOString().slice(0, 10)})`,
    ``,
    `Revenue: MRR USD ${Number(mrr.data?.mrr_usd ?? 0).toFixed(0)} · active subs ${mrr.data?.active_subscriptions ?? 0}`,
    `Invoices this week: ${(invoices.data ?? []).length} (USD ${(invoices.data ?? []).reduce((s: number, i: any) => s + Number(i.amount_usd), 0).toFixed(0)})`,
    ``,
    `Funnel: identified ${f.identified ?? 0} · contacted ${f.contacted ?? 0} · replied ${f.replied ?? 0} · qualified ${f.qualified ?? 0} · trial ${f.trial ?? 0} · won ${f.won ?? 0} · lost ${f.lost ?? 0}`,
    ``,
    `Production: ${(issues.data ?? []).map((i: any) => `#${i.issue_number} ${i.status}`).join(", ") || "no issue activity"}`,
    `Ingest: ${(runs.data ?? []).map((r: any) => `${r.source} ${r.status} (${r.fetched} fetched / ${r.inserted} new)`).join("; ") || "none"}`,
    ``,
    `Spend-cap events: ${(spend.data ?? []).length}${(spend.data ?? []).map((s: any) => `\n  - ${s.description}: USD ${s.amount_usd}`).join("")}`,
    `Open tasks: ${(tasks.data ?? []).length}`,
  ];
  return lines.join("\n");
}

export async function sendWeeklyReport(): Promise<void> {
  await notifyFounder(await buildWeeklyReport());
}
