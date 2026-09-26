/**
 * Two-way Telegram (ADR 0013). The founder answers the bot from the phone; nothing else is needed.
 *   /status            → current numbers (same content as the weekly report)
 *   /tarefas           → open tasks with their short codes
 *   /ok <código> [nota]   → a `blocked` task becomes `pending` again with the founder's approval recorded
 *   /nao <código> [motivo] → the task is canceled with the reason
 *   /ajuda             → this list
 *   any other text     → becomes an `orchestrator` task "Fundador (Telegram): …" that the headless run picks up
 * Only the founder's chat is served; every update is stored in ps.founder_messages (unique update_id).
 */
import { db, audit } from "../lib/db.js";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { notifyFounder } from "./telegram.js";
import { buildWeeklyReport } from "./weekly.js";

export interface TelegramUpdate { update_id: number; message?: { message_id: number; text?: string; chat: { id: number | string }; from?: { id: number; username?: string } } }

export type Parsed =
  | { command: "status" | "tarefas" | "ajuda" }
  | { command: "ok" | "nao"; code: string; note: string }
  | { command: "tarefa"; text: string }
  | { command: "ignorado" };

/** Pure parser (tested). Commands are Portuguese; English aliases accepted. */
export function parseFounderText(raw: string | undefined): Parsed {
  const text = (raw ?? "").trim();
  if (!text) return { command: "ignorado" };
  const m = /^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text);
  if (m) {
    const cmd = m[1]!.toLowerCase(); const rest = (m[2] ?? "").trim();
    if (["status", "start"].includes(cmd)) return { command: "status" };
    if (["tarefas", "tasks"].includes(cmd)) return { command: "tarefas" };
    if (["ajuda", "help"].includes(cmd)) return { command: "ajuda" };
    if (["ok", "aprovado", "sim", "yes", "approve"].includes(cmd) || ["nao", "não", "no", "reject", "cancelar"].includes(cmd)) {
      const [code, ...note] = rest.split(/\s+/);
      if (!code || !/^[0-9a-f]{6,8}$/i.test(code)) return { command: "tarefa", text };
      return { command: ["ok", "aprovado", "sim", "yes", "approve"].includes(cmd) ? "ok" : "nao", code: code.toLowerCase(), note: note.join(" ") };
    }
  }
  return { command: "tarefa", text };
}

export const shortCode = (id: string) => id.replace(/-/g, "").slice(0, 8);

const HELP = [
  "Comandos:",
  "/status — números atuais (receita, funil, produção, ingestão, tarefas)",
  "/tarefas — tarefas abertas com código",
  "/ok <código> [nota] — libera uma tarefa bloqueada (sua aprovação fica registrada)",
  "/nao <código> [motivo] — cancela a tarefa",
  "Qualquer outro texto vira uma tarefa para o operador, executada na próxima rodada (dias úteis, 5x ao dia).",
].join("\n");

async function openTasks() {
  const { data, error } = await db().from("tasks").select("id,agent,title,status,priority,created_at").in("status", ["pending", "in_progress", "blocked"]).order("priority").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as { id: string; agent: string; title: string; status: string; priority: number }[];
}

async function handle(p: Parsed, messageId: number): Promise<{ reply: string; taskId?: string }> {
  switch (p.command) {
    case "ajuda": return { reply: HELP };
    case "status": return { reply: await buildWeeklyReport() };
    case "tarefas": {
      const tasks = await openTasks();
      if (tasks.length === 0) return { reply: "Nenhuma tarefa aberta." };
      const lines = tasks.slice(0, 25).map((t) => `${shortCode(t.id)} · ${t.status === "blocked" ? "⏸" : t.status === "in_progress" ? "▶" : "•"} [${t.agent}] ${t.title.slice(0, 90)}`);
      return { reply: `${tasks.length} tarefas abertas (⏸ bloqueada, ▶ em andamento):\n` + lines.join("\n") + (tasks.length > 25 ? `\n… e mais ${tasks.length - 25}` : "") };
    }
    case "ok": case "nao": {
      const tasks = await openTasks();
      const hits = tasks.filter((t) => shortCode(t.id).startsWith(p.code));
      if (hits.length !== 1) return { reply: hits.length === 0 ? `Não achei tarefa aberta com código ${p.code}. Use /tarefas.` : `Código ${p.code} é ambíguo (${hits.length} tarefas); use mais dígitos.` };
      const t = hits[0]!; const when = new Date().toISOString().slice(0, 16).replace("T", " ");
      const note = p.note ? ` Nota: ${p.note}` : "";
      if (p.command === "ok") {
        const { error } = await db().from("tasks").update({ status: "pending", locked_by: null, locked_at: null, outcome: `Aprovado pelo fundador via Telegram em ${when} UTC.${note}` }).eq("id", t.id);
        if (error) throw new Error(error.message);
        await audit("founder", "task_approved", "tasks", t.id, { via: "telegram", message_id: messageId, note: p.note });
        return { reply: `✅ Liberada: ${t.title.slice(0, 90)}\nEntra na próxima rodada do operador.`, taskId: t.id };
      }
      const { error } = await db().from("tasks").update({ status: "canceled", outcome: `Cancelada pelo fundador via Telegram em ${when} UTC.${note}` }).eq("id", t.id);
      if (error) throw new Error(error.message);
      await audit("founder", "task_canceled", "tasks", t.id, { via: "telegram", message_id: messageId, note: p.note });
      return { reply: `🚫 Cancelada: ${t.title.slice(0, 90)}`, taskId: t.id };
    }
    case "tarefa": {
      const { data, error } = await db().from("tasks").insert({ agent: "orchestrator", title: `Fundador (Telegram): ${p.text.slice(0, 180)}`, priority: 2, payload: { source: "telegram", message_id: messageId, text: p.text } }).select("id").single();
      if (error) throw new Error(error.message);
      await audit("founder", "task_from_telegram", "tasks", data.id, { message_id: messageId });
      return { reply: `📝 Anotado como tarefa ${shortCode(data.id)}. O operador executa na próxima rodada e responde aqui se precisar de você.`, taskId: data.id };
    }
    default: return { reply: "" };
  }
}

/** Entry point for POST /webhooks/telegram. Always resolves (Telegram retries on non-200, so errors are logged, not thrown). */
export async function handleTelegramUpdate(u: TelegramUpdate): Promise<"handled" | "ignored" | "duplicate"> {
  const msg = u.message; const founder = config().TELEGRAM_FOUNDER_CHAT_ID;
  if (!msg || !founder || String(msg.chat.id) !== String(founder)) { log.warn("telegram update ignored", { update_id: u.update_id, chat: msg?.chat.id }); return "ignored"; }
  const parsed = parseFounderText(msg.text);
  const { error: insErr } = await db().from("founder_messages").insert({ update_id: u.update_id, message_id: msg.message_id, chat_id: String(msg.chat.id), text: msg.text ?? null, command: parsed.command });
  if (insErr) { if (insErr.code === "23505") return "duplicate"; throw new Error(insErr.message); }
  let reply = "", taskId: string | undefined;
  try { ({ reply, taskId } = await handle(parsed, msg.message_id)); }
  catch (err) { log.error("founder command failed", { err: String(err) }); reply = `Não consegui executar: ${String(err).slice(0, 200)}`; }
  if (reply) await notifyFounder(reply, { replyTo: msg.message_id });
  await db().from("founder_messages").update({ reply, task_id: taskId ?? null }).eq("update_id", u.update_id);
  return "handled";
}
