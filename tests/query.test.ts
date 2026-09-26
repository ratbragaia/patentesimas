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

describe("token matching (landscape backfill findings, ADR 0011)", () => {
  it("does not match MnAl inside a high-entropy alloy name", () => {
    expect(matchTerms("TiO2-loaded NiCoCuMnAl high-entropy catalyst")).toEqual([]);
    expect(classify({ title: "High-entropy single crystal cathode material", abstract: "LiNiCoMnAl oxide", cpc_codes: ["H01M4/00"] })).toBeNull();
  });
  it("still matches the legitimate forms", () => {
    expect(matchTerms("τ-MnAl-C magnet")).toEqual(expect.arrayContaining(["MnAl", "τ-MnAl"]));
    expect(matchTerms("MnAlC powder")).toContain("MnAl");
    expect(matchTerms("bulk Fe16N2 magnet")).toContain("Fe16N2");
    expect(matchTerms("MnBi/ferrite composite")).toContain("MnBi");
  });
});

describe("research-driven edge cases", () => {
  it("rejects the Sm2Fe17Nx nitride trap", () => {
    expect(classify({ title: "Sm2Fe17N3 magnet powder", abstract: "A rare earth iron nitride Sm2Fe17Nx...", cpc_codes: ["H01F1/059"] })).toBeNull();
  });
  it("includes Dy-free and Ce-Fe-B as rare-earth-lean", () => {
    const r = classify({ title: "Dy-free Ce-Fe-B sintered magnet", abstract: "", cpc_codes: ["H01F1/057"] });
    expect(r).not.toBeNull(); expect(bucketFor(r!, ["H01F1/057"])).toBe("re_lean");
  });
  it("classifies magnet-free motors as motor topology", () => {
    const r = classify({ title: "Synchronous reluctance machine", abstract: "A magnet-free motor rotor with flux barriers", cpc_codes: ["H02K19/10"] });
    expect(r).not.toBeNull(); expect(bucketFor(r!, ["H02K19/10"])).toBe("motor_topology");
  });
});
