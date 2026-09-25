import { config } from "../lib/config.js";
import { http } from "../lib/http.js";
import { log } from "../lib/log.js";

/** Founder notification. Never throws: reporting must not break operations. */
export async function notifyFounder(text: string): Promise<void> {
  const { TELEGRAM_BOT_TOKEN: t, TELEGRAM_FOUNDER_CHAT_ID: chat } = config();
  if (!t || !chat) { log.info("telegram not configured; message", { text }); return; }
  try {
    await http(`https://api.telegram.org/bot${t}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
  } catch (err) { log.error("telegram failed", { err: String(err) }); }
}
