import { describe, it, expect } from "vitest";
import { parseThrottling, buildOpsCql } from "../src/patents/epo-ops.js";

describe("OPS helpers", () => {
  it("parses X-Throttling-Control", () => {
    const t = parseThrottling("idle (retrieval=green:200, search=yellow:20, inpadoc=red:30, images=green:200, other=green:1000)");
    expect(t["search"]).toEqual({ colour: "yellow", perMinute: 20 });
    expect(t["inpadoc"]!.colour).toBe("red");
    expect(parseThrottling(null)).toEqual({});
  });
  it("builds CQL with pd within and uppercase operators", () => {
    const q = buildOpsCql("2026-09-18", "2026-09-25");
    expect(q.startsWith('pd within "20260918 20260925" AND')).toBe(true);
    expect(q).toContain('ta="iron nitride"'); expect(q).toContain("cpc=H01F1/047"); expect(q).not.toContain(" or ");
  });
});
