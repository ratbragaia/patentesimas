import { describe, it, expect } from "vitest";
import { classify, bucketFor, matchTerms } from "../src/patents/query.js";

describe("niche classifier", () => {
  it("includes iron nitride magnets", () => {
    const r = classify({ title: "Iron nitride permanent magnet and method", abstract: "An α''-Fe16N2 bulk magnet...", cpc_codes: ["H01F1/047"] });
    expect(r).not.toBeNull();
    expect(bucketFor(r!, ["H01F1/047"])).toBe("iron_nitride");
  });
  it("excludes plain NdFeB patents classified in rare-earth CPC", () => {
    expect(classify({ title: "Sintered NdFeB magnet with improved coercivity", abstract: "Nd2Fe14B grains...", cpc_codes: ["H01F1/057"] })).toBeNull();
  });
  it("keeps rare-earth-lean work even under RE CPC", () => {
    const r = classify({ title: "Reduced dysprosium magnet", abstract: "A rare-earth-lean composition with Ce-substituted...", cpc_codes: ["H01F1/057"] });
    expect(r).not.toBeNull();
    expect(bucketFor(r!, ["H01F1/057"])).toBe("re_lean");
  });
  it("excludes unrelated ferrite CPC without keyword", () => {
    expect(classify({ title: "Inductor core", abstract: "soft magnetic component", cpc_codes: ["H01F1/08"] })).toBeNull();
  });
  it("matches MnBi and ferrite terms", () => {
    expect(matchTerms("MnBi based magnet with strontium ferrite binder")).toEqual(expect.arrayContaining(["MnBi", "strontium ferrite"]));
  });
});
