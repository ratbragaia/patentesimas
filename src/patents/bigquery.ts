import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";
import { config } from "../lib/config.js";
import { log } from "../lib/log.js";
import { classify } from "./query.js";
import { normalizeCpc, normalizePublicationNumber } from "./normalize.js";
import type { Publication } from "./types.js";

const execFileP = promisify(execFile);

/** Hard cap per run. The niche query scans ~268 GB whatever the window (ADR 0009); a run that would exceed this fails instead of spending. */
export const BQ_MAX_BYTES_BILLED = 300_000_000_000;
/** Trailing window: KR/WO/JP arrive in the public dataset 3-4 weeks late, and the issue accepts families up to 21 days old. */
export const BQ_LOOKBACK_DAYS = 45;
export const BQ_SQL_PATH = new URL("./bigquery.sql", import.meta.url);

/** `bq query --format=json` on a script with DECLARE nests the last result set: [[{...}]]. */
export function unwrapBqJson(raw: unknown): Record<string, unknown>[] {
  let rows = raw;
  while (Array.isArray(rows) && rows.length === 1 && Array.isArray(rows[0])) rows = rows[0];
  if (!Array.isArray(rows)) throw new Error("bq output is not a JSON array");
  return rows as Record<string, unknown>[];
}

/** Map BigQuery rows to normalised publications, keeping only on-topic ones. */
export function mapBigQueryRows(rows: Record<string, any>[]): Publication[] {
  const out: Publication[] = [];
  for (const r of rows) {
    const cpcs: string[] = (r.cpc_codes ?? []).map(normalizeCpc);
    const matched = classify({ title: r.title_en, abstract: r.abstract_en, cpc_codes: cpcs });
    if (!matched) continue;
    out.push({
      publication_number: normalizePublicationNumber(r.publication_number), country_code: r.country_code, kind_code: r.kind_code ?? null,
      family_id: r.family_id ?? null, title: r.title_en ?? null, abstract: r.abstract_en ?? null, applicants: r.applicants ?? [], inventors: r.inventors ?? [],
      cpc_codes: cpcs, priority_date: r.priority_date ?? null, filing_date: r.filing_date ?? null, publication_date: r.publication_date, grant_date: r.grant_date ?? null,
      application_number: r.application_number ?? null, source: "bigquery", source_payload: r, matched_terms: matched,
    });
  }
  return out;
}

/** Run the niche query through the `bq` CLI with the service-account key from the environment. */
export async function runBigQuery(from: string, to: string): Promise<Record<string, unknown>[]> {
  const c = config();
  if (!c.GCP_PROJECT_ID || !c.GOOGLE_APPLICATION_CREDENTIALS) throw new Error("GCP_PROJECT_ID / GOOGLE_APPLICATION_CREDENTIALS not set");
  const args = [`--project_id=${c.GCP_PROJECT_ID}`, "query", "--use_legacy_sql=false", "--format=json", "--max_rows=200000",
    `--maximum_bytes_billed=${BQ_MAX_BYTES_BILLED}`, `--parameter=window_start:DATE:${from}`, `--parameter=window_end:DATE:${to}`];
  const env = { ...process.env, CLOUDSDK_CORE_DISABLE_PROMPTS: "1", CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE: c.GOOGLE_APPLICATION_CREDENTIALS };
  const sql = readFileSync(BQ_SQL_PATH, "utf8");
  const child = execFileP("bq", args, { env, maxBuffer: 256 * 1024 * 1024 });
  child.child.stdin!.end(sql);
  const { stdout, stderr } = await child;
  const rows = unwrapBqJson(JSON.parse(stdout));
  log.info("bigquery query ok", { from, to, rows: rows.length, stderr: stderr.replace(/\r/g, "\n").split("\n").filter((l) => l && !l.includes("Waiting on")).slice(-1)[0] ?? "" });
  return rows;
}

export async function fetchBigQueryPublications(from: string, to: string): Promise<Publication[]> {
  return mapBigQueryRows(await runBigQuery(from, to));
}
