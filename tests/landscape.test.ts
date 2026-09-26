import { describe, it, expect } from "vitest";
import { computeLandscape, renderLandscapeMarkdown, previousMonth, monthBounds, quarterOf, monthlyIssueNumber, type LandscapePub, type LandscapeFamily } from "../src/content/landscape.js";
import { runQa } from "../src/content/qa.js";
import { markdownToHtml } from "../src/content/newsletter.js";

const pub = (n: string, cc: string, fam: string, date: string, applicants: string[], title = "Iron nitride magnet"): LandscapePub =>
  ({ publication_number: n, country_code: cc, kind_code: null, family_id: fam, title, applicants, publication_date: date, priority_date: null, source: "bigquery" });
const fam = (id: string, rep: string, bucket: string, offices: string[], status = "new", summary: string | null = null): LandscapeFamily =>
  ({ family_id: id, representative_publication: rep, earliest_priority_date: null, offices, technology_bucket: bucket, triage_status: status, analyst_summary: summary });

const pubs = [
  pub("CN-118000001-A", "CN", "F1", "2026-08-05", ["ZHEJIANG MAGNET CO LTD"]),
  pub("US-12000001-B2", "US", "F2", "2026-08-20", ["NIRON MAGNETICS INC"], "Bulk Fe16N2 magnet"),
  pub("EP-4000001-A1", "EP", "F2", "2026-08-27", ["NIRON MAGNETICS INC"]),     // same family, second office
  pub("KR-1020260000001-A", "KR", "F3", "2026-07-15", ["SAMSUNG ELECTRO-MECHANICS"], "Hexaferrite"),
  pub("CN-117000002-A", "CN", "F4", "2025-08-10", ["ZHEJIANG MAGNET CO LTD"]),  // previous 12 months
  pub("US-11000003-B2", "US", "F5", "2026-08-11", ["ACME NOISE CORP"], "excluded noise"),
];
const fams = [fam("F1", "CN-118000001-A", "iron_nitride", ["CN"]), fam("F2", "US-12000001-B2", "iron_nitride", ["EP", "US"], "include", "Claims a bulk α''-Fe16N2 body above 20 MGOe."),
  fam("F3", "KR-1020260000001-A", "ferrite", ["KR"]), fam("F4", "CN-117000002-A", "mnbi", ["CN"]), fam("F5", "US-11000003-B2", "other", ["US"], "exclude")];

describe("landscape statistics", () => {
  const s = computeLandscape(pubs, fams, "2026-08");
  it("counts the month by family (first publication) and by publication", () => {
    expect(s.monthFamilies).toBe(2); // F1, F2; F5 is triaged `exclude` and leaves every count
    expect(s.monthPubs).toBe(3); expect(s.monthOffices).toEqual(["CN", "EP", "US"]);
    expect(s.monthFamilyRows.map((r) => r.family.family_id)).toEqual(["F1", "F2"]); // excluded family dropped, bucket order
  });
  it("computes trailing twelve months against the previous twelve", () => {
    expect(s.families12).toBe(3); expect(s.familiesPrev12).toBe(1);
    expect(s.topApplicants[0]).toMatchObject({ label: "ZHEJIANG MAGNET CO LTD", current: 1, previous: 1 });
    expect(s.byOffice.find((o) => o.key === "US")).toMatchObject({ current: 1, previous: 0 });
  });
  it("builds eight quarters ending with the report quarter and flags the partial one", () => {
    expect(s.quarters).toHaveLength(8); expect(s.quarters.at(-1)).toMatchObject({ quarter: "2026-Q3", families: 3, publications: 4, partial: true });
    expect(s.lastQuarter).toMatchObject({ previousQuarter: "2026-Q2", previousFamilies: 0, complete: false });
  });
  it("renders markdown that passes the QA gate against the same rows", () => {
    const md = renderLandscapeMarkdown(s);
    expect(md).toContain("# PatentSonar · Rare-Earth-Free Magnets — Landscape Report, August 2026");
    expect(md).toContain("| 2026-Q3* | 3 | 4 |");
    expect(md).toContain("Claims a bulk α''-Fe16N2 body");
    expect(md).not.toContain("US-11000003-B2");
    const qa = runQa(md, pubs.map((p) => ({ publication_number: p.publication_number, publication_date: p.publication_date, applicants: p.applicants, family_id: p.family_id, title: p.title })));
    expect(qa.unknown).toEqual([]); expect(qa.dateMismatches).toEqual([]); expect(qa.passed).toBe(true);
    const html = markdownToHtml(md);
    expect(html).toContain("<table>"); expect(html).toContain("<th>Quarter</th>"); expect(html).toContain('<a href="https://patents.google.com/patent/US12000001B2">US-12000001-B2</a>');
  });
  it("handles an empty database without throwing", () => {
    const md = renderLandscapeMarkdown(computeLandscape([], [], "2026-08"));
    expect(md).toContain("No families in scope were first published this month.");
  });
});

describe("date helpers", () => {
  it("previous month and bounds", () => {
    expect(previousMonth(new Date("2026-09-26T00:00:00Z"))).toBe("2026-08");
    expect(previousMonth(new Date("2026-01-05T00:00:00Z"))).toBe("2025-12");
    expect(monthBounds("2026-02")).toEqual({ start: "2026-02-01", end: "2026-02-28" });
    expect(quarterOf("2026-08-31")).toBe("2026-Q3"); expect(monthlyIssueNumber("2026-08")).toBe(202608);
    expect(() => monthBounds("2026-8")).toThrow();
  });
});

describe("bigquery cost gate", async () => {
  const { bigQueryIncrementalUsd, bigQueryWindow } = await import("../src/patents/ingest.js");
  it("charges only the bytes beyond the free tier", () => {
    expect(bigQueryIncrementalUsd(0, 268e9)).toBe(0);
    expect(bigQueryIncrementalUsd(804e9, 268e9)).toBe(0.45);
    expect(bigQueryIncrementalUsd(1200e9, 268e9)).toBe(1.68);
  });
  it("windows: 45 days weekly, five years backfill", () => {
    expect(bigQueryWindow("weekly", new Date("2026-09-28T06:00:00Z"))).toEqual({ from: "2026-08-14", to: "2026-09-28" });
    expect(bigQueryWindow("backfill", new Date("2026-09-26T00:00:00Z"))).toEqual({ from: "2021-09-26", to: "2026-09-26" });
  });
});
