import { describe, it, expect } from "vitest";
import { checkOutreach } from "../src/outreach/compliance.js";
import { OUTREACH_TEMPLATES, fill } from "../src/outreach/templates.js";

const vars = { first_name: "Alex", personal_hook: "I noticed your team's recent iron nitride filing.", count: "7", sender_name: "PatentSonar Analyst",
  company_name: "PatentSonar", postal_address: "Rua Exemplo 1, São Paulo, Brazil", unsubscribe_url: "https://patentsonar.com/opt-out?x=1" };
const draft = (over = {}) => ({ toEmail: "alex@example.com", toCountry: "US", subject: fill(OUTREACH_TEMPLATES.first_touch.subject, vars), body: fill(OUTREACH_TEMPLATES.first_touch.body, vars),
  senderName: vars.sender_name, companyName: vars.company_name, postalAddress: vars.postal_address, unsubscribeUrl: vars.unsubscribe_url, ...over });

describe("outreach compliance", () => {
  it("passes the fixed first-touch template to a US contact", () => expect(checkOutreach(draft(), new Set()).ok).toBe(true));
  it("blocks suppressed recipient", () => expect(checkOutreach(draft(), new Set(["alex@example.com"])).ok).toBe(false));
  it("blocks suppressed domain", () => expect(checkOutreach(draft(), new Set(["@example.com"])).problems[0]).toMatch(/do-not-contact/));
  it("blocks opt-in-only jurisdictions", () => expect(checkOutreach(draft({ toCountry: "DE" }), new Set()).problems.join()).toMatch(/opt-in-only/));
  it("blocks missing opt-out link", () => expect(checkOutreach(draft({ body: "Hi Alex, because your team files magnets. PatentSonar, Rua Exemplo 1, São Paulo, Brazil" }), new Set()).problems).toContain("missing opt-out link"));
  it("blocks deceptive subject", () => expect(checkOutreach(draft({ subject: "Re: our call" }), new Set()).problems.join()).toMatch(/deceptive/));
});
