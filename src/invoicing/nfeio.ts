/**
 * NFe.io service invoices (NFS-e) for the export of our subscription service (ADR 0002, research 05).
 * Model: Paddle is the reseller; one NFS-e per Paddle payout, issued to the Paddle entity on the reverse
 * invoice, for the payout amount, in BRL at PTAX of the payout date, marked as export (ISS not due).
 * Idempotency: the `invoices` row (unique paddle_payout_id / idempotency_key) exists BEFORE any NFe.io call,
 * so a crash between DB write and API call is recovered by `issuePendingInvoices()` without duplicates.
 */
import { config, require } from "../lib/config.js";
import { httpJson } from "../lib/http.js";
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { COMPANY, FISCAL, PADDLE_ENTITIES, type PaddleEntityCode } from "../lib/company.js";

export interface PayoutInvoiceRequest { paddlePayoutId: string; entity: PaddleEntityCode; amountUsd: number; payoutDate: string; reverseInvoiceRef?: string | null }

/** Record a Paddle payout as a pending NFS-e. Duplicate payout ids are a no-op. */
export async function enqueuePayoutInvoice(req: PayoutInvoiceRequest): Promise<"queued" | "duplicate"> {
  if (!PADDLE_ENTITIES[req.entity]) throw new Error(`unknown Paddle entity ${req.entity}`);
  if (!(req.amountUsd > 0)) throw new Error("amountUsd must be positive");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(req.payoutDate)) throw new Error("payoutDate must be YYYY-MM-DD");
  const { error } = await db().from("invoices").insert({
    idempotency_key: `paddle-payout:${req.paddlePayoutId}`, paddle_payout_id: req.paddlePayoutId, payer_entity: req.entity,
    amount_usd: req.amountUsd, payout_date: req.payoutDate, reverse_invoice_ref: req.reverseInvoiceRef ?? null,
    federal_service_code: FISCAL.federalServiceCode, taxation_type: FISCAL.exportTaxationType, status: "pending",
  });
  if (error) { if (error.code === "23505") return "duplicate"; throw new Error(error.message); }
  await audit("finance", "payout_invoice_enqueued", "invoices", req.paddlePayoutId, { entity: req.entity, usd: req.amountUsd, date: req.payoutDate });
  return "queued";
}

/** PTAX (BCB official, cotação de venda) USD→BRL for a date; falls back up to 5 business days when there is no quote (weekend/holiday). */
export async function ptaxRate(date: string): Promise<{ rate: number; date: string }> {
  const d = new Date(date + "T12:00:00Z");
  for (let i = 0; i < 6; i++) {
    const iso = d.toISOString().slice(0, 10); const [y, m, dd] = iso.split("-");
    const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarDia(dataCotacao=@dataCotacao)?@dataCotacao='${m}-${dd}-${y}'&$format=json`;
    const res = await httpJson<{ value: { cotacaoVenda: number }[] }>(url);
    const v = res.value?.[0]?.cotacaoVenda;
    if (v) return { rate: v, date: iso };
    d.setUTCDate(d.getUTCDate() - 1);
  }
  throw new Error(`no PTAX within 5 days before ${date}`);
}

export const toBrl = (usd: number, rate: number) => Math.round(usd * rate * 100) / 100;

export interface InvoiceRow { id: string; paddle_payout_id: string; payer_entity: PaddleEntityCode; amount_usd: number; payout_date: string; reverse_invoice_ref: string | null; idempotency_key: string }

/** Pure: the NFe.io request body for one payout invoice (tested). */
export function buildNfseBody(inv: InvoiceRow, rate: number, rateDate: string, cityServiceCode: string) {
  const e = PADDLE_ENTITIES[inv.payer_entity];
  const amountBrl = toBrl(Number(inv.amount_usd), rate);
  return {
    borrower: {
      type: "LegalEntity", name: e.name, email: null, federalTaxNumber: null,
      address: { country: e.country, street: e.street, number: "", district: "", city: { name: e.city }, state: e.state, postalCode: e.postalCode },
    },
    cityServiceCode, federalServiceCode: FISCAL.federalServiceCode, taxationType: FISCAL.exportTaxationType, issRate: 0,
    servicesAmount: amountBrl,
    description: `${FISCAL.serviceDescription} Prestador: ${COMPANY.legalName}, CNAE ${COMPANY.cnae}. Referência: Paddle payout ${inv.paddle_payout_id}${inv.reverse_invoice_ref ? `, reverse invoice ${inv.reverse_invoice_ref}` : ""}, ${inv.payout_date}. Valor USD ${Number(inv.amount_usd).toFixed(2)} convertido pela PTAX venda de ${rateDate} (${rate.toFixed(4)}).`,
    externalId: inv.idempotency_key, // NFe.io echoes this back; prevents duplicates on their side too
  };
}

export async function issuePendingInvoices(): Promise<number> {
  const { data: pending } = await db().from("invoices").select("*").eq("status", "pending");
  let issued = 0;
  const cityCode = config().NFEIO_CITY_SERVICE_CODE;
  for (const inv of (pending ?? []) as InvoiceRow[]) {
    try {
      if (!cityCode) throw new Error("NFEIO_CITY_SERVICE_CODE not set: read the São João del Rei code for LC 116 item 1.09 from NFe.io's municipality table (ADR 0002)");
      if (!inv.paddle_payout_id) throw new Error("legacy per-transaction invoice row; cancel it (ADR 0002 revised: NFS-e are per Paddle payout)");
      const { rate, date } = await ptaxRate(inv.payout_date);
      const body = buildNfseBody(inv, rate, date, cityCode);
      const res = await httpJson<{ id: string; number?: string }>(`https://api.nfe.io/v1/companies/${require("NFEIO_COMPANY_ID")}/serviceinvoices`, {
        method: "POST", headers: { Authorization: require("NFEIO_API_KEY"), "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      await db().from("invoices").update({ status: "issued", nfeio_invoice_id: res.id, nfse_number: res.number ?? null, amount_brl: body.servicesAmount, fx_rate: rate, issued_at: new Date().toISOString(), error: null }).eq("id", inv.id);
      await audit("finance", "invoice_issued", "invoices", inv.id, { nfeio: res.id, amountBrl: body.servicesAmount, payout: inv.paddle_payout_id });
      issued++;
    } catch (err) {
      log.error("invoice failed", { id: inv.id, err: String(err) });
      await db().from("invoices").update({ error: String(err) }).eq("id", inv.id);
    }
  }
  return issued;
}
