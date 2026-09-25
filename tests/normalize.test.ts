import { describe, it, expect } from "vitest";
import { normalizePublicationNumber, normalizeCpc, toIsoDate } from "../src/patents/normalize.js";

describe("publication number normalisation", () => {
  it("handles BigQuery form", () => expect(normalizePublicationNumber("US-11234567-B2")).toBe("US-11234567-B2"));
  it("handles epodoc form", () => expect(normalizePublicationNumber("EP4123456A1")).toBe("EP-4123456-A1"));
  it("handles WO with kind", () => expect(normalizePublicationNumber("WO2026123456A1")).toBe("WO-2026123456-A1"));
  it("handles PatentsView bare id with hints", () => expect(normalizePublicationNumber("11234567", "US", "B2")).toBe("US-11234567-B2"));
  it("rejects garbage", () => expect(() => normalizePublicationNumber("hello")).toThrow());
  it("normalises cpc", () => expect(normalizeCpc("H01F 1/047")).toBe("H01F1/047"));
  it("parses dates", () => { expect(toIsoDate("20260918")).toBe("2026-09-18"); expect(toIsoDate("2026-09-18T00:00:00Z")).toBe("2026-09-18"); expect(toIsoDate(null)).toBeNull(); });
});
