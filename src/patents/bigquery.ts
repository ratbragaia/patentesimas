/**
 * Google Patents Public Data on BigQuery. Two ways to run the niche query (`bigquery.sql`):
 *  1. REST API (`runQuery`) with the service account in GOOGLE_APPLICATION_CREDENTIALS — RS256 JWT,
 *     no gcloud dependency, dry-run first, refused above BQ_MAX_BYTES_BILLED. Primary path (ADR 0011).
 *  2. The `bq` CLI (`runBigQuery`) — fallback when the REST path fails, and the hand-run export path.
 * Cadence: weekly inside `cli ingest` with a 45-day window (ADR 0009, revised); one-off five-year backfill
 * for the landscape report (ADR 0011). Scan cost is ~268 GB whatever the window.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { createSign } from "node:crypto";
import { httpJson } from "../lib/http.js";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { classify } from "./query.js";
import { normalizeCpc, normalizePublicationNumber } from "./normalize.js";
import type { Publication } from "./types.js";

const execFileP = promisify(execFile);

/** Hard cap per run. The niche query scans ~268 GB whatever the window (ADR 0009); a run that would exceed this fails instead of spending. */
export const BQ_MAX_BYTES_BILLED = 300_000_000_000;
/** Free tier per billing account and month (research 03). Beyond it: US$6.25 per TB. */
export const BQ_FREE_TIER_BYTES = 1_000_000_000_000;
export const BQ_USD_PER_TB = 6.25;
/** Trailing window: KR/WO/JP arrive in the public dataset 3-4 weeks late, and the issue accepts families up to 21 days old. */
export const BQ_LOOKBACK_DAYS = 45;
/** One-off history for the monthly landscape report (ADR 0011). */
export const BQ_BACKFILL_YEARS = 5;
export const BQ_SQL_PATH = new URL("./bigquery.sql", import.meta.url);

export function nicheSql(): string { return readFileSync(BQ_SQL_PATH, "utf8"); }

// ---------- row mapping (shared by both paths and the file loader) ----------

/** `bq query --format=json` on a script with DECLARE nests the last result set: [[{...}]]. */
export function unwrapBqJson(raw: unknown): Record<string, unknown>[] {
  let rows = raw;
  while (Array.isArray(rows) && rows.length === 1 && Array.isArray(rows[0])) rows = rows[0];
  if (!Array.isArray(rows)) throw new Error("bq output is not a JSON array");
  return rows as Record<string, unknown>[];
}

/** One row of `bigquery.sql` → normalised Publication, or null if off-topic. */
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

/** Map BigQuery rows to normalised publications, keeping only on-topic ones. */
export function mapBigQueryRows(rows: Record<string, any>[]): Publication[] {
  return rows.map(mapBigQueryRow).filter((p): p is Publication => !!p);
}

// ---------- path 1: REST API ----------
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

export function loadServiceAccount(path = config().GOOGLE_APPLICATION_CREDENTIALS): ServiceAccount {
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
/**
 * The .sql file carries `DECLARE name TYPE DEFAULT @param;` lines for the bq CLI script mode and then uses
 * `name` in the query. The REST API binds @param directly, so drop the DECLAREs and point the bare
 * references at the parameters.
 */
export function stripDeclares(sql: string): string {
  const vars: [string, string][] = [];
  const body = sql.split("\n").filter((l) => {
    const m = /^\s*DECLARE\s+(\w+)\s+\w+(?:\s+DEFAULT\s+@(\w+))?\s*;/i.exec(l);
    if (!m) return true;
    vars.push([m[1]!, m[2] ?? m[1]!]); return false;
  }).join("\n");
  return vars.reduce((q, [name, param]) => q.replace(new RegExp(`(?<![@\\w])${name}\\b`, "g"), `@${param}`), body);
}

export interface QueryParams { [name: string]: { type: "DATE" | "STRING" | "INT64"; value: string } }
export interface QueryResult { rows: Record<string, unknown>[]; totalBytesProcessed: number; jobId: string | null; cacheHit: boolean }
interface QueryResponse {
  jobComplete: boolean; jobReference?: { jobId: string; location?: string }; schema?: { fields: BqField[] };
  rows?: BqRow[]; totalRows?: string; pageToken?: string; totalBytesProcessed?: string; cacheHit?: boolean; errors?: { message: string }[];
}

/** Run a standard-SQL query with named parameters through the REST API. `dryRun` returns only the bytes estimate. */
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
  while (!res.jobComplete) res = await httpJson<QueryResponse>(q({}), { headers, timeoutMs: 120_000 });
  if (res.errors?.length) throw new Error(`BigQuery: ${res.errors.map((e) => e.message).join("; ")}`);
  const schema = res.schema ?? { fields: [] };
  const rows = convertRows(schema, res.rows);
  let pageToken = res.pageToken;
  while (pageToken) {
    const page = await httpJson<QueryResponse>(q({ pageToken }), { headers, timeoutMs: 120_000 });
    rows.push(...convertRows(schema, page.rows)); pageToken = page.pageToken;
  }
  const total = Number(res.totalBytesProcessed ?? bytes);
  log.info("bigquery query done", { jobId, rows: rows.length, gb: +(total / 1e9).toFixed(1), cacheHit: !!res.cacheHit });
  return { rows, totalBytesProcessed: total, jobId, cacheHit: !!res.cacheHit };
}

const windowParams = (from: string, to: string): QueryParams => ({ window_start: { type: "DATE", value: from }, window_end: { type: "DATE", value: to } });

/** Bytes the niche query would process for this window (free; no job is run). */
export async function estimateNicheBytes(from: string, to: string): Promise<number> {
  return (await runQuery(nicheSql(), windowParams(from, to), { dryRun: true })).totalBytesProcessed;
}

// ---------- path 2: bq CLI ----------

/** Run the niche query through the `bq` CLI with the service-account key from the environment. */
export async function runBigQuery(from: string, to: string): Promise<Record<string, unknown>[]> {
  const c = config();
  if (!c.GCP_PROJECT_ID || !c.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GCP_PROJECT_ID / GOOGLE_APPLICATION_CREDENTIALS not set");
  const args = [`--project_id=${c.GCP_PROJECT_ID}`, "query", "--use_legacy_sql=false", "--format=json", "--max_rows=200000",
    `--maximum_bytes_billed=${BQ_MAX_BYTES_BILLED}`, `--parameter=window_start:DATE:${from}`, `--parameter=window_end:DATE:${to}`];
  const env = { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1", CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: c.GOOGLE_APPLICATION_CREDENTIALS };
  const child = execFileP("bq", args, { env, maxBuffer: 256 * 1024 * 1024 });
  child.child.stdin!.end(nicheSql());
  const { stdout, stderr } = await child;
  const rows = unwrapBqJson(JSON.parse(stdout));
  log.info("bigquery (bq cli) query ok", { from, to, rows: rows.length, stderr: stderr.replace(/\r/g, "\n").split("\n").filter((l) => l && !l.includes("Waiting on")).slice(-1)[0] ?? "" });
  return rows;
}

// ---------- entry point used by ingest ----------
export interface BigQueryFetch { pubs: Publication[]; rows: number; bytes: number | null; path: "rest" | "bq-cli" }

/**
 * Niche publications for a window. REST first (dry-run gate, bytes accounted); if the REST path fails
 * for any reason the verified `bq` CLI path runs instead, so a Monday ingest never loses BigQuery to a
 * client bug. Both are capped at BQ_MAX_BYTES_BILLED by the service itself.
 */
export async function fetchBigQuery(from: string, to: string): Promise<BigQueryFetch> {
  try {
    const est = await estimateNicheBytes(from, to);
    if (est > BQ_MAX_BYTES_BILLED) throw new Error(`dry run estimates ${(est / 1e9).toFixed(0)} GB > cap ${(BQ_MAX_BYTES_BILLED / 1e9).toFixed(0)} GB (ADR 0009); not run`);
    const res = await runQuery(nicheSql(), windowParams(from, to), { maximumBytesBilled: BQ_MAX_BYTES_BILLED });
    return { pubs: mapBigQueryRows(res.rows), rows: res.rows.length, bytes: res.totalBytesProcessed, path: "rest" };
  } catch (err) {
    if (/not run|Missing credential/.test(String(err))) throw err; // a deliberate refusal or missing config is not something to route around
    log.warn("bigquery REST path failed; falling back to bq cli", { err: String(err) });
    const rows = await runBigQuery(from, to);
    return { pubs: mapBigQueryRows(rows), rows: rows.length, bytes: null, path: "bq-cli" };
  }
}

export async function fetchBigQueryPublications(from: string, to: string): Promise<Publication[]> {
  return (await fetchBigQuery(from, to)).pubs;
}
