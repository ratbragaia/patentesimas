import { describe, it, expect } from "vitest";
import { buildNfseDraft, toNotaasPayload, toBrl } from "../src/invoicing/nfse.js";
import { cliAllowed } from "../src/ops/jobs.js";

const inv = { id: "x", paddle_payout_id: "pay_123", payer_entity: "UK" as const, amount_usd: 1234.5, payout_date: "2026-10-15", reverse_invoice_ref: "RI-0001", idempotency_key: "paddle-payout:pay_123" };

describe("NFS-e per Paddle payout (ADR 0002, national standard)", () => {
  it("drafts an export NFS-e to the Paddle UK entity: tomador no exterior, item 1.09, ISS 0, BRL at PTAX, USD in the foreign-trade block", () => {
    const d = buildNfseDraft(inv, 5.1234, "2026-10-15");
    expect(d.tomador).toMatchObject({ exterior: true, nome: "Paddle.com Market Limited", pais: "GBR", documento: null });
    expect(d.servico.itemLc116).toBe("1.09"); expect(d.servico.cTribNac).toBe("010901"); expect(d.servico.valorServicos).toBe(6324.84);
    expect(d.tributacao.issqn).toMatchObject({ exigibilidade: "exportacao", aliquota: 0, valor: 0, paisResultado: "GBR" });
    expect(d.comercioExterior).toMatchObject({ moeda: "USD", valorMoeda: 1234.5 });
    expect(d.servico.descricao).toContain("pay_123"); expect(d.servico.descricao).toContain("RI-0001"); expect(d.servico.descricao).toContain("LC 116, art. 2º, I");
    expect(d.prestador.cnpj).toBe("40435866000140"); expect(d.externalId).toBe("paddle-payout:pay_123");
  });
  it("maps the draft to a Notaas request with no ISS amounts (avoids national rejection E1303)", () => {
    const p = toNotaasPayload(buildNfseDraft(inv, 5, "2026-10-15"));
    expect(p.tomador.estrangeiro).toBe(true); expect(p.servico.iss_aliquota).toBe(0); expect(p.servico.iss_exigibilidade).toBe("exportacao");
    expect(p.referencia).toBe("paddle-payout:pay_123"); expect(JSON.stringify(p)).not.toContain("iss_valor");
  });
  it("rounds BRL to cents", () => { expect(toBrl(10, 5.4321)).toBe(54.32); expect(toBrl(0.01, 5)).toBe(0.05); });
  it("US entity is USA", () => expect(buildNfseDraft({ ...inv, payer_entity: "US" }, 5, "2026-10-15").tomador.pais).toBe("USA"));
  it("ops accepts only well-formed enqueue-payout calls", () => {
    expect(cliAllowed("invoices enqueue-payout pay_123 UK 1234.50 2026-10-15 RI-0001")).toBe(true);
    expect(cliAllowed("invoices enqueue-payout pay_123 BR 1234.50 2026-10-15")).toBe(false);
  });
});
