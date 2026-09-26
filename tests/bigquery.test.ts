import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { unwrapBqJson, mapBigQueryRows, mapBigQueryRow, buildServiceAccountJwt, convertRows, stripDeclares, BQ_LOOKBACK_DAYS, BQ_MAX_BYTES_BILLED, BQ_BACKFILL_YEARS } from "../src/patents/bigquery.js";

const row = {
  publication_number: "CN-120000001-A", country_code: "CN", kind_code: "A", family_id: "99001",
  title_en: "Iron nitride permanent magnet and preparation method", abstract_en: "A rare-earth-free Fe16N2 magnet with high coercivity.",
  cpc_codes: ["H01F 1/047", "C01B21/06"], applicants: ["Example Univ"], inventors: ["A Person"],
  priority_date: "2025-03-01", filing_date: "2025-03-01", publication_date: "2026-08-20", grant_date: null, application_number: "CN-202510000001-A",
};

describe("bigquery source (row handling)", () => {
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
    expect(mapBigQueryRow({ publication_number: "US-1-A", country_code: "US", title_en: "Bicycle bell", abstract_en: "", cpc_codes: ["B62J3/00"], publication_date: "2026-08-04" })).toBeNull();
  });
  it("skips rows it cannot normalise or date instead of aborting the run", () => {
    expect(mapBigQueryRow({ ...row, publication_number: "??-garbage" })).toBeNull();
    expect(mapBigQueryRow({ ...row, publication_date: null })).toBeNull();
    expect(mapBigQueryRow({ ...row, publication_number: "US-PP33549-P2" })?.publication_number).toBe("US-PP33549-P2");
  });
  it("window, cap and backfill horizon match ADR 0009/0011", () => { expect(BQ_LOOKBACK_DAYS).toBe(45); expect(BQ_MAX_BYTES_BILLED).toBe(300_000_000_000); expect(BQ_BACKFILL_YEARS).toBe(5); });
});

describe("bigquery REST client", () => {
  it("signs a service-account JWT the token endpoint can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = buildServiceAccountJwt({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) as string }, "https://www.googleapis.com/auth/bigquery", 1_700_000_000);
    const [h, c, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    expect(JSON.parse(Buffer.from(c, "base64url").toString())).toMatchObject({ iss: "sa@p.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
    const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
  it("converts API rows including repeated fields and dates", () => {
    const schema = { fields: [
      { name: "publication_number", type: "STRING" }, { name: "cpc_codes", type: "STRING", mode: "REPEATED" },
      { name: "publication_date", type: "DATE" }, { name: "n", type: "INTEGER" }, { name: "abstract_en", type: "STRING" },
    ] };
    const rows = [{ f: [{ v: "CN-118123456-A" }, { v: [{ v: "H01F1/06" }, { v: "C22C22/00" }] }, { v: "2026-08-12" }, { v: "3" }, { v: null }] }];
    expect(convertRows(schema, rows)).toEqual([{ publication_number: "CN-118123456-A", cpc_codes: ["H01F1/06", "C22C22/00"], publication_date: "2026-08-12", n: 3, abstract_en: null }]);
    expect(convertRows(schema, undefined)).toEqual([]);
  });
  it("strips DECLARE lines meant for the bq CLI and rebinds bare variable references to the parameters", () => {
    const sql = stripDeclares("DECLARE window_start DATE DEFAULT @window_start;\nDECLARE window_end   DATE DEFAULT @window_end;\nSELECT 1 WHERE d BETWEEN FORMAT_DATE('%Y%m%d', window_start) AND CAST(window_end AS STRING) AND x = @window_start");
    expect(sql).not.toMatch(/DECLARE/);
    expect(sql).toBe("SELECT 1 WHERE d BETWEEN FORMAT_DATE('%Y%m%d', @window_start) AND CAST(@window_end AS STRING) AND x = @window_start");
  });
  it("rewrites the real niche query so no bare DECLARE variable remains", async () => {
    const { nicheSql } = await import("../src/patents/bigquery.js");
    const q = stripDeclares(nicheSql());
    expect(q).not.toMatch(/(?<![@\w])window_(start|end)\b/); expect(q).toContain("@window_start"); expect(q).toContain("@window_end");
  });
});
