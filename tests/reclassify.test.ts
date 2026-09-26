import { describe, it, expect } from "vitest";
import { decide } from "../src/patents/reclassify.js";
import type { Publication } from "../src/patents/types.js";

const base: Publication = { publication_number: "CN-1-A", country_code: "CN", kind_code: "A", family_id: "F", title: "", abstract: "", applicants: [], inventors: [], cpc_codes: [], priority_date: null, filing_date: null, publication_date: "2026-08-01", grant_date: null, application_number: null, source: "bigquery", source_payload: null, matched_terms: [] };

describe("reclassify decisions", () => {
  it("drops rows the current classifier rejects, keeps the rest with refreshed terms", () => {
    const { keep, drop } = decide([
      { ...base, publication_number: "CN-1-A", title: "NiCoCuMnAl high-entropy catalyst", family_id: "F1", matched_terms: ["MnAl"] },
      { ...base, publication_number: "CN-2-A", title: "MnBi permanent magnet", family_id: "F2" },
    ], new Set());
    expect(drop.map((p) => p.publication_number)).toEqual(["CN-1-A"]);
    expect(keep[0]?.matched_terms).toContain("MnBi");
  });
  it("never drops a family an analyst marked include", () => {
    const { keep, drop, protectedByAnalyst } = decide([{ ...base, title: "Termite tracer with ferrite particles", family_id: "F9" }], new Set(["F9"]));
    expect(drop).toEqual([]); expect(keep).toHaveLength(1); expect(protectedByAnalyst).toBe(1);
  });
});
