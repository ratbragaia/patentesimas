/**
 * Google Patents Public Data on BigQuery, called through the REST API with the service account
 * in GOOGLE_APPLICATION_CREDENTIALS (no gcloud/bq CLI dependency, so systemd timers and the ops
 * channel can run it). Every run is dry-run first and refused above BQ_MAX_BYTES_BILLED (ADR 0009/0011).
 */
import { readFileSync } from "node:fs";
import { createSign } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { httpJson } from "../lib/http.js";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { classify } from "./query.js";
import { normalizePublicationNumber, normalizeCpc } from "./normalize.js";
import type { Publication } from "./types.js";

const here = dirname(fileURLToPath(import.meta.url));

/** Hard cap per query (ADR 0009): a run that would exceed it fails instead of spending. */
export const BQ_MAX_BYTES_BILLED = 300_000_000_000;
/** Free tier per billing account and month (research 03). Crossing it costs US$6.25/TB. */
export const BQ_FREE_TIER_BYTES = 1_000_000_000_000;

interface ServiceAccount { client_email: string; private_key: string; token_uri?: string; project_id?: string }

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** RS256 JWT for the OAuth2 JWT-bearer grant. Exported for tests (signature verified with the public key). */
export function buildServiceAccountJwt(sa: ServiceAccount, scope: string, nowSec = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const aud = sa.token_uri ?? "https://oauth2.googleapis.com/token";
  const claims = b64url(JSON.stringify({ iss: sa.client_email, scope, aud, iat: nowSec, exp: nowSec + 3600 }));
  const signer = createSign("RSA-SHA256"); signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(sa.private_key))}`;
}

let tokenCache: { token: string; exp: number } | undefined;

export function loadServiceAccount(path = process.env["GOOGLE_APPLICATION_CREDENTIALS"]): ServiceAccount {
  if (!path) throw new Error("Missing credential GOOGLE_APPLICATION_CREDENTIALS. See docs/handoff-checklist.md item 9");
  const sa = JSON.parse(readFileSync(path, "utf8")) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("service account file lacks client_email/private_key");
  return sa;
}

async function accessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (tokenCache && tokenCache.exp - 60 > now) return tokenCache.token;
  const sa = loadServiceAccount();
  const assertion = buildServiceAccountJwt(sa, "https://www.googleapis.com/auth/bigquery", now);
  const res = await httpJson<{ access_token: string; expires_in: number }>(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  tokenCache = { token: res.access_token, exp: now + res.expires_in };
  return res.access_token;
}

// ---------- result conversion ----------
export interface BqField { name: string; type: string; mode?: string; fields?: BqField[] }
interface BqCell { v: unknown }
interface BqRow { f: BqCell[] }

function scalar(type: string, v: unknown): unknown {
  if (v === null || v === undefined) return null;
  switch (type) {
    case "INTEGER": case "INT64": case "FLOAT": case "FLOAT64": case "NUMERIC": case "BIGNUMERIC": return Number(v);
    case "BOOLEAN": case "BOOL": return v === "true" || v === true;
    default: return String(v);
  }
}

function cell(field: BqField, v: unknown): unknown {
  if (field.mode === "REPEATED") return Array.isArray(v) ? v.map((x) => cell({ ...field, mode: "NULLABLE" }, (x as BqCell).v)) : [];
  if (field.type === "RECORD" || field.type === "STRUCT") return v && typeof v === "object" ? convertRows({ fields: field.fields ?? [] }, [v as BqRow])[0] : null;
  return scalar(field.type, v);
}

/** Turn the API's `{f:[{v}]}` rows into plain objects keyed by column name (arrays and structs included). */
export function convertRows(schema: { fields: BqField[] }, rows: BqRow[] | undefined): Record<string, unknown>[] {
  return (rows ?? []).map((r) => Object.fromEntries(schema.fields.map((f, i) => [f.name, cell(f, r.f[i]?.v)])));
}

/** The .sql files carry `DECLARE x DEFAULT @x;` lines for the bq CLI; the REST API binds @x directly. */
export function stripDeclares(sql: string): string {
  return sql.split("\n").filter((l) => !/^\s*DECLARE\s/i.test(l)).join("\n");
}

export interface QueryParams { [name: string]: { type: "DATE" | "STRING" | "INT64"; value: string } }
export interface QueryResult { rows: Record<string, unknown>[]; totalBytesProcessed: number; jobId: string | null; cacheHit: boolean }

interface QueryResponse {
  jobComplete: boolean; jobReference?: { jobId: string; location?: string }; schema?: { fields: BqField[] };
  rows?: BqRow[]; totalRows?: string; pageToken?: string; totalBytesProcessed?: string; cacheHit?: boolean; errors?: { message: string }[];
}

/** Run a standard-SQL query with named parameters. `dryRun` returns only the bytes estimate. */
export async function runQuery(sql: string, params: QueryParams, opts: { dryRun?: boolean; maximumBytesBilled?: number; projectId?: string } = {}): Promise<QueryResult> {
  const projectId = opts.projectId ?? config().GCP_PROJECT_ID;
  if (!projectId) throw new Error("Missing credential GCP_PROJECT_ID");
  const token = await accessToken();
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const base = `https://bigquery.googleapis.com/bigquery/v2/projects/${encodeURIComponent(projectId)}`;
  const body = {
    query: stripDeclares(sql), useLegacySql: false, parameterMode: "NAMED",
    queryParameters: Object.entries(params).map(([name, p]) => ({ name, parameterType: { type: p.type }, parameterValue: { value: p.value } })),
    dryRun: !!opts.dryRun, maximumBytesBilled: String(opts.maximumBytesBilled ?? BQ_MAX_BYTES_BILLED), timeoutMs: 60_000, maxResults: 5000,
  };
  let res = await httpJson<QueryResponse>(`${base}/queries`, { method: "POST", headers, body: JSON.stringify(body), timeoutMs: 120_000, retries: 1 });
  const bytes = Number(res.totalBytesProcessed ?? 0);
  if (opts.dryRun) return { rows: [], totalBytesProcessed: bytes, jobId: null, cacheHit: false };

  const jobId = res.jobReference?.jobId ?? null; const location = res.jobReference?.location;
  const q = (extra: Record<string, string>) => `${base}/queries/${jobId}?${new URLSearchParams({ timeoutMs: "60000", maxResults: "5000", ...(location ? { location } : {}), ...extra })}`;
  while (!res.jobComplete) {
    res = await httpJson<QueryResponse>(q({}), { headers, timeoutMs: 120_000 });
  }
  if (res.errors?.length) throw new Error(`BigQuery: ${res.errors.map((e) => e.message).join("; ")}`);
  const schema = res.schema ?? { fields: [] };
  const rows = convertRows(schema, res.rows);
  let pageToken = res.pageToken;
  while (pageToken) {
    const page = await httpJson<QueryResponse>(q({ pageToken }), { headers, timeoutMs: 120_000 });
    rows.push(...convertRows(schema, page.rows)); pageToken = page.pageToken;
  }
  log.info("bigquery query done", { jobId, rows: rows.length, gb: +(Number(res.totalBytesProcessed ?? bytes) / 1e9).toFixed(1), cacheHit: !!res.cacheHit });
  return { rows, totalBytesProcessed: Number(res.totalBytesProcessed ?? bytes), jobId, cacheHit: !!res.cacheHit };
}

export function nicheSql(): string { return readFileSync(join(here, "bigquery.sql"), "utf8"); }

/** One row of `bigquery.sql` (live or from a `bq --format=json` file) → normalised Publication, or null if off-topic. */
export function mapBigQueryRow(r: Record<string, any>): Publication | null {
  const cpcs: string[] = (r.cpc_codes ?? []).map(normalizeCpc);
  const matched = classify({ title: r.title_en, abstract: r.abstract_en, cpc_codes: cpcs });
  if (!matched) return null;
  return {
    publication_number: normalizePublicationNumber(r.publication_number), country_code: r.country_code, kind_code: r.kind_code ?? null,
    family_id: r.family_id ?? null, title: r.title_en ?? null, abstract: r.abstract_en ?? null, applicants: r.applicants ?? [], inventors: r.inventors ?? [],
    cpc_codes: cpcs, priority_date: r.priority_date ?? null, filing_date: r.filing_date ?? null, publication_date: r.publication_date, grant_date: r.grant_date ?? null,
    application_number: r.application_number ?? null, source: "bigquery", source_payload: r, matched_terms: matched,
  };
}
