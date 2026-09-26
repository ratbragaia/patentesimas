import { describe, it, expect } from "vitest";
import { buildNfseBody, toBrl } from "../src/invoicing/nfeio.js";
import { cliAllowed } from "../src/ops/jobs.js";

const inv = { id: "x", paddle_payout_id: "pay_123", payer_entity: "UK" as const, amount_usd: 1234.5, payout_date: "2026-10-15", reverse_invoice_ref: "RI-0001", idempotency_key: "paddle-payout:pay_123" };

describe("NFS-e per Paddle payout (ADR 0002)", () => {
  it("bills the Paddle UK entity as a foreign borrower, export, item 1.09, ISS 0, BRL at PTAX", () => {
    const b = buildNfseBody(inv, 5.1234, "2026-10-15", "010901");
    expect(b.borrower.name).toBe("Paddle.com Market Limited"); expect(b.borrower.address.country).toBe("GBR"); expect(b.borrower.federalTaxNumber).toBeNull();
    expect(b.taxationType).toBe("Export"); expect(b.federalServiceCode).toBe("1.09"); expect(b.issRate).toBe(0); expect(b.cityServiceCode).toBe("010901");
    expect(b.servicesAmount).toBe(6324.84);
    expect(b.description).toContain("pay_123"); expect(b.description).toContain("RI-0001"); expect(b.description).toContain("LC 116, art. 2º, I"); expect(b.description).toContain("40.435.866/0001-40".slice(0, 0) + "Rockfort");
    expect(b.externalId).toBe("paddle-payout:pay_123");
  });
  it("rounds BRL to cents", () => { expect(toBrl(10, 5.4321)).toBe(54.32); expect(toBrl(0.01, 5)).toBe(0.05); });
  it("US entity is USA", () => expect(buildNfseBody({ ...inv, payer_entity: "US" }, 5, "2026-10-15", "1").borrower.address.country).toBe("USA"));
  it("ops accepts only well-formed enqueue-payout calls", () => {
    expect(cliAllowed("invoices enqueue-payout pay_123 UK 1234.50 2026-10-15 RI-0001")).toBe(true);
    expect(cliAllowed("invoices enqueue-payout pay_123 BR 1234.50 2026-10-15")).toBe(false);
    expect(cliAllowed("invoices enqueue-payout pay_123 UK 12,50 2026-10-15")).toBe(false);
  });
});
