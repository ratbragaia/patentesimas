/**
 * Outreach mailbox on the separate domain (ADR 0003, amended 2026-09-26: no paid sequencing tool at launch).
 *  - `dailyAllowance()`: warm-up ramp (5 → 10 → 20 → 25/day) and the hard cap from CLAUDE.md rule 5.
 *  - `sendBatch()`: takes queued drafts (ps.outreach_messages, direction outbound, sent_at null), re-runs
 *    checkOutreach() against the live suppression list, sends via SMTP with List-Unsubscribe headers, records
 *    Message-ID and moves the lead to `contacted`.
 *  - `pollInbox()`: reads unseen mail from the mailbox via IMAP, stores it through the same inbound pipeline
 *    as support@ (ps.inbound_emails → sales task), suppresses opt-out replies, moves leads to `replied`.
 *  - `/api/optout` token: HMAC of the address, no database round-trip to verify.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import { config } from "../lib/config.js";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { COMPANY } from "../lib/company.js";
import { checkOutreach } from "./compliance.js";
import { parseInbound, recordInbound } from "../email/inbound.js";
import { suppress } from "../email/postmark.js";

/** Warm-up ramp by mailbox age (days since the first send), never above the cap. */
export function dailyAllowance(firstSendDate: string | null, today: string, cap: number): number {
  if (!firstSendDate) return Math.min(5, cap);
  const days = Math.floor((Date.parse(today) - Date.parse(firstSendDate)) / 86_400_000);
  const ramp = days < 7 ? 5 : days < 14 ? 10 : days < 21 ? 20 : cap;
  return Math.min(ramp, cap);
}

const optoutSecret = () => config().OUTREACH_OPTOUT_SECRET ?? createHmac("sha256", config().OPS_TOKEN ?? "patentsonar").update("optout").digest("hex");
export function optoutToken(email: string): string { return createHmac("sha256", optoutSecret()).update(email.toLowerCase().trim()).digest("hex").slice(0, 24); }
export function optoutUrl(email: string): string {
  return `${config().PUBLIC_SITE_URL}/api/optout?e=${Buffer.from(email.toLowerCase().trim()).toString("base64url")}&t=${optoutToken(email)}`;
}
export function verifyOptout(e: string | null, t: string | null): string | null {
  if (!e || !t) return null;
  let email: string; try { email = Buffer.from(e, "base64url").toString("utf8"); } catch { return null; }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  const a = Buffer.from(optoutToken(email)); const b = Buffer.from(t);
  return a.length === b.length && timingSafeEqual(a, b) ? email : null;
}

function smtp() {
  const c = config();
  if (!c.OUTREACH_SMTP_HOST || !c.OUTREACH_SMTP_USER || !c.OUTREACH_SMTP_PASS) throw new Error("outreach mailbox not configured (OUTREACH_SMTP_*; handoff item 14)");
  return nodemailer.createTransport({ host: c.OUTREACH_SMTP_HOST, port: c.OUTREACH_SMTP_PORT, secure: c.OUTREACH_SMTP_PORT === 465, auth: { user: c.OUTREACH_SMTP_USER, pass: c.OUTREACH_SMTP_PASS } });
}
const fromAddress = () => { const m = /<([^>]+)>/.exec(config().OUTREACH_FROM ?? ""); return (m?.[1] ?? config().OUTREACH_FROM ?? config().OUTREACH_SMTP_USER ?? "").toLowerCase(); };

interface Draft { id: string; lead_id: string | null; contact_id: string | null; subject: string; body: string; to_email: string | null; sequence_step: number | null; template: string | null; created_at: string }

/** True once handoff item 14 (mailbox address + password) is in the environment; timers no-op until then. */
export function mailboxConfigured(): boolean { const c = config(); return Boolean(c.OUTREACH_SMTP_HOST && c.OUTREACH_IMAP_HOST && c.OUTREACH_SMTP_USER && c.OUTREACH_SMTP_PASS); }

export async function sendBatch(limit?: number, today = new Date().toISOString().slice(0, 10)): Promise<{ sent: number; blocked: number; allowance: number; skipped?: string }> {
  const c = config();
  if (!mailboxConfigured()) { log.info("outreach send-batch skipped: mailbox not configured (handoff item 14)"); return { sent: 0, blocked: 0, allowance: 0, skipped: "mailbox not configured" }; }
  const { data: first } = await db().from("outreach_messages").select("sent_at").eq("direction", "outbound").not("sent_at", "is", null).order("sent_at").limit(1).maybeSingle();
  const { count: sentToday } = await db().from("outreach_messages").select("*", { count: "exact", head: true }).eq("direction", "outbound").gte("sent_at", `${today}T00:00:00Z`);
  const allowance = Math.max(0, dailyAllowance(first?.sent_at?.slice(0, 10) ?? null, today, c.OUTREACH_DAILY_CAP) - (sentToday ?? 0));
  const take = Math.min(allowance, limit ?? allowance);
  if (take === 0) return { sent: 0, blocked: 0, allowance };
  const { data: drafts, error } = await db().from("outreach_messages").select("id,lead_id,contact_id,subject,body,to_email,sequence_step,template,created_at").eq("direction", "outbound").is("sent_at", null).is("error", null).order("created_at").limit(take);
  if (error) throw new Error(error.message);
  const { data: dnc } = await db().from("do_not_contact").select("email,domain");
  const suppressed = new Set<string>((dnc ?? []).flatMap((d: any) => [d.email, d.domain ? `@${d.domain}` : null]).filter(Boolean));
  const transport = smtp(); let sent = 0, blocked = 0;
  for (const d of (drafts ?? []) as Draft[]) {
    const { data: contact } = d.contact_id ? await db().from("contacts").select("email,country,full_name").eq("id", d.contact_id).maybeSingle() : { data: null };
    const to = (d.to_email ?? contact?.email ?? "").toLowerCase();
    const check = checkOutreach({ toEmail: to, toCountry: contact?.country ?? null, subject: d.subject, body: d.body, senderName: c.OUTREACH_FROM ?? "", companyName: COMPANY.brand, postalAddress: c.COMPANY_POSTAL_ADDRESS, unsubscribeUrl: optoutUrl(to) }, suppressed);
    if (!to || !check.ok) {
      blocked++;
      await db().from("outreach_messages").update({ compliance_checked: false, error: `blocked: ${check.problems.join("; ") || "no recipient"}` }).eq("id", d.id);
      log.warn("outreach draft blocked", { id: d.id, problems: check.problems }); continue;
    }
    try {
      const info = await transport.sendMail({ from: c.OUTREACH_FROM, to, subject: d.subject, text: d.body,
        headers: { "List-Unsubscribe": `<${optoutUrl(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click", "Precedence": "bulk" } });
      await db().from("outreach_messages").update({ compliance_checked: true, sent_at: new Date().toISOString(), provider_message_id: info.messageId ?? null, to_email: to }).eq("id", d.id);
      if (d.lead_id) await db().from("leads").update({ stage: "contacted", next_action: "await reply; follow up in 7 days", next_action_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }).eq("id", d.lead_id).in("stage", ["identified", "researched"]);
      await audit("sales", "outreach_sent", "outreach_messages", d.id, { to_domain: to.split("@")[1], template: d.template, step: d.sequence_step });
      sent++;
    } catch (err) {
      await db().from("outreach_messages").update({ error: `smtp: ${String(err).slice(0, 300)}` }).eq("id", d.id);
      log.error("outreach send failed", { id: d.id, err: String(err) });
    }
  }
  return { sent, blocked, allowance };
}

const OPTOUT_RE = /\b(unsubscribe|remove me|opt[ -]?out|stop emailing|do not contact|não quero|descadastr|no more emails)\b/i;

export async function pollInbox(): Promise<{ fetched: number; stored: number; optouts: number; skipped?: string }> {
  const c = config();
  if (!mailboxConfigured()) { log.info("outreach poll skipped: mailbox not configured (handoff item 14)"); return { fetched: 0, stored: 0, optouts: 0, skipped: "mailbox not configured" }; }
  const client = new ImapFlow({ host: c.OUTREACH_IMAP_HOST, port: c.OUTREACH_IMAP_PORT, secure: true, auth: { user: c.OUTREACH_SMTP_USER!, pass: c.OUTREACH_SMTP_PASS! }, logger: false });
  let fetched = 0, stored = 0, optouts = 0;
  await client.connect();
  const lock = await client.getMailboxLock("INBOX");
  try {
    for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
      fetched++;
      if (!msg.source) continue;
      const parsed = await parseInbound(msg.source, { to: fromAddress() });
      const outcome = await recordInbound(parsed);
      if (outcome === "stored") stored++;
      if (OPTOUT_RE.test(`${parsed.subject ?? ""}\n${(parsed.text_body ?? "").slice(0, 500)}`)) { await suppress(parsed.from_email, "unsubscribed"); optouts++; }
      const { data: contact } = await db().from("contacts").select("id").eq("email", parsed.from_email).maybeSingle();
      if (contact) await db().from("leads").update({ stage: "replied", next_action: "answer within 1 business day" }).eq("contact_id", contact.id).in("stage", ["contacted", "researched"]);
      await client.messageFlagsAdd({ uid: msg.uid }, ["\\Seen"], { uid: true });
    }
  } finally { lock.release(); await client.logout(); }
  if (fetched) await audit("sales", "outreach_inbox_polled", "inbound_emails", undefined, { fetched, stored, optouts });
  return { fetched, stored, optouts };
}
