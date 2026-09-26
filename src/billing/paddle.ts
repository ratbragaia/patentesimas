/**
 * Paddle Billing webhooks. Signature: header `Paddle-Signature: ts=...;h1=...`,
 * h1 = HMAC-SHA256(secret, `${ts}:${rawBody}`). Events are deduplicated on event_id so a
 * replayed webhook (or a crashed session mid-processing) can never double-apply.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { db, audit } from "../lib/db.js";
import { notifyFounder } from "../reporting/telegram.js";

export function verifyPaddleSignature(rawBody: string, header: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(";").map((kv) => kv.split("=") as [string, string]));
  const ts = parts["ts"]; const h1 = parts["h1"];
  if (!ts || !h1) return false;
  if (Math.abs(nowSec - Number(ts)) > 300) return false; // 5-minute replay window
  const expected = createHmac("sha256", secret).update(`${ts}:${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "hex"); const b = Buffer.from(h1, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PaddleEvent { event_id: string; event_type: string; occurred_at: string; data: any }

const STATUS_MAP: Record<string, string> = { trialing: "trialing", active: "active", past_due: "past_due", paused: "paused", canceled: "canceled" };

export type PaddleEnvironment = "production" | "sandbox";

/** Pick the environment whose secret verifies the signature: live first, then sandbox. Null = no match. */
export function resolvePaddleEnvironment(rawBody: string, header: string | undefined, secrets: { production?: string; sandbox?: string }, nowSec?: number): PaddleEnvironment | null {
  if (secrets.production && verifyPaddleSignature(rawBody, header, secrets.production, nowSec)) return "production";
  if (secrets.sandbox && verifyPaddleSignature(rawBody, header, secrets.sandbox, nowSec)) return "sandbox";
  return null;
}

/** Returns true if the event was processed now, false if it was a duplicate. */
export async function handlePaddleEvent(ev: PaddleEvent, environment: PaddleEnvironment = "production"): Promise<boolean> {
  // 1) claim the event id first (idempotency). Unique violation => duplicate => stop.
  const { error } = await db().from("billing_events").insert({ event_id: ev.event_id, event_type: ev.event_type, occurred_at: ev.occurred_at, payload: ev, environment });
  if (error) { if (error.code === "23505") return false; throw new Error(error.message); }
  try {
    switch (ev.event_type) {
      case "subscription.created":
      case "subscription.activated":
      case "subscription.updated":
      case "subscription.past_due":
      case "subscription.paused":
      case "subscription.resumed":
      case "subscription.canceled":
        await upsertSubscription(ev.data, environment); break;
      case "transaction.completed":
        await onTransactionCompleted(ev.data, environment); break;
      case "transaction.payment_failed":
        await notifyFounder(`${environment === "sandbox" ? "🧪 [SANDBOX] " : ""}⚠️ Pagamento falhou: cliente ${ev.data?.customer_id} (transação ${ev.data?.id}).${environment === "sandbox" ? "" : " Tarefa de cobrança criada para o agente finance."}`);
        if (environment === "production") await db().from("tasks").insert({ agent: "finance", title: `Dunning: transaction ${ev.data?.id}`, payload: { transaction_id: ev.data?.id, customer_id: ev.data?.customer_id }, priority: 2 });
        break;
      default: break;
    }
    await db().from("billing_events").update({ processed_at: new Date().toISOString() }).eq("event_id", ev.event_id);
    return true;
  } catch (err) {
    await db().from("billing_events").update({ processing_error: String(err) }).eq("event_id", ev.event_id);
    throw err;
  }
}

async function ensureCustomer(paddleCustomerId: string, environment: PaddleEnvironment, email?: string, name?: string, country?: string) {
  const { data } = await db().from("customers").select("id").eq("paddle_customer_id", paddleCustomerId).maybeSingle();
  if (data) return data.id as string;
  const { data: created, error } = await db().from("customers").insert({ paddle_customer_id: paddleCustomerId, legal_name: name ?? email ?? paddleCustomerId, billing_email: email ?? "", country, environment }).select("id").single();
  if (error) throw new Error(error.message);
  await notifyFounder(environment === "sandbox" ? `🧪 [SANDBOX] Cliente de teste criado: ${name ?? email ?? paddleCustomerId}` : `🎉 Novo cliente pagante: ${name ?? email ?? paddleCustomerId}`);
  return created.id as string;
}

async function upsertSubscription(sub: any, environment: PaddleEnvironment) {
  const customerId = await ensureCustomer(sub.customer_id, environment);
  const item = sub.items?.[0];
  const priceId = item?.price?.id;
  const cols = environment === "sandbox" ? ["paddle_price_id_month_sandbox", "paddle_price_id_year_sandbox"] : ["paddle_price_id_month", "paddle_price_id_year"];
  const { data: plan } = await db().from("plans").select("code").or(`${cols[0]}.eq.${priceId},${cols[1]}.eq.${priceId}`).maybeSingle();
  await db().from("subscriptions").upsert({
    paddle_subscription_id: sub.id, customer_id: customerId, plan_code: plan?.code ?? "analyst", environment,
    status: STATUS_MAP[sub.status] ?? "active", seats: item?.quantity ?? 1,
    current_period_start: sub.current_billing_period?.starts_at ?? null, current_period_end: sub.current_billing_period?.ends_at ?? null,
  }, { onConflict: "paddle_subscription_id" });
  await audit("finance", "subscription_upsert", "subscriptions", sub.id, { status: sub.status });
}

async function onTransactionCompleted(tx: any, environment: PaddleEnvironment) {
  // Customer record only. No NFS-e per transaction: Paddle is the reseller, and the NFS-e is issued per Paddle
  // payout to the Paddle entity on the reverse invoice (ADR 0002 revised, `cli invoices enqueue-payout`).
  await ensureCustomer(tx.customer_id, environment);
  await audit("finance", "transaction_completed", "billing_events", tx.id, { environment, customer_id: tx.customer_id, total: tx.details?.totals?.total, subscription_id: tx.subscription_id ?? null });
}
