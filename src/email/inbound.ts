/**
 * Inbound email: raw MIME arrives from the Cloudflare Email Worker (infra/cloudflare/), is parsed,
 * stored once in ps.inbound_emails and turned into a `sales` task for the headless runner (ADR 0010).
 */
import { createHash } from "node:crypto";
import PostalMime from "postal-mime";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";

export interface ParsedInbound {
  message_id: string | null; content_hash: string; from_email: string; from_name: string | null; to_email: string;
  subject: string | null; text_body: string | null; html_body: string | null; in_reply_to: string | null;
  references_ids: string[]; headers: Record<string, string>; raw_size: number;
}

const AUTO_HEADERS = ["auto-submitted", "x-autoreply", "x-autorespond"];
const KEEP_HEADERS = ["date", "from", "to", "cc", "reply-to", "message-id", "in-reply-to", "references", "subject", "list-unsubscribe", "auto-submitted", "x-autoreply", "precedence", "dkim-signature", "authentication-results"];

export async function parseInbound(raw: Uint8Array | string, envelope: { from?: string; to?: string }): Promise<ParsedInbound> {
  const bytes = typeof raw === "string" ? Buffer.from(raw) : raw;
  const mail = await new PostalMime().parse(bytes);
  const headers: Record<string, string> = {};
  for (const h of mail.headers ?? []) { const k = h.key.toLowerCase(); if (KEEP_HEADERS.includes(k)) headers[k] = k === "dkim-signature" ? h.value.slice(0, 120) : h.value; }
  const fromEmail = (mail.from?.address ?? envelope.from ?? "").toLowerCase().trim();
  if (!fromEmail) throw new Error("inbound mail without sender");
  const refs = (mail.references ?? "").split(/\s+/).map((s) => s.trim()).filter(Boolean);
  return {
    message_id: mail.messageId ?? null,
    content_hash: createHash("sha256").update(bytes).digest("hex"),
    from_email: fromEmail, from_name: mail.from?.name || null,
    to_email: (envelope.to ?? mail.to?.[0]?.address ?? "").toLowerCase().trim(),
    subject: mail.subject ?? null, text_body: mail.text ?? null, html_body: mail.html ?? null,
    in_reply_to: mail.inReplyTo ?? null, references_ids: refs, headers, raw_size: bytes.byteLength,
  };
}

/** Auto-replies, bounces and list mail never open a task. */
export function isAutomated(p: ParsedInbound): boolean {
  const h = p.headers;
  if (AUTO_HEADERS.some((k) => h[k] && !/^no$/i.test(h[k]!))) return true;
  if (/^(bulk|list|junk)$/i.test(h["precedence"] ?? "")) return true;
  if (/^(mailer-daemon|postmaster|no-?reply|do-?not-?reply)@/i.test(p.from_email)) return true;
  return false;
}

/** Store the message (idempotent on message_id / content hash) and open a sales task. Returns 'stored' | 'duplicate' | 'ignored'. */
export async function recordInbound(p: ParsedInbound): Promise<"stored" | "duplicate" | "ignored"> {
  const automated = isAutomated(p);
  const { data: dnc } = await db().from("do_not_contact").select("email").eq("email", p.from_email).maybeSingle();
  const status = dnc ? "suppressed" : automated ? "ignored" : "new";
  const { data: row, error } = await db().from("inbound_emails")
    .insert({ ...p, status }).select("id").single();
  if (error) {
    if (error.code === "23505") return "duplicate";
    throw new Error(`inbound insert: ${error.message}`);
  }
  if (status !== "new") { log.info("inbound stored without task", { from: p.from_email, status }); return "ignored"; }
  const title = `Reply to ${p.from_email}: ${(p.subject ?? "(no subject)").slice(0, 80)}`;
  const { data: task } = await db().from("tasks").insert({
    agent: "sales", title, priority: 2, status: "pending",
    payload: { inbound_email_id: row!.id, from: p.from_email, to: p.to_email, subject: p.subject, in_reply_to: p.in_reply_to },
  }).select("id").single();
  if (task) await db().from("inbound_emails").update({ task_id: task.id }).eq("id", row!.id);
  await audit("webhooks", "inbound_email", "inbound_emails", row!.id, { from: p.from_email, to: p.to_email });
  log.info("inbound email stored", { from: p.from_email, to: p.to_email, task: task?.id });
  return "stored";
}
