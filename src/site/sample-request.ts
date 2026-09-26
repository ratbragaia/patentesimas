/**
 * Website "Get this week's issue" form → POST /api/sample-request on the webhook server.
 * Replaces the formsubmit.co action (ADR 0010): the request is stored in ps.sample_requests,
 * a `sales` task is queued for the orchestrator and the founder is notified on Telegram.
 *
 * Pure parsing/validation lives here so it can be unit-tested without a server or database.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { db, audit } from "../lib/db.js";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { notifyFounder } from "../reporting/telegram.js";

/** Exact wording shown next to the form; stored with every request as the consent record. */
export const CONSENT_TEXT =
  "Your address is used only to send the sample and, if you ask, to set up a subscription. No automated drip, no list sale.";

/** Free-mail and disposable domains are accepted but flagged: buyers are companies, so sales triages these last. */
const FREEMAIL = new Set(["gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "hotmail.com", "outlook.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "web.de", "mail.com", "qq.com", "163.com", "126.com", "naver.com", "yandex.com", "yandex.ru"]);

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  company: z.string().trim().max(200).optional().default(""),
  /** Honeypot: real browsers leave it empty; bots fill every field. */
  website: z.string().trim().max(500).optional().default(""),
  source: z.string().trim().max(40).regex(/^[a-z0-9_-]*$/i).optional().default("site"),
});

export type SampleRequestInput = z.infer<typeof schema>;
export type ParseResult =
  | { ok: true; value: SampleRequestInput; bot: boolean; freemail: boolean }
  | { ok: false; error: string };

/** Accepts `application/x-www-form-urlencoded` (the plain HTML form) and JSON. */
export function parseSampleRequest(rawBody: string, contentType: string | undefined): ParseResult {
  let obj: Record<string, unknown>;
  try {
    if (contentType?.includes("application/json")) {
      const parsed: unknown = JSON.parse(rawBody || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { ok: false, error: "body must be a JSON object" };
      obj = parsed as Record<string, unknown>;
    } else {
      obj = Object.fromEntries(new URLSearchParams(rawBody));
    }
  } catch { return { ok: false, error: "malformed body" }; }
  const r = schema.safeParse(obj);
  if (!r.success) return { ok: false, error: r.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ") };
  const domain = r.data.email.split("@")[1] ?? "";
  return { ok: true, value: r.data, bot: r.data.website !== "", freemail: FREEMAIL.has(domain) };
}

/** Privacy: we never store the raw IP. sha256(ip + UTC day) is enough for same-day rate limiting and abuse review. */
export function hashIp(ip: string | undefined, day = new Date().toISOString().slice(0, 10)): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${ip}|${day}`).digest("hex").slice(0, 32);
}

/** Simple sliding-window limiter keyed by IP hash: ≤ 5 requests / 10 min per key, ≤ 60 / 10 min overall. */
export class RateLimiter {
  private hits = new Map<string, number[]>();
  private all: number[] = [];
  constructor(private perKey = 5, private overall = 60, private windowMs = 600_000) {}
  allow(key: string, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    this.all = this.all.filter((t) => t > cutoff);
    const mine = (this.hits.get(key) ?? []).filter((t) => t > cutoff);
    if (mine.length >= this.perKey || this.all.length >= this.overall) return false;
    mine.push(now); this.hits.set(key, mine); this.all.push(now);
    if (this.hits.size > 5000) for (const [k, v] of this.hits) if (!v.some((t) => t > cutoff)) this.hits.delete(k);
    return true;
  }
}

export interface RecordMeta { ipHash: string | null; userAgent: string | null; freemail: boolean }

/** Store the request, queue the sales task, notify the founder. Telegram/task failures never lose the row. */
export async function recordSampleRequest(input: SampleRequestInput, meta: RecordMeta): Promise<{ id: string; isNew: boolean; requestCount: number }> {
  const { data, error } = await db().rpc("record_sample_request", {
    p_email: input.email, p_company: input.company || null, p_source: input.source || "site",
    p_ip_hash: meta.ipHash, p_user_agent: meta.userAgent?.slice(0, 300) ?? null, p_consent_text: CONSENT_TEXT,
  });
  if (error) throw new Error(`record_sample_request: ${error.message}`);
  const raw = (Array.isArray(data) ? data[0] : data) as { request_id: string; is_new: boolean; requests: number } | undefined;
  if (!raw) throw new Error("record_sample_request returned no row");
  const row = { id: raw.request_id, is_new: raw.is_new, request_count: raw.requests };
  const result = { id: row.id, isNew: row.is_new, requestCount: row.request_count };

  try {
    await audit("site", "sample_requested", "sample_requests", row.id, { email_domain: input.email.split("@")[1], is_new: row.is_new, freemail: meta.freemail });
    if (row.is_new) {
      await db().from("tasks").insert({
        agent: "sales", title: `Send sample issue to ${input.email}${input.company ? ` (${input.company})` : ""}`, priority: meta.freemail ? 4 : 2,
        payload: { sample_request_id: row.id, email: input.email, company: input.company || null, freemail: meta.freemail, source: input.source },
      });
    }
  } catch (err) { log.error("sample request follow-up failed", { id: row.id, err: String(err) }); }

  const { PUBLIC_SITE_URL } = config();
  const flag = meta.freemail ? " · free-mail address" : "";
  await notifyFounder(row.is_new
    ? `📩 Sample request: ${input.email}${input.company ? ` · ${input.company}` : ""}${flag}\nQueued for sales (tasks). ${PUBLIC_SITE_URL}`
    : `📩 Repeat sample request (#${row.request_count}): ${input.email}${input.company ? ` · ${input.company}` : ""}${flag}`);
  return result;
}
