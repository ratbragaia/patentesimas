import { db } from "../lib/db.js";
import { notifyFounder } from "./telegram.js";

/** Weekly founder report (pt-BR, founder-facing): funnel, revenue, production, incidents. Visibility only. */
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
  const n = (issues.data ?? []).map((i: any) => `#${i.issue_number} ${i.status}`).join(", ");
  const lines = [
    `📊 PatentSonar — relatório semanal (${new Date().toISOString().slice(0, 10)})`,
    ``,
    `Receita: MRR US$ ${Number(mrr.data?.mrr_usd ?? 0).toFixed(0)} · assinaturas ativas ${mrr.data?.active_subscriptions ?? 0}`,
    `Notas fiscais na semana: ${(invoices.data ?? []).length} (US$ ${(invoices.data ?? []).reduce((s: number, i: any) => s + Number(i.amount_usd), 0).toFixed(0)})`,
    ``,
    `Funil: identificados ${f.identified ?? 0} · contatados ${f.contacted ?? 0} · responderam ${f.replied ?? 0} · qualificados ${f.qualified ?? 0} · em teste ${f.trial ?? 0} · ganhos ${f.won ?? 0} · perdidos ${f.lost ?? 0}`,
    ``,
    `Produção: ${n || "nenhuma edição movimentada"}`,
    `Ingestão: ${(runs.data ?? []).map((r: any) => `${r.source} ${r.status === "succeeded" ? "ok" : r.status} (${r.fetched} lidos / ${r.inserted} novos)`).join("; ") || "nenhuma"}`,
    ``,
    `Eventos de teto de gasto: ${(spend.data ?? []).length}${(spend.data ?? []).map((s: any) => `\n  - ${s.description}: US$ ${s.amount_usd}`).join("")}`,
    `Tarefas abertas: ${(tasks.data ?? []).length}`,
  ];
  return lines.join("\n");
}

export async function sendWeeklyReport(): Promise<void> {
  await notifyFounder(await buildWeeklyReport(), { keyboard: true });
}
