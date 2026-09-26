import { describe, it, expect } from "vitest";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { buildServiceAccountJwt, convertRows, stripDeclares, mapBigQueryRow, BQ_MAX_BYTES_BILLED } from "../src/patents/bigquery.js";

describe("bigquery client", () => {
  it("signs a service-account JWT the token endpoint can verify", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwt = buildServiceAccountJwt({ client_email: "sa@p.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }) as string }, "https://www.googleapis.com/auth/bigquery", 1_700_000_000);
    const [h, c, s] = jwt.split(".") as [string, string, string];
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ iss: "sa@p.iam.gserviceaccount.com", aud: "https://oauth2.googleapis.com/token", iat: 1_700_000_000, exp: 1_700_003_600 });
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
  it("strips DECLARE lines meant for the bq CLI and keeps the parameters", () => {
    const sql = stripDeclares("DECLARE window_start DATE DEFAULT @window_start;\nDECLARE window_end   DATE DEFAULT @window_end;\nSELECT 1 WHERE d BETWEEN @window_start AND @window_end");
    expect(sql).not.toMatch(/DECLARE/); expect(sql).toContain("@window_start");
  });
  it("maps a niche row and drops off-topic rows", () => {
    const p = mapBigQueryRow({ publication_number: "US-12345678-B2", country_code: "US", kind_code: "B2", family_id: "77", title_en: "Iron nitride permanent magnet", abstract_en: "Fe16N2 bulk magnet", cpc_codes: ["H01F1/047"], applicants: ["NIRON MAGNETICS INC"], inventors: [], publication_date: "2026-08-04" });
    expect(p?.source).toBe("bigquery"); expect(p?.matched_terms).toContain("iron nitride");
    expect(mapBigQueryRow({ publication_number: "US-1-A", country_code: "US", title_en: "Bicycle bell", abstract_en: "", cpc_codes: ["B62J3/00"], publication_date: "2026-08-04" })).toBeNull();
  });
  it("keeps the ADR 0009 cap", () => expect(BQ_MAX_BYTES_BILLED).toBe(300_000_000_000));
});
