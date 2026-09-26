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
    prestador: { cnpj: COMPANY.cnpj.replace(/\D/g, ""), razaoSocial: COMPANY.legalName, regimeTributario: FISCAL.regime, cnae: COMPANY.cnae.replace(/\D/g, "") },
    tomador: { exterior: true, nome: e.name, pais: e.country, endereco: { logradouro: e.street, cidade: e.city, estado: e.state, cep: e.postalCode }, documento: null },
    servico: {
      itemLc116: FISCAL.federalServiceCode, cTribNac: FISCAL.cTribNac, descricao: `${FISCAL.serviceDescription} Prestador: ${COMPANY.legalName}, CNAE ${COMPANY.cnae}. Referência: Paddle payout ${inv.paddle_payout_id}${inv.reverse_invoice_ref ? `, reverse invoice ${inv.reverse_invoice_ref}` : ""}, ${inv.payout_date}. Valor USD ${Number(inv.amount_usd).toFixed(2)} convertido pela PTAX venda de ${rateDate} (${rate.toFixed(4)}).`,
      valorServicos: amountBrl, localPrestacao: { municipio: COMPANY.city, uf: "MG" },
    },
    tributacao: { issqn: { exigibilidade: "exportacao" as const, aliquota: 0, valor: 0, paisResultado: e.country }, pisCofins: { situacao: "isento-exportacao" as const } },
    comercioExterior: { moeda: "USD", valorMoeda: Number(inv.amount_usd), vinculoPrestacao: "sem-vinculo" as const, modoPrestacao: "transfronteirico" as const, mecanismoApoio: "nenhum" as const },
  };
}
export type NfseDraft = ReturnType<typeof buildNfseDraft>;

/**
 * Notaas request body (`POST https://platform.notaas.com.br/api/v1/emitir`, header x-api-key). Field names for
 * the foreign tomador / export block are to be confirmed against docs.notaas.com.br at onboarding (task in
 * ps.tasks; the cloud session cannot read that site). Until `NOTAAS_SCHEMA_CONFIRMED=1` issuing is refused.
 */
export function toNotaasPayload(d: NfseDraft) {
  return {
    tipo: "nfse", ambiente: config().NOTAAS_SANDBOX ? "homologacao" : "producao", referencia: d.externalId,
    prestador: { cnpj: d.prestador.cnpj },
    tomador: { estrangeiro: true, nome: d.tomador.nome, pais: d.tomador.pais, endereco: d.tomador.endereco },
    servico: { codigo_tributacao_nacional: d.servico.cTribNac, item_lista_servico: d.servico.itemLc116, discriminacao: d.servico.descricao, valor_servicos: d.servico.valorServicos,
      iss_exigibilidade: "exportacao", iss_aliquota: 0, pais_resultado: d.tributacao.issqn.paisResultado,
      comercio_exterior: { moeda: d.comercioExterior.moeda, valor_moeda: d.comercioExterior.valorMoeda, modo_prestacao: d.comercioExterior.modoPrestacao, vinculo: d.comercioExterior.vinculoPrestacao } },
  };
}

export async function issuePendingInvoices(): Promise<number> {
  const { data: pending } = await db().from("invoices").select("*").eq("status", "pending");
  let issued = 0;
  const c = config();
  for (const inv of (pending ?? []) as InvoiceRow[]) {
    try {
      if (!inv.paddle_payout_id) throw new Error("legacy per-transaction invoice row; cancel it (ADR 0002 revised: NFS-e are per Paddle payout)");
      if (!c.NOTAAS_API_KEY) throw new Error("NOTAAS_API_KEY not set (handoff item 12: Notaas account + A1 certificate)");
      if (!c.NOTAAS_SCHEMA_CONFIRMED) throw new Error("Notaas payload schema not yet confirmed against docs.notaas.com.br (task for the VPS session); refusing to issue");
      const { rate, date } = await ptaxRate(inv.payout_date);
      const draft = buildNfseDraft(inv, rate, date);
      const res = await httpJson<{ id?: string; numero?: string; status?: string; protocolo?: string }>("https://platform.notaas.com.br/api/v1/emitir", {
        method: "POST", headers: { "x-api-key": c.NOTAAS_API_KEY, "Content-Type": "application/json" }, body: JSON.stringify(toNotaasPayload(draft)),
      });
      await db().from("invoices").update({ status: "issued", nfeio_invoice_id: res.id ?? res.protocolo ?? null, nfse_number: res.numero ?? null, amount_brl: draft.servico.valorServicos, fx_rate: rate, issued_at: new Date().toISOString(), error: null }).eq("id", inv.id);
      await audit("finance", "invoice_issued", "invoices", inv.id, { provider: "notaas", ref: res.id ?? res.protocolo, amountBrl: draft.servico.valorServicos, payout: inv.paddle_payout_id });
      issued++;
    } catch (err) {
      log.error("invoice failed", { id: inv.id, err: String(err) });
      await db().from("invoices").update({ error: String(err) }).eq("id", inv.id);
    }
  }
  return issued;
}
