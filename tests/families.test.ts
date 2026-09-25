import { describe, it, expect } from "vitest";
import { groupFamilies } from "../src/patents/families.js";
import type { Publication } from "../src/patents/types.js";

const base = (o: Partial<Publication>): Publication => ({
  publication_number: "X", country_code: "US", kind_code: "B2", family_id: null, title: "Iron nitride magnet", abstract: null,
  applicants: [], inventors: [], cpc_codes: ["H01F1/047"], priority_date: null, filing_date: null, publication_date: "2026-09-01", grant_date: null,
  application_number: null, source: "epo_ops", source_payload: null, matched_terms: ["iron nitride"], ...o,
});

describe("family dedup", () => {
  it("groups CN/JP/US members of one DOCDB family and picks the US grant", () => {
    const g = groupFamilies([
      base({ publication_number: "CN-118000001-A", country_code: "CN", kind_code: "A", family_id: "F1", publication_date: "2026-08-20", priority_date: "2025-01-10" }),
      base({ publication_number: "JP-2026000001-A", country_code: "JP", kind_code: "A", family_id: "F1", publication_date: "2026-08-25" }),
      base({ publication_number: "US-12000001-B2", country_code: "US", kind_code: "B2", family_id: "F1", publication_date: "2026-09-02" }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.representative.publication_number).toBe("US-12000001-B2");
    expect(g[0]!.offices).toEqual(["CN", "JP", "US"]);
    expect(g[0]!.earliest_priority_date).toBe("2025-01-10");
  });
  it("does not drop records without family id", () => {
    const g = groupFamilies([base({ publication_number: "US-1-B2" }), base({ publication_number: "US-2-B2" })]);
    expect(g).toHaveLength(2);
  });
  it("is idempotent on duplicate members", () => {
    const g = groupFamilies([base({ publication_number: "US-1-B2", family_id: "F" }), base({ publication_number: "US-1-B2", family_id: "F" })]);
    expect(g[0]!.members).toHaveLength(1);
  });
});
