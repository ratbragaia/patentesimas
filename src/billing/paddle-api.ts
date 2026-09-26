/**
 * Minimal Paddle Billing API client (live and sandbox) for the two things we automate:
 *  - `ensurePlans(env)`: create the three products and their monthly/yearly USD prices once, idempotently
 *    (matched by custom_data.patentsonar_plan), and store the ids in ps.plans (env-specific columns).
 *  - `simulate(env, type)`: use Paddle's notification simulations to send a signed test webhook to our
 *    destination, then confirm it landed in ps.billing_events. No browser, no card, no money.
 */
import { config } from "../lib/config.js";
import { httpJson } from "../lib/http.js";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import type { PaddleEnvironment } from "./paddle.js";

const BASE: Record<PaddleEnvironment, string> = { production: "https://api.paddle.com", sandbox: "https://sandbox-api.paddle.com" };

export function paddleKey(env: PaddleEnvironment): string {
  const c = config();
  const k = env === "sandbox" ? c.PADDLE_SANDBOX_API_KEY : c.PADDLE_API_KEY;
  if (!k) throw new Error(`Missing credential ${env === "sandbox" ? "PADDLE_SANDBOX_API_KEY" : "PADDLE_API_KEY"}`);
  return k;
}

async function api<T>(env: PaddleEnvironment, method: "GET" | "POST" | "PATCH", path: string, body?: unknown): Promise<T> {
  const res = await httpJson<{ data: T }>(`${BASE[env]}${path}`, {
    method, headers: { Authorization: `Bearer ${paddleKey(env)}`, "Content-Type": "application/json", "Paddle-Version": "1" },
    body: body ? JSON.stringify(body) : undefined, retries: 1,
  });
  return res.data;
}

export interface PlanRow { code: string; name: string; price_usd_month: number; price_usd_year: number | null; seats: number }

/** Pure: Paddle product and price payloads for one plan (tested). Amounts are in cents as strings, per the API. */
export function planPayloads(p: PlanRow) {
  const cents = (usd: number) => String(Math.round(usd * 100));
  const description = `PatentSonar ${p.name} — Stream 01: rare-earth-free permanent magnets`;
  return {
    product: { name: `PatentSonar ${p.name}`, tax_category: "saas", description, custom_data: { patentsonar_plan: p.code } },
    month: { description: `${p.name} monthly`, unit_price: { amount: cents(p.price_usd_month), currency_code: "USD" }, billing_cycle: { interval: "month", frequency: 1 }, quantity: { minimum: 1, maximum: 1 }, custom_data: { patentsonar_plan: p.code, cycle: "month" } },
    year: p.price_usd_year ? { description: `${p.name} yearly (2 months free)`, unit_price: { amount: cents(p.price_usd_year), currency_code: "USD" }, billing_cycle: { interval: "year", frequency: 1 }, quantity: { minimum: 1, maximum: 1 }, custom_data: { patentsonar_plan: p.code, cycle: "year" } } : null,
  };
}

/** Create or reuse products/prices for every plan; write ids into ps.plans. Idempotent. */
export async function ensurePlans(env: PaddleEnvironment): Promise<{ code: string; product: string; month: string; year: string | null }[]> {
  const { data: plans, error } = await db().from("plans").select("code,name,price_usd_month,price_usd_year,seats").eq("active", true).order("price_usd_month");
  if (error) throw new Error(error.message);
  const existingProducts = await api<any[]>(env, "GET", "/products?status=active&per_page=200");
  const out: { code: string; product: string; month: string; year: string | null }[] = [];
  for (const p of (plans ?? []) as PlanRow[]) {
    const payloads = planPayloads(p);
    let product = existingProducts.find((x) => x.custom_data?.patentsonar_plan === p.code);
    if (!product) product = await api<any>(env, "POST", "/products", payloads.product);
    const prices = await api<any[]>(env, "GET", `/prices?product_id=${product.id}&status=active&per_page=50`);
    const find = (cycle: string) => prices.find((x) => x.custom_data?.cycle === cycle);
    const month = find("month") ?? await api<any>(env, "POST", "/prices", { ...payloads.month, product_id: product.id });
    const year = payloads.year ? (find("year") ?? await api<any>(env, "POST", "/prices", { ...payloads.year, product_id: product.id })) : null;
    const cols = env === "sandbox"
      ? { paddle_product_id_sandbox: product.id, paddle_price_id_month_sandbox: month.id, paddle_price_id_year_sandbox: year?.id ?? null }
      : { paddle_product_id: product.id, paddle_price_id_month: month.id, paddle_price_id_year: year?.id ?? null };
    const { error: upErr } = await db().from("plans").update(cols).eq("code", p.code);
    if (upErr) throw new Error(upErr.message);
    out.push({ code: p.code, product: product.id, month: month.id, year: year?.id ?? null });
  }
  await audit("finance", "paddle_plans_synced", "plans", env, { plans: out });
  log.info("paddle plans synced", { env, plans: out });
  return out;
}

/** Find our notification destination in this environment (by URL). */
export async function findNotificationSetting(env: PaddleEnvironment): Promise<{ id: string; destination: string } | null> {
  const list = await api<any[]>(env, "GET", "/notification-settings");
  const url = `${config().PUBLIC_SITE_URL}/webhooks/paddle`;
  const hit = list.find((n) => n.destination === url && n.active !== false);
  return hit ? { id: hit.id, destination: hit.destination } : null;
}

export const SIMULATION_TYPES = ["subscription.created", "subscription.activated", "transaction.completed", "transaction.payment_failed", "subscription.canceled"] as const;

/** Ask Paddle to send a simulated (signed) webhook of `type` to our destination, then check it arrived. */
export async function simulate(env: PaddleEnvironment, type: (typeof SIMULATION_TYPES)[number]): Promise<{ simulationId: string; runId: string; delivered: boolean; storedEventIds: string[] }> {
  const setting = await findNotificationSetting(env);
  if (!setting) throw new Error(`no Paddle notification destination for ${config().PUBLIC_SITE_URL}/webhooks/paddle in ${env}; create it in Developer Tools → Notifications first`);
  const sim = await api<any>(env, "POST", "/simulations", { notification_setting_id: setting.id, type, name: `ps ${type} ${new Date().toISOString().slice(5, 16)}`.slice(0, 50) });
  const run = await api<any>(env, "POST", `/simulations/${sim.id}/runs`, {});
  // Paddle delivers within seconds; poll our own table (environment=sandbox|production) for up to ~30s.
  const since = new Date(Date.now() - 60_000).toISOString();
  for (let i = 0; i < 10; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const { data } = await db().from("billing_events").select("event_id,event_type").eq("environment", env).eq("event_type", type).gte("created_at", since);
    if (data && data.length) return { simulationId: sim.id, runId: run.id, delivered: true, storedEventIds: data.map((d: any) => d.event_id) };
  }
  const status = await api<any>(env, "GET", `/simulations/${sim.id}/runs/${run.id}?include=events`).catch(() => null);
  log.warn("simulation not seen in billing_events", { env, type, run: status });
  return { simulationId: sim.id, runId: run.id, delivered: false, storedEventIds: [] };
}
