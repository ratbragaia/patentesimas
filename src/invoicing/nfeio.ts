/**
 * NFe.io service invoices (NFS-e) for export of services. The invoice row is created with
 * status 'pending' under a unique idempotency key BEFORE calling NFe.io, so a crash between
 * DB write and API call is recovered by `issuePendingInvoices()` without duplicates.
 * Exact fiscal parameters (service code, ISS exemption for exports, CNAE) come from the
 * accountant and live in docs/decisions/ once confirmed.
 */
import { require } from "../lib/config.js";
import { httpJson } from "../lib/http.js";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";

export interface InvoiceRequest { idempotencyKey: string; customerId: string; paddleTransactionId: string; amountUsd: number; paddleSubscriptionId: string | null }

export async function enqueueInvoice(req: InvoiceRequest): Promise<void> {
  let subscriptionId: string | null = null;
  if (req.paddleSubscriptionId) {
    const { data } = await db().from("subscriptions").select("id").eq("paddle_subscription_id", req.paddleSubscriptionId).maybeSingle();
    subscriptionId = data?.id ?? null;
  }
  const { error } = await db().from("invoices").insert({
    idempotency_key: req.idempotencyKey, customer_id: req.customerId, subscription_id: subscriptionId,
    paddle_transaction_id: req.paddleTransactionId, amount_usd: req.amountUsd, status: "pending",
  });
  if (error && error.code !== "23505") throw new Error(error.message); // duplicate = already enqueued
}

/** Fetch PTAX (BCB official) USD->BRL rate for a date; NFS-e must be in BRL. */
export async function ptaxRate(date: string): Promise<number> {
  const [y, m, d] = date.split("-");
  const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${m}-${d}-${y}'&$format=json`;
  const res = await httpJson<{ value: { cotacaoVenda: number }[] }>(url);
  const v = res.value?.[0]?.cotacaoVenda;
  if (!v) throw new Error(`no PTAX for ${date} (weekend/holiday? use previous business day)`);
  return v;
}

export async function issuePendingInvoices(): Promise<number> {
  const { data: pending } = await db().from("invoices").select("*, customers(*)").eq("status", "pending");
  let issued = 0;
  for (const inv of pending ?? []) {
    try {
      const rate = await ptaxRate(new Date().toISOString().slice(0, 10));
      const amountBrl = Math.round(Number(inv.amount_usd) * rate * 100) / 100;
      const body = {
        borrower: { name: inv.customers.legal_name, email: inv.customers.billing_email, federalTaxNumber: null,
          address: { country: inv.customers.country ?? "USA" } },
        cityServiceCode: "<from accountant>", description: `Patent intelligence subscription — RareFree Intelligence. Paddle transaction ${inv.paddle_transaction_id}. USD ${inv.amount_usd} @ PTAX ${rate}`,
        servicesAmount: amountBrl,
        externalId: inv.idempotency_key, // NFe.io echoes this back; prevents duplicates on their side too
      };
      const res = await httpJson<{ id: string; number?: string }>(`https://api.nfe.io/v1/companies/${require("NFEIO_COMPANY_ID")}/serviceinvoices`, {
        method: "POST", headers: { Authorization: require("NFEIO_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      await db().from("invoices").update({ status: "issued", nfeio_invoice_id: res.id, nfse_number: res.number ?? null, amount_brl: amountBrl, fx_rate: rate, issued_at: new Date().toISOString() }).eq("id", inv.id);
      await audit("finance", "invoice_issued", "invoices", inv.id, { nfeio: res.id, amountBrl });
      issued++;
    } catch (err) {
      log.error("invoice failed", { id: inv.id, err: String(err) });
      await db().from("invoices").update({ error: String(err) }).eq("id", inv.id);
    }
  }
  return issued;
}
