import { config } from "./config.js";
import { db, audit } from "./db.js";
import { notifyFounder } from "../reporting/telegram.js";

/**
 * Spend guardrail: any action costing more than the per-action cap is logged and the founder is
 * notified BEFORE the action proceeds. It does not block (visibility, not approval) but leaves a trail.
 */
export async function guardSpend(description: string, amountUsd: number, vendor?: string): Promise<void> {
  const cap = config().SPEND_CAP_USD_PER_ACTION;
  if (amountUsd <= cap) return;
  const { data } = await db()
    .from("spend_approvals")
    .insert({ description, amount_usd: amountUsd, vendor, notified_founder_at: new Date().toISOString() })
    .select("id")
    .single();
  await audit("agent", "spend_cap_exceeded", "spend_approvals", data?.id, { description, amountUsd, vendor });
  await notifyFounder(`⚠️ Gasto acima do teto: ${description}. US$ ${amountUsd.toFixed(2)} (${vendor ?? "n/a"}). Registrado em spend_approvals, id ${data?.id}.`);
}
