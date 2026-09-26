import { describe, it, expect } from "vitest";
import { dailyAllowance, optoutUrl, verifyOptout, optoutToken } from "../src/outreach/mailer.js";
import { OUTREACH_TEMPLATES, fill } from "../src/outreach/templates.js";
import { checkOutreach } from "../src/outreach/compliance.js";
import { cliAllowed } from "../src/ops/jobs.js";

process.env["PATENTSONAR_ENV_FILE"] = "/nonexistent/env"; process.env["OPS_TOKEN"] = "test-ops-token-0123456789abcdef0123456789abcdef";

describe("outreach warm-up ramp", () => {
  it("5/day before the first send and in week 1, then 10, 20, cap", () => {
    expect(dailyAllowance(null, "2026-10-01", 25)).toBe(5);
    expect(dailyAllowance("2026-10-01", "2026-10-05", 25)).toBe(5);
    expect(dailyAllowance("2026-10-01", "2026-10-09", 25)).toBe(10);
    expect(dailyAllowance("2026-10-01", "2026-10-16", 25)).toBe(20);
    expect(dailyAllowance("2026-10-01", "2026-10-30", 25)).toBe(25);
    expect(dailyAllowance("2026-01-01", "2026-10-30", 10)).toBe(10);
  });
});

describe("opt-out token", () => {
  it("round-trips and rejects tampering", () => {
    const url = new URL(optoutUrl("Jane.Doe@Example.com"));
    expect(verifyOptout(url.searchParams.get("e"), url.searchParams.get("t"))).toBe("jane.doe@example.com");
    expect(verifyOptout(url.searchParams.get("e"), "0".repeat(24))).toBeNull();
    expect(verifyOptout(Buffer.from("other@example.com").toString("base64url"), optoutToken("jane.doe@example.com"))).toBeNull();
    expect(verifyOptout(null, null)).toBeNull();
  });
});

describe("first-touch template passes the compliance gate", () => {
  it("renders with the opt-out link and postal address and clears checkOutreach", () => {
    const to = "ip.counsel@example-motors.com";
    const vars = { first_name: "Jane", personal_hook: "I noticed your team's 2026 filings on ferrite rotors for traction motors.", count: "13", sender_name: "PatentSonar analyst", company_name: "PatentSonar", postal_address: "Rockfort Hub de Inovação Ltda · Av. Tiradentes 209, Centro, São João del Rei, MG, Brazil", unsubscribe_url: optoutUrl(to) };
    const body = fill(OUTREACH_TEMPLATES.first_touch.body, vars); const subject = fill(OUTREACH_TEMPLATES.first_touch.subject, vars);
    const r = checkOutreach({ toEmail: to, toCountry: "US", subject, body, senderName: vars.sender_name, companyName: "PatentSonar", postalAddress: vars.postal_address, unsubscribeUrl: vars.unsubscribe_url }, new Set());
    expect(r.problems).toEqual([]); expect(r.ok).toBe(true);
    expect(checkOutreach({ toEmail: "x@firma.de", toCountry: "DE", subject, body, senderName: "", companyName: "PatentSonar", postalAddress: vars.postal_address, unsubscribeUrl: vars.unsubscribe_url }, new Set()).ok).toBe(false);
  });
  it("ops allows the outreach commands in fixed shapes", () => {
    expect(cliAllowed("outreach send-batch 5")).toBe(true); expect(cliAllowed("outreach poll")).toBe(true); expect(cliAllowed("outreach send-batch 500")).toBe(false);
  });
});
