import { describe, it, expect } from "vitest";
import { runQa, extractCitations } from "../src/content/qa.js";

const known = [
  { publication_number: "US-12000001-B2", publication_date: "2026-09-02", applicants: ["Niron Magnetics"], family_id: "F1", title: "t" },
  { publication_number: "CN-118000001-A", publication_date: "2026-08-20", applicants: [], family_id: "F1", title: "t" },
];

describe("QA gate", () => {
  it("passes when every cited number exists and dates match", () => {
    const r = runQa("### Title\nUS-12000001-B2 · published 2026-09-02 · Niron\n\nnote", known);
    expect(r.passed).toBe(true); expect(r.cited).toEqual(["US-12000001-B2"]);
  });
  it("fails on an unknown (possibly invented) number", () => {
    const r = runQa("See US-99999999-B2 published 2026-09-02.", known);
    expect(r.passed).toBe(false); expect(r.unknown).toEqual(["US-99999999-B2"]);
  });
  it("fails on date mismatch", () => {
    const r = runQa("US-12000001-B2 · published 2026-09-09", known);
    expect(r.passed).toBe(false); expect(r.dateMismatches).toHaveLength(1);
  });
  it("accepts kind-less citations", () => {
    expect(extractCitations("CN-118000001 and US-12000001-B2")).toEqual(["CN-118000001", "US-12000001-B2"]);
    expect(runQa("CN-118000001 published 2026-08-20", known).passed).toBe(true);
  });
});
