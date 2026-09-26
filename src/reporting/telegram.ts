import { createHash } from "node:crypto";
import { config } from "../lib/config.js";
import { http, httpJson } from "../lib/http.js";
import { log } from "../lib/log.js";

/** Founder notification (pt-BR). Never throws: reporting must not break operations. */
export async function notifyFounder(text: string, opts: { replyTo?: number } = {}): Promise<void> {
  const { TELEGRAM_BOT_TOKEN: t, TELEGRAM_FOUNDER_CHAT_ID: chat } = config();
  if (!t || !chat) { log.info("telegram not configured; message", { text }); return; }
  try {
    await http(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true, ...(opts.replyTo ? { reply_parameters: { message_id: opts.replyTo } } : {}) }),
    });
  } catch (err) { log.error("telegram failed", { err: String(err) }); }
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
    body: JSON.stringify({ url: `${PUBLIC_SITE_URL}/webhooks/telegram`, secret_token: telegramWebhookSecret(t), allowed_updates: ["message"], drop_pending_updates: false }),
  });
}

export async function getTelegramWebhookInfo(): Promise<unknown> {
  const { TELEGRAM_BOT_TOKEN: t } = config();
  if (!t) throw new Error("Missing credential TELEGRAM_BOT_TOKEN");
  return httpJson(`https://api.telegram.org/bot${t}/getWebhookInfo`);
}
