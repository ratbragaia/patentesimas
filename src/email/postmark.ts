/**
 * Postmark. Newsletter goes through a Broadcast message stream (requires unsubscribe link),
 * customer/transactional mail through the transactional stream. Cold outreach does NOT go
 * through Postmark (see docs/research/04-compliance-and-payments.md).
 */
import { config, require } from "../lib/config.js";
import { httpJson } from "../lib/http.js";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";

interface PostmarkMessage { From: string; To: string; Subject: string; HtmlBody?: string; TextBody?: string; MessageStream: string; Tag?: string; Metadata?: Record<string, string> }
interface PostmarkResult { To: string; MessageID: string; ErrorCode: number; Message: string }

async function sendBatch(msgs: PostmarkMessage[]): Promise<PostmarkResult[]> {
  if (msgs.length === 0) return [];
  return httpJson<PostmarkResult[]>("https://api.postmarkapp.com/email/batch", {
    method: "POST",
    headers: { "X-Postmark-Server-Token": require("POSTMARK_SERVER_TOKEN"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(msgs),
  });
}

/** Idempotent issue send: deliveries(issue_id, subscriber_id) is unique; already-sent rows are skipped. */
export async function sendIssue(issueNumber: number): Promise<{ sent: number; skipped: number; failed: number }> {
  const c = config();
  const { data: issue } = await db().from("issues").select("*").eq("issue_number", issueNumber).single();
  if (!issue) throw new Error(`issue ${issueNumber} not found`);
  if (!issue.qa_passed || issue.status === "qa_failed") throw new Error(`issue ${issueNumber} has not passed QA; refusing to send`);

  const { data: recipients } = await db().from("v_active_recipients").select("*");
  const { data: done } = await db().from("deliveries").select("subscriber_id").eq("issue_id", issue.id).eq("status", "sent");
  const doneSet = new Set((done ?? []).map((d: any) => d.subscriber_id));
  const pending = (recipients ?? []).filter((r: any) => !doneSet.has(r.subscriber_id));

  let sent = 0, failed = 0;
  for (let i = 0; i < pending.length; i += 50) {
    const chunk = pending.slice(i, i + 50);
    const msgs: PostmarkMessage[] = chunk.map((r: any) => ({
      From: c.EMAIL_FROM, To: r.email, Subject: issue.title, MessageStream: c.POSTMARK_BROADCAST_STREAM, Tag: `issue-${issueNumber}`,
      HtmlBody: String(issue.html).replaceAll("{{UNSUBSCRIBE_URL}}", `${c.PUBLIC_SITE_URL}/unsubscribe?token=${r.unsubscribe_token}`),
      TextBody: String(issue.markdown) + `\n\nUnsubscribe: ${c.PUBLIC_SITE_URL}/unsubscribe?token=${r.unsubscribe_token}`,
      Metadata: { subscriber_id: r.subscriber_id },
    }));
    const results = await sendBatch(msgs);
    for (let j = 0; j < results.length; j++) {
      const r = results[j]!; const sub = chunk[j]!;
      const ok = r.ErrorCode === 0;
      ok ? sent++ : failed++;
      await db().from("deliveries").upsert({ issue_id: issue.id, subscriber_id: sub.subscriber_id, provider_message_id: r.MessageID || null,
        status: ok ? "sent" : "failed", sent_at: ok ? new Date().toISOString() : null }, { onConflict: "issue_id,subscriber_id" });
      if (!ok) log.warn("postmark error", { to: r.To, code: r.ErrorCode, msg: r.Message });
    }
  }
  if (sent > 0) await db().from("issues").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", issue.id);
  await audit("production", "issue_sent", "issues", String(issueNumber), { sent, failed, skipped: doneSet.size });
  return { sent, skipped: doneSet.size, failed };
}

/** Called by Postmark bounce/complaint webhooks and the unsubscribe endpoint. */
export async function suppress(email: string, reason: string): Promise<void> {
  const domain = email.split("@")[1] ?? null;
  await db().from("do_not_contact").upsert({ email: email.toLowerCase(), domain, reason }, { onConflict: "email" });
  await db().from("subscribers").update({ active: false }).eq("email", email.toLowerCase());
  await audit("system", "suppressed", "do_not_contact", email, { reason });
}
