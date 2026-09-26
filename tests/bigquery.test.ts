import { describe, it, expect } from "vitest";
import { unwrapBqJson, mapBigQueryRows, BQ_LOOKBACK_DAYS, BQ_MAX_BYTES_BILLED } from "../src/patents/bigquery.js";

const row = {
  publication_number: "CN-120000001-A", country_code: "CN", kind_code: "A", family_id: "99001",
  title_en: "Iron nitride permanent magnet and preparation method", abstract_en: "A rare-earth-free Fe16N2 magnet with high coercivity.",
  cpc_codes: ["H01F 1/047", "C01B21/06"], applicants: ["Example Univ"], inventors: ["A Person"],
  priority_date: "2025-03-01", filing_date: "2025-03-01", publication_date: "2026-08-20", grant_date: null, application_number: "CN-202510000001-A",
};

describe("bigquery source", () => {
  it("unwraps the nested result of a DECLARE script", () => expect(unwrapBqJson([[row]])).toEqual([row]));
  it("accepts a flat array", () => expect(unwrapBqJson([row])).toEqual([row]));
  it("rejects non-arrays", () => expect(() => unwrapBqJson({ error: "x" })).toThrow());
  it("maps an on-topic row and normalises cpc", () => {
    const [p] = mapBigQueryRows([row]);
    expect(p?.publication_number).toBe("CN-120000001-A");
    expect(p?.source).toBe("bigquery");
    expect(p?.cpc_codes).toEqual(["H01F1/047", "C01B21/06"]);
    expect(p?.matched_terms.length).toBeGreaterThan(0);
  });
  it("drops rows without English text or matching terms (JP/DE gap, ADR 0009)", () => {
    expect(mapBigQueryRows([{ ...row, publication_number: "JP-2026000001-A", country_code: "JP", title_en: null, abstract_en: null, cpc_codes: [] }])).toEqual([]);
  });
  it("window and cap match ADR 0009", () => { expect(BQ_LOOKBACK_DAYS).toBe(45); expect(BQ_MAX_BYTES_BILLED).toBe(300_000_000_000); });
});
