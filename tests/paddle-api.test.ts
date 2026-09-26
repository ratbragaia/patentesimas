import { describe, it, expect } from "vitest";
import { planPayloads } from "../src/billing/paddle-api.js";
import { cliAllowed } from "../src/ops/jobs.js";

describe("paddle plan payloads (ADR 0001 prices)", () => {
  it("builds product and USD prices in cents with custom_data for idempotent matching", () => {
    const p = planPayloads({ code: "analyst", name: "Analyst", price_usd_month: 249, price_usd_year: 2490, seats: 1 });
    expect(p.product).toMatchObject({ name: "PatentSonar Analyst", tax_category: "saas", custom_data: { patentsonar_plan: "analyst" } });
    expect(p.month.unit_price).toEqual({ amount: "24900", currency_code: "USD" }); expect(p.month.billing_cycle).toEqual({ interval: "month", frequency: 1 });
    expect(p.year?.unit_price.amount).toBe("249000"); expect(p.year?.billing_cycle.interval).toBe("year");
  });
  it("enterprise yearly may be absent", () => expect(planPayloads({ code: "x", name: "X", price_usd_month: 2000, price_usd_year: null, seats: 999 }).year).toBeNull());
  it("ops allows the two paddle commands in fixed shapes", () => {
    expect(cliAllowed("paddle plans-sync sandbox")).toBe(true); expect(cliAllowed("paddle simulate sandbox transaction.completed")).toBe(true);
    expect(cliAllowed("paddle plans-sync staging")).toBe(false); expect(cliAllowed("paddle simulate sandbox rm -rf")).toBe(false);
  });
});
