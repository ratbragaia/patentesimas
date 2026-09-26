/**
 * NFS-e for the export of our subscription service (ADR 0002, research 05, research 06).
 * Model: Paddle is the reseller; one NFS-e per Paddle payout, issued to the Paddle entity on the reverse
 * invoice, for the payout amount, in BRL at PTAX of the payout date, marked as export (ISS not due).
 *
 * Channel: São João del Rei issues NFS-e only through the national system (nfse.gov.br) since 2026-01-01.
 * Provider: Notaas (REST wrapper over the national API, free tier 50 notes/month) — `NOTAAS_API_KEY`.
 * The canonical draft (`buildNfseDraft`) is provider-neutral so the national API can be called directly later.
 *
 * Idempotency: the `invoices` row (unique paddle_payout_id / idempotency_key) exists BEFORE any provider call,
 * so a crash between DB write and API call is recovered by `issuePendingInvoices()` without duplicates.
 */
import { config } from "../lib/config.js";
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

/** Provider-neutral NFS-e draft, in the vocabulary of the national DPS (padrão nacional). Pure; tested. */
export function buildNfseDraft(inv: InvoiceRow, rate: number, rateDate: string) {
  const e = PADDLE_ENTITIES[inv.payer_entity];
  const amountBrl = toBrl(Number(inv.amount_usd), rate);
  return {
    externalId: inv.idempotency_key, // echoed back by the provider; second line of defence against duplicates
    competencia: inv.payout_date.slice(0, 7),
    prestador: { cnpj: COMPANY.cnpj.replace(/\D/g, ""), razaoSocial: COMPANY.legalName, regimeTributario: FISCAL.regime, cnae: COMPANY.cnae.replace(/\D/g, "") },
    tomador: { exterior: true, nome: e.name, pais: e.country, endereco: { logradouro: e.street, cidade: e.city, estado: e.state, cep: e.postalCode }, documento: null },
    servico: {
      itemLc116: FISCAL.federalServiceCode, cTribNac: FISCAL.cTribNac, descricao: `${FISCAL.serviceDescription} Prestador: ${COMPANY.legalName}, CNAE ${COMPANY.cnae}. Referência: Paddle payout ${inv.paddle_payout_id}${inv.reverse_invoice_ref ? `, reverse invoice ${inv.reverse_invoice_ref}` : ""}, ${inv.payout_date}. Valor USD ${Number(inv.amount_usd).toFixed(2)} convertido pela PTAX venda de ${rateDate} (${rate.toFixed(4)}).`,
      valorServicos: amountBrl, localPrestacao: { municipio: COMPANY.city, uf: "MG" },
      documentoReferencia: `Paddle payout ${inv.paddle_payout_id}${inv.reverse_invoice_ref ? ` / ${inv.reverse_invoice_ref}` : ""}`,
    },
    tributacao: { issqn: { exigibilidade: "exportacao" as const, aliquota: 0, valor: 0, paisResultado: e.country }, pisCofins: { situacao: "isento-exportacao" as const } },
    comercioExterior: { moeda: "USD", valorMoeda: Number(inv.amount_usd), vinculoPrestacao: "sem-vinculo" as const, modoPrestacao: "transfronteirico" as const, mecanismoApoio: "nenhum" as const },
  };
}
export type NfseDraft = ReturnType<typeof buildNfseDraft>;

/** ISO 3166-1 alpha-3 (as stored for Paddle entities) → alpha-2 (what Notaas expects). */
const ISO3_TO_ISO2: Record<string, string> = { GBR: "GB", USA: "US", IRL: "IE", BRA: "BR" };
export const toIso2 = (c: string) => ISO3_TO_ISO2[c] ?? (c.length === 2 ? c : (() => { throw new Error(`no ISO2 mapping for ${c}`); })());
/** BACEN currency codes used in the NFS-e foreign-trade block. */
const BACEN_CURRENCY: Record<string, string> = { USD: "220", EUR: "978", GBP: "540" };

/**
 * Notaas request body for `POST https://platform.notaas.com.br/api/v1/emitir` (header x-api-key), per
 * docs.notaas.com.br/docs/endpoints (read 2026-09-26). The environment (produção/homologação) is a setting of
 * the Notaas *project* the key belongs to, not a request field. Export semantics: `valores.exportacao` present
 * ⇒ tribISSQN=3 (export) derived by Notaas; `aliquotaIss: 0`; no ISS amounts are sent (national rejection E1303).
 * Issuing is refused until `NOTAAS_SCHEMA_CONFIRMED=1` (set after one successful homologação issue).
 */
export function toNotaasPayload(d: NfseDraft) {
  const pais = toIso2(d.tomador.pais);
  return {
    referencia: d.externalId,
    competencia: d.competencia,
    tomador: {
      nome: d.tomador.nome,
      endereco: { logradouro: d.tomador.endereco.logradouro || undefined, cidade: d.tomador.endereco.cidade || undefined, uf: "EX", cep: (d.tomador.endereco.cep || "").replace(/\D/g, "") || undefined, pais },
    },
    servico: {
      codigo: d.servico.cTribNac,
      descricao: d.servico.descricao,
      documentoReferencia: d.servico.documentoReferencia,
    },
    valores: {
      total: d.servico.valorServicos,
      aliquotaIss: 0,
      issRetido: false,
      tribISSQN: 3,
      exportacao: {
        modoPrestacao: 1, // transfronteiriço
        vinculoPartes: 0, // sem vínculo
        codigoMoeda: BACEN_CURRENCY[d.comercioExterior.moeda] ?? "220",
        valorServicoMoeda: d.comercioExterior.valorMoeda,
        movimentacaoTemporariaBens: 1,
        paisResultado: pais,
      },
    },
  };
}
export type NotaasPayload = ReturnType<typeof toNotaasPayload>;

interface NotaasEmitirResponse { queued?: boolean; invoiceId?: string; status?: string; pollUrl?: string }
interface NotaasStatus { status: "queued" | "processing" | "issued" | "error" | "cancelled"; chNFSe?: string; numeroNfe?: string; emittedAt?: string; ambiente?: string; pdfUrl?: string; xmlUrl?: string; errorCode?: string; errorMessage?: string; errors?: { Codigo?: string; Descricao?: string; Complemento?: string }[] }

const NOTAAS_BASE = "https://platform.notaas.com.br/api/v1";

/** POST /emitir is asynchronous (202): poll /invoices/{id}/status until it leaves queued/processing. */
export async function notaasIssue(payload: NotaasPayload, apiKey: string, { pollMs = 3000, maxPolls = 40 } = {}): Promise<{ invoiceId: string; final: NotaasStatus }> {
  const headers = { "x-api-key": apiKey, "Content-Type": "application/json" };
  const res = await httpJson<NotaasEmitirResponse>(`${NOTAAS_BASE}/emitir`, { method: "POST", headers, body: JSON.stringify(payload) });
  if (!res.invoiceId) throw new Error(`Notaas /emitir returned no invoiceId: ${JSON.stringify(res).slice(0, 300)}`);
  let final: NotaasStatus = { status: (res.status as NotaasStatus["status"]) ?? "queued" };
  for (let i = 0; i < maxPolls && (final.status === "queued" || final.status === "processing"); i++) {
    await new Promise((r) => setTimeout(r, pollMs));
    final = await httpJson<NotaasStatus>(`${NOTAAS_BASE}/invoices/${res.invoiceId}/status`, { headers });
  }
  return { invoiceId: res.invoiceId, final };
}

export async function issuePendingInvoices(): Promise<number> {
  const { data: pending } = await db().from("invoices").select("*").eq("status", "pending");
  let issued = 0;
  const c = config();
  for (const inv of (pending ?? []) as InvoiceRow[]) {
    try {
      if (!inv.paddle_payout_id) throw new Error("legacy per-transaction invoice row; cancel it (ADR 0002 revised: NFS-e are per Paddle payout)");
      if (!c.NOTAAS_API_KEY) throw new Error("NOTAAS_API_KEY not set (handoff item 12: Notaas account + A1 certificate)");
      if (!c.NOTAAS_SCHEMA_CONFIRMED) throw new Error("Notaas payload schema not yet confirmed by a homologação issue (NOTAAS_SCHEMA_CONFIRMED=0); refusing to issue");
      const { rate, date } = await ptaxRate(inv.payout_date);
      const draft = buildNfseDraft(inv, rate, date);
      // Mark the provider call before making it: a crash after /emitir never re-issues (the row is no longer 'pending').
      await db().from("invoices").update({ status: "issuing", amount_brl: draft.servico.valorServicos, fx_rate: rate, error: null }).eq("id", inv.id).eq("status", "pending");
      const { invoiceId, final } = await notaasIssue(toNotaasPayload(draft), c.NOTAAS_API_KEY);
      if (final.status === "issued") {
        await db().from("invoices").update({ status: "issued", nfeio_invoice_id: invoiceId, nfse_number: final.numeroNfe ?? null, issued_at: final.emittedAt ?? new Date().toISOString(), error: null }).eq("id", inv.id);
        await audit("finance", "invoice_issued", "invoices", inv.id, { provider: "notaas", ref: invoiceId, chNFSe: final.chNFSe, ambiente: final.ambiente, amountBrl: draft.servico.valorServicos, payout: inv.paddle_payout_id });
        issued++;
      } else if (final.status === "error" || final.status === "cancelled") {
        const detail = `${final.errorCode ?? ""} ${final.errorMessage ?? ""} ${JSON.stringify(final.errors ?? [])}`.trim();
        await db().from("invoices").update({ status: "pending", nfeio_invoice_id: invoiceId, error: `notaas ${final.status}: ${detail}` }).eq("id", inv.id);
        log.error("invoice rejected by Notaas", { id: inv.id, invoiceId, detail });
      } else {
        // Still queued/processing after the polling budget: keep the provider id, finish on the next run.
        await db().from("invoices").update({ status: "issuing", nfeio_invoice_id: invoiceId, error: `notaas still ${final.status}; reconcile on next run` }).eq("id", inv.id);
        log.warn("invoice still processing at Notaas", { id: inv.id, invoiceId });
      }
    } catch (err) {
      log.error("invoice failed", { id: inv.id, err: String(err) });
      await db().from("invoices").update({ error: String(err) }).eq("id", inv.id);
    }
  }
  return issued;
}

/** Rows left in `issuing` (poll budget exhausted or crash mid-call) are settled from the provider status. */
export async function reconcileIssuingInvoices(): Promise<number> {
  const c = config(); if (!c.NOTAAS_API_KEY) return 0;
  const { data: rows } = await db().from("invoices").select("id,nfeio_invoice_id").eq("status", "issuing");
  let settled = 0;
  for (const r of (rows ?? []) as { id: string; nfeio_invoice_id: string | null }[]) {
    if (!r.nfeio_invoice_id) { await db().from("invoices").update({ status: "pending", error: "issuing without provider id; retry" }).eq("id", r.id); continue; }
    const st = await httpJson<NotaasStatus>(`${NOTAAS_BASE}/invoices/${r.nfeio_invoice_id}/status`, { headers: { "x-api-key": c.NOTAAS_API_KEY } });
    if (st.status === "issued") { await db().from("invoices").update({ status: "issued", nfse_number: st.numeroNfe ?? null, issued_at: st.emittedAt ?? new Date().toISOString(), error: null }).eq("id", r.id); settled++; }
    else if (st.status === "error" || st.status === "cancelled") await db().from("invoices").update({ status: "pending", error: `notaas ${st.status}: ${st.errorCode ?? ""} ${st.errorMessage ?? ""}` }).eq("id", r.id);
  }
  return settled;
}
