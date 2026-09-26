import { createHash } from "node:crypto";
import { config } from "../lib/config.js";
import { http, httpJson } from "../lib/http.js";
import { log } from "../lib/log.js";

export interface InlineButton { text: string; data: string }
export interface SendOptions {
  replyTo?: number;
  /** Rows of inline buttons under the message (callback_data ≤ 64 bytes). */
  buttons?: InlineButton[][];
  /** Attach the persistent shortcut keyboard (📊 Status · 📋 Tarefas · ❓ Ajuda). */
  keyboard?: boolean;
}

/** The founder's fixed shortcut keyboard; sent once, Telegram keeps it under the input box. */
export const FOUNDER_KEYBOARD = { keyboard: [[{ text: "📊 Status" }, { text: "📋 Tarefas" }, { text: "❓ Ajuda" }]], resize_keyboard: true, is_persistent: true };

function replyMarkup(opts: SendOptions): Record<string, unknown> | undefined {
  if (opts.buttons?.length) return { inline_keyboard: opts.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) };
  if (opts.keyboard) return FOUNDER_KEYBOARD;
  return undefined;
}

async function api(method: string, body: Record<string, unknown>): Promise<unknown> {
  const { TELEGRAM_BOT_TOKEN: t } = config();
  if (!t) throw new Error("Missing credential TELEGRAM_BOT_TOKEN");
  return httpJson(`https://api.telegram.org/bot${t}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

/** Founder notification (pt-BR). Never throws: reporting must not break operations. Returns the message id when sent. */
export async function notifyFounder(text: string, opts: SendOptions = {}): Promise<number | null> {
  const { TELEGRAM_BOT_TOKEN: t, TELEGRAM_FOUNDER_CHAT_ID: chat } = config();
  if (!t || !chat) { log.info("telegram not configured; message", { text }); return null; }
  try {
    const res = await api("sendMessage", { chat_id: chat, text, disable_web_page_preview: true,
      ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo } } : {}), ...(replyMarkup(opts) ? { reply_markup: replyMarkup(opts) } : {}) }) as { result?: { message_id?: number } };
    return res.result?.message_id ?? null;
  } catch (err) { log.error("telegram failed", { err: String(err) }); return null; }
}

/** Replace the text of one of our messages and drop its buttons (after the founder pressed one). Never throws. */
export async function editFounderMessage(messageId: number, text: string): Promise<void> {
  const { TELEGRAM_FOUNDER_CHAT_ID: chat } = config();
  try { await api("editMessageText", { chat_id: chat, message_id: messageId, text, disable_web_page_preview: true }); }
  catch (err) { log.warn("telegram edit failed", { err: String(err) }); }
}

/** Stop the button spinner; optional toast. Never throws. */
export async function answerCallback(callbackId: string, text?: string): Promise<void> {
  try { await api("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) }); }
  catch (err) { log.warn("telegram answerCallback failed", { err: String(err) }); }
}

/** Escalation with buttons: the founder taps ✅ or 🚫 instead of typing a command. Used by `cli tasks ask` and the agents. */
export async function askFounder(taskShortCode: string, text: string): Promise<number | null> {
  return notifyFounder(`${text}

(tarefa ${taskShortCode})`, { buttons: [[{ text: "✅ Aprovar", data: `ok:${taskShortCode}` }, { text: "🚫 Cancelar", data: `nao:${taskShortCode}` }]] });
}

/**
 * Secret Telegram sends back in `X-Telegram-Bot-Api-Secret-Token` on every webhook call (ADR 0013).
 * Derived from the bot token, so no new credential to store; anyone holding the token already owns the bot.
 */
export function telegramWebhookSecret(botToken = config().TELEGRAM_BOT_TOKEN): string {
  if (!botToken) throw new Error("Missing credential TELEGRAM_BOT_TOKEN");
  return createHash("sha256").update(`${botToken}|patentsonar-webhook`).digest("hex");
}

/** Register (or refresh) the webhook so founder messages reach POST /webhooks/telegram. Run once: `cli telegram setup`. */
export async function setTelegramWebhook(): Promise<unknown> {
  const { TELEGRAM_BOT_TOKEN: t, PUBLIC_SITE_URL } = config();
  if (!t) throw new Error("Missing credential TELEGRAM_BOT_TOKEN");
  return httpJson(`https://api.telegram.org/bot${t}/setWebhook`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${PUBLIC_SITE_URL}/webhooks/telegram`, secret_token: telegramWebhookSecret(t), allowed_updates: ["message", "callback_query"], drop_pending_updates: false }),
  });
}

export async function getTelegramWebhookInfo(): Promise<unknown> {
  const { TELEGRAM_BOT_TOKEN: t } = config();
  if (!t) throw new Error("Missing credential TELEGRAM_BOT_TOKEN");
  return httpJson(`https://api.telegram.org/bot${t}/getWebhookInfo`);
}
