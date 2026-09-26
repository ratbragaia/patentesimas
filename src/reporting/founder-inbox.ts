/**
 * Two-way Telegram (ADR 0013). The founder answers from the phone with buttons; typing is optional.
 *   Persistent keyboard: 📊 Status · 📋 Tarefas · ❓ Ajuda
 *   Escalations carry inline buttons ✅ Aprovar / 🚫 Cancelar (callback_data "ok:<code>" / "nao:<code>")
 *   /status /tarefas /ajuda /ok <code> /nao <code> still work for people who like typing
 *   any other text → an `orchestrator` task "Fundador (Telegram): …" that the headless run picks up
 * Only the founder's chat is served; every update is stored in ps.founder_messages (unique update_id).
 */
import { db, audit } from "../lib/db.js";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { notifyFounder, editFounderMessage, answerCallback, askFounder, type InlineButton } from "./telegram.js";
import { buildWeeklyReport } from "./weekly.js";

interface TgMessage { message_id: number; text?: string; chat: { id: number | string } }
export interface TelegramUpdate {
  update_id: number;
  message?: TgMessage;
  callback_query?: { id: string; data?: string; message?: TgMessage; from?: { id: number } };
}

export type Parsed =
  | { command: "status" | "tarefas" | "ajuda" }
  | { command: "ok" | "nao"; code: string; note: string }
  | { command: "tarefa"; text: string }
  | { command: "ignorado" };

const KEYBOARD_TEXT: Record<string, Parsed["command"]> = { "📊 status": "status", "📋 tarefas": "tarefas", "❓ ajuda": "ajuda", status: "status", tarefas: "tarefas", ajuda: "ajuda" };

/** Pure parser (tested). Keyboard labels, slash commands (pt-BR + English aliases) or free text. */
export function parseFounderText(raw: string | undefined): Parsed {
  const text = (raw ?? "").trim();
  if (!text) return { command: "ignorado" };
  const kb = KEYBOARD_TEXT[text.toLowerCase()];
  if (kb === "status" || kb === "tarefas" || kb === "ajuda") return { command: kb };
  const m = /^\/(\w+)(?:@\w+)?(?:\s+([\s\S]*))?$/.exec(text);
  if (m) {
    const cmd = m[1]!.toLowerCase(); const rest = (m[2] ?? "").trim();
    if (["status", "start"].includes(cmd)) return { command: "status" };
    if (["tarefas", "tasks"].includes(cmd)) return { command: "tarefas" };
    if (["ajuda", "help"].includes(cmd)) return { command: "ajuda" };
    const yes = ["ok", "aprovado", "sim", "yes", "approve"].includes(cmd), no = ["nao", "não", "no", "reject", "cancelar"].includes(cmd);
    if (yes || no) {
      const [code, ...note] = rest.split(/\s+/);
      if (!code || !/^[0-9a-f]{6,8}$/i.test(code)) return { command: "tarefa", text };
      return { command: yes ? "ok" : "nao", code: code.toLowerCase(), note: note.join(" ") };
    }
  }
  return { command: "tarefa", text };
}

/** Button payloads: "ok:<code>" | "nao:<code>" | "status" | "tarefas". */
export function parseCallbackData(data: string | undefined): Parsed {
  const m = /^(ok|nao):([0-9a-f]{6,8})$/i.exec((data ?? "").trim());
  if (m) return { command: m[1]!.toLowerCase() as "ok" | "nao", code: m[2]!.toLowerCase(), note: "" };
  if (data === "status" || data === "tarefas" || data === "ajuda") return { command: data };
  return { command: "ignorado" };
}

export const shortCode = (id: string) => id.replace(/-/g, "").slice(0, 8);

const HELP = [
  "Use os botões abaixo do campo de texto:",
  "📊 Status — números atuais",
  "📋 Tarefas — o que está esperando você, com botões ✅ Aprovar / 🚫 Cancelar",
  "❓ Ajuda — esta mensagem",
  "",
  "Qualquer texto que você escrever vira uma tarefa para o operador (dias úteis, 5x ao dia). Ele responde aqui.",
].join("\n");

type Task = { id: string; agent: string; title: string; status: string; priority: number };
async function openTasks(): Promise<Task[]> {
  const { data, error } = await db().from("tasks").select("id,agent,title,status,priority,created_at").in("status", ["pending", "in_progress", "blocked"]).order("priority").order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as Task[];
}
const decisionButtons = (code: string): InlineButton[][] => [[{ text: "✅ Aprovar", data: `ok:${code}` }, { text: "🚫 Cancelar", data: `nao:${code}` }]];

interface Outcome { reply: string; taskId?: string; buttons?: InlineButton[][]; keyboard?: boolean; extra?: { text: string; buttons: InlineButton[][] }[] }

async function handle(p: Parsed, messageId: number): Promise<Outcome> {
  switch (p.command) {
    case "ajuda": return { reply: HELP, keyboard: true };
    case "status": return { reply: await buildWeeklyReport(), keyboard: true };
    case "tarefas": {
      const tasks = await openTasks();
      const blocked = tasks.filter((t) => t.status === "blocked");
      const founderAsks = blocked.filter((t) => !t.title.startsWith("Founder:"));
      const yours = blocked.filter((t) => t.title.startsWith("Founder:"));
      const working = tasks.length - blocked.length;
      const head = [`${tasks.length} tarefas abertas: ${working} em andamento com o operador, ${founderAsks.length} esperando sua decisão, ${yours.length} pendências suas (credenciais).`];
      if (yours.length) head.push("", "Pendências suas:", ...yours.map((t) => `• ${t.title.replace(/^Founder:\s*/, "").slice(0, 100)}`));
      if (founderAsks.length === 0) head.push("", "Nada esperando sua decisão agora.");
      return { reply: head.join("\n"), keyboard: true, extra: founderAsks.slice(0, 10).map((t) => ({ text: `⏸ ${t.title.slice(0, 200)}\n(tarefa ${shortCode(t.id)})`, buttons: decisionButtons(shortCode(t.id)) })) };
    }
    case "ok": case "nao": {
      const tasks = await openTasks();
      const hits = tasks.filter((t) => shortCode(t.id).startsWith(p.code));
      if (hits.length !== 1) return { reply: hits.length === 0 ? `Essa tarefa (${p.code}) já não está aberta.` : `Código ${p.code} é ambíguo; toque em 📋 Tarefas e use os botões.` };
      const t = hits[0]!; const when = new Date().toISOString().slice(0, 16).replace("T", " ");
      const note = p.note ? ` Nota: ${p.note}` : "";
      if (p.command === "ok") {
        const { error } = await db().from("tasks").update({ status: "pending", locked_by: null, locked_at: null, outcome: `Aprovado pelo fundador via Telegram em ${when} UTC.${note}` }).eq("id", t.id);
        if (error) throw new Error(error.message);
        await audit("founder", "task_approved", "tasks", t.id, { via: "telegram", message_id: messageId, note: p.note });
        return { reply: `✅ Aprovado: ${t.title.slice(0, 120)}\nO operador executa na próxima rodada.`, taskId: t.id };
      }
      const { error } = await db().from("tasks").update({ status: "canceled", outcome: `Cancelada pelo fundador via Telegram em ${when} UTC.${note}` }).eq("id", t.id);
      if (error) throw new Error(error.message);
      await audit("founder", "task_canceled", "tasks", t.id, { via: "telegram", message_id: messageId, note: p.note });
      return { reply: `🚫 Cancelada: ${t.title.slice(0, 120)}`, taskId: t.id };
    }
    case "tarefa": {
      const { data, error } = await db().from("tasks").insert({ agent: "orchestrator", title: `Fundador (Telegram): ${p.text.slice(0, 180)}`, priority: 2, payload: { source: "telegram", message_id: messageId, text: p.text } }).select("id").single();
      if (error) throw new Error(error.message);
      await audit("founder", "task_from_telegram", "tasks", data.id, { message_id: messageId });
      return { reply: `📝 Anotado. O operador cuida disso na próxima rodada e responde aqui.`, taskId: data.id, buttons: [[{ text: "🚫 Cancelar este pedido", data: `nao:${shortCode(data.id)}` }]] };
    }
    default: return { reply: "" };
  }
}

async function store(u: TelegramUpdate, msg: TgMessage, command: string, text: string | null): Promise<"ok" | "duplicate"> {
  const { error } = await db().from("founder_messages").insert({ update_id: u.update_id, message_id: msg.message_id, chat_id: String(msg.chat.id), text, command });
  if (error) { if (error.code === "23505") return "duplicate"; throw new Error(error.message); }
  return "ok";
}

/** Entry point for POST /webhooks/telegram. Always resolves (Telegram retries on non-200, so errors are logged, not thrown). */
export async function handleTelegramUpdate(u: TelegramUpdate): Promise<"handled" | "ignored" | "duplicate"> {
  const founder = config().TELEGRAM_FOUNDER_CHAT_ID;
  const msg = u.callback_query?.message ?? u.message;
  if (!msg || !founder || String(msg.chat.id) !== String(founder)) { log.warn("telegram update ignored", { update_id: u.update_id, chat: msg?.chat.id }); return "ignored"; }

  const isButton = !!u.callback_query;
  const parsed = isButton ? parseCallbackData(u.callback_query!.data) : parseFounderText(msg.text);
  if ((await store(u, msg, isButton ? `botão:${u.callback_query!.data ?? ""}` : parsed.command, isButton ? null : msg.text ?? null)) === "duplicate") return "duplicate";

  let out: Outcome = { reply: "" };
  try { out = await handle(parsed, msg.message_id); }
  catch (err) { log.error("founder command failed", { err: String(err) }); out = { reply: `Não consegui executar agora: ${String(err).slice(0, 160)}` }; }

  if (isButton) {
    await answerCallback(u.callback_query!.id, out.reply ? out.reply.split("\n")[0]!.slice(0, 180) : undefined);
    // Buttons are one-shot: rewrite the escalation with the outcome so it cannot be pressed twice.
    if (out.taskId && msg.text) await editFounderMessage(msg.message_id, `${msg.text}\n\n${out.reply.split("\n")[0]}`);
    else if (out.reply) await notifyFounder(out.reply, { keyboard: out.keyboard });
  } else if (out.reply) {
    await notifyFounder(out.reply, { replyTo: msg.message_id, buttons: out.buttons, keyboard: out.keyboard });
  }
  for (const e of out.extra ?? []) await notifyFounder(e.text, { buttons: e.buttons });
  await db().from("founder_messages").update({ reply: out.reply, task_id: out.taskId ?? null }).eq("update_id", u.update_id);
  return "handled";
}

/** For agents and the CLI: escalate a task with buttons. Marks it blocked if it is not already. */
export async function escalateTask(taskId: string, text: string): Promise<void> {
  await db().from("tasks").update({ status: "blocked" }).eq("id", taskId).neq("status", "blocked");
  await askFounder(shortCode(taskId), text);
}
