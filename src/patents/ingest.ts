import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { config } from "../lib/config.js";
import { fetchPatentsViewGrants } from "./patentsview.js";
import { fetchOpsPublications, lookupFamilyId } from "./epo-ops.js";
import { fetchBigQuery, estimateNicheBytes, BQ_LOOKBACK_DAYS, BQ_BACKFILL_YEARS, BQ_MAX_BYTES_BILLED, BQ_FREE_TIER_BYTES, BQ_USD_PER_TB } from "./bigquery.js";
import { groupFamilies } from "./families.js";
import { notifyFounder } from "../reporting/telegram.js";
import type { Publication } from "./types.js";

export interface IngestWindow { from: string; to: string }

/**
 * Window = [min(last successful window_end, today-lookback), today]. DOCDB loads some offices late, so we
 * always re-scan three weeks (45 days for BigQuery, whose public dataset lags 3-4 weeks for KR/WO/JP);
 * upserts ignore duplicates, and "new" is decided by first_seen_at, not by publication date
 * (docs/research/03-patent-data-sources.md §6.3, ADR 0009).
 */
export async function computeWindow(source: string, today = new Date(), lookbackDays = 21): Promise<IngestWindow> {
  const { data } = await db().from("ingest_runs").select("window_end").eq("source", source).eq("status", "succeeded")
    .order("window_end", { ascending: false }).limit(1).maybeSingle();
  const to = today.toISOString().slice(0, 10);
  const lookback = new Date(today); lookback.setDate(lookback.getDate() - lookbackDays);
  const lb = lookback.toISOString().slice(0, 10);
  const from = data?.window_end && data.window_end < lb ? data.window_end : lb;
  return { from, to };
}

export async function upsertPublications(pubs: Publication[]): Promise<number> {
  if (pubs.length === 0) return 0;
  // Idempotent: primary key publication_number; re-ingesting the same window changes nothing.
  const { error, count } = await db().from("patent_publications")
    .upsert(pubs, { onConflict: "publication_number", ignoreDuplicates: true, count: "exact" });
  if (error) throw new Error(`upsert publications: ${error.message}`);
  return count ?? 0;
}

type Fetched = Publication[] | { pubs: Publication[]; rows?: number; bytes?: number | null };

async function runSource(source: "patentsview" | "epo_ops" | "bigquery", fetcher: (w: IngestWindow) => Promise<Fetched>, lookbackDays = 21, mode?: string) {
  const w = await computeWindow(source, new Date(), lookbackDays);
  const { data: run } = await db().from("ingest_runs").insert({ source, mode: mode ?? null, window_start: w.from, window_end: w.to }).select("id").single();
  try {
    const fetched = await fetcher(w);
    const pubs = Array.isArray(fetched) ? fetched : fetched.pubs;
    const extra = Array.isArray(fetched) ? {} : { fetched: fetched.rows ?? pubs.length, bytes_processed: fetched.bytes ?? null };
    const inserted = await upsertPublications(pubs);
    await db().from("ingest_runs").update({ status: "succeeded", fetched: pubs.length, inserted, finished_at: new Date().toISOString(), ...extra }).eq("id", run!.id);
    log.info("ingest ok", { source, ...w, fetched: pubs.length, inserted, ...extra });
    return pubs;
  } catch (err) {
    await db().from("ingest_runs").update({ status: "failed", error: String(err), finished_at: new Date().toISOString() }).eq("id", run!.id);
    log.error("ingest failed", { source, err: String(err) });
    throw err;
  }
}

/**
 * Weekly ingest. Source roles (ADR 0005, 0008, 0009): EPO OPS is the primary detector of new publications
 * for US/EP/WO/CN/JP/KR (DOCDB is weekly). BigQuery (Google Patents public data) runs weekly too, with a
 * 45-day trailing window: it is the only source with English text for CN today and catches late arrivals
 * (~US$1/month above the free tier). PatentsView is deferred (ODP migration) and stays enrichment/QA.
 * A failing source does not stop the others.
 */
export async function ingestAll(): Promise<void> {
  const c = config();
  const all: Publication[] = [];
  if (c.EPO_OPS_CONSUMER_KEY) all.push(...(await runSource("epo_ops", (w) => fetchOpsPublications(w.from, w.to))));
  if (c.PATENTSVIEW_API_KEY) all.push(...(await runSource("patentsview", (w) => fetchPatentsViewGrants(w.from, w.to))));
  if (c.GCP_PROJECT_ID && c.GOOGLE_APPLICATION_CREDENTIALS) {
    try { all.push(...(await runSource("bigquery", (w) => fetchBigQuery(w.from, w.to), BQ_LOOKBACK_DAYS, "weekly"))); }
    catch (err) { log.error("bigquery source failed; continuing with other sources", { err: String(err) }); }
  }
  // A JSON export from `bq query --format=json` can also be loaded by hand: `cli ingest bigquery <file.json>`.

  // Fill missing family ids via OPS (US grants from PatentsView have none).
  if (c.EPO_OPS_CONSUMER_KEY) {
    for (const p of all.filter((x) => !x.family_id)) {
      try {
        const fam = await lookupFamilyId(p.publication_number);
        if (fam) { p.family_id = fam; await db().from("patent_publications").update({ family_id: fam }).eq("publication_number", p.publication_number); }
      } catch (err) { log.warn("family lookup failed", { pub: p.publication_number, err: String(err) }); }
    }
  }
  await rebuildFamilies(all);
  await audit("production", "ingest_all", "patent_publications", undefined, { count: all.length });
}

export type BigQueryMode = "weekly" | "backfill";
export interface BigQueryIngestResult { mode: BigQueryMode; from: string; to: string; bytes: number; monthBytes: number; estimatedUsd: number; dryRun: boolean; rows: number; onTopic: number; inserted: number; families: number; path?: string }

/**
 * On-demand BigQuery windows (ADR 0009 revised, ADR 0011). Scan cost does not depend on the window
 * (the table is not partitioned), so the weekly run re-scans 45 days and the one-off landscape backfill
 * takes five years for the same ~268 GB.
 */
export function bigQueryWindow(mode: BigQueryMode, today = new Date()): IngestWindow {
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today);
  if (mode === "backfill") from.setUTCFullYear(from.getUTCFullYear() - BQ_BACKFILL_YEARS); else from.setUTCDate(from.getUTCDate() - BQ_LOOKBACK_DAYS);
  return { from: from.toISOString().slice(0, 10), to };
}

/** Bytes already processed by BigQuery runs this calendar month (free tier is 1 TB/month). */
export async function bigQueryBytesThisMonth(today = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString();
  const { data } = await db().from("ingest_runs").select("bytes_processed").eq("source", "bigquery").gte("started_at", monthStart);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.bytes_processed ?? 0), 0);
}

/** On-demand charge this run would add: bytes beyond the month's free tier at US$6.25/TB. */
export function bigQueryIncrementalUsd(monthBytes: number, runBytes: number): number {
  const billable = Math.max(0, monthBytes + runBytes - BQ_FREE_TIER_BYTES) - Math.max(0, monthBytes - BQ_FREE_TIER_BYTES);
  return +((billable / 1e12) * BQ_USD_PER_TB).toFixed(2);
}

/**
 * On-demand BigQuery ingest (`cli ingest bigquery [backfill] [dry-run]`). Dry-run first; refuses above the
 * per-query cap, and refuses when the run's own on-demand charge would exceed SPEND_CAP_USD_PER_ACTION
 * (CLAUDE.md rule 3). Going past the free tier by itself is accepted and recorded (ADR 0009: ~US$1/month).
 */
export async function ingestBigQuery(opts: { mode: BigQueryMode; dryRun?: boolean; today?: Date }): Promise<BigQueryIngestResult> {
  const today = opts.today ?? new Date();
  const w = bigQueryWindow(opts.mode, today);
  const est = await estimateNicheBytes(w.from, w.to);
  const monthBytes = await bigQueryBytesThisMonth(today);
  const estimatedUsd = bigQueryIncrementalUsd(monthBytes, est);
  const base: BigQueryIngestResult = { mode: opts.mode, ...w, bytes: est, monthBytes, estimatedUsd, dryRun: true, rows: 0, onTopic: 0, inserted: 0, families: 0 };
  log.info("bigquery dry run", { mode: opts.mode, ...w, gb: +(est / 1e9).toFixed(1), monthGb: +(monthBytes / 1e9).toFixed(1), estimatedUsd });
  if (est > BQ_MAX_BYTES_BILLED) throw new Error(`BigQuery dry run estimates ${(est / 1e9).toFixed(0)} GB > cap ${(BQ_MAX_BYTES_BILLED / 1e9).toFixed(0)} GB (ADR 0009); not run`);
  if (estimatedUsd > config().SPEND_CAP_USD_PER_ACTION) throw new Error(`BigQuery run would cost about USD ${estimatedUsd}, above SPEND_CAP_USD_PER_ACTION; needs a spend_approvals row first (CLAUDE.md rule 3); not run`);
  if (opts.dryRun) return base;

  const { data: run } = await db().from("ingest_runs").insert({ source: "bigquery", mode: opts.mode, window_start: w.from, window_end: w.to }).select("id").single();
  try {
    const res = await fetchBigQuery(w.from, w.to);
    const inserted = await upsertPublications(res.pubs);
    const families = await rebuildFamilies(res.pubs);
    const bytes = res.bytes ?? est;
    await db().from("ingest_runs").update({ status: "succeeded", fetched: res.rows, inserted, bytes_processed: bytes, finished_at: new Date().toISOString() }).eq("id", run!.id);
    await audit("production", "ingest_bigquery", "ingest_runs", run!.id, { mode: opts.mode, ...w, rows: res.rows, onTopic: res.pubs.length, inserted, families, bytes, path: res.path });
    const out: BigQueryIngestResult = { ...base, dryRun: false, bytes, rows: res.rows, onTopic: res.pubs.length, inserted, families, path: res.path };
    log.info("bigquery ingest ok", { ...out });
    if (opts.mode === "backfill") await notifyFounder(`🗄️ BigQuery ${BQ_BACKFILL_YEARS}-year backfill loaded (${w.from}..${w.to}): ${res.rows} candidates → ${res.pubs.length} on-topic, ${inserted} new publications, ${families} families. ${(bytes / 1e9).toFixed(0)} GB processed; month total ${((monthBytes + bytes) / 1e9).toFixed(0)} GB (free tier 1000 GB, on-demand charge this run ≈ USD ${estimatedUsd}).`);
    return out;
  } catch (err) {
    await db().from("ingest_runs").update({ status: "failed", error: String(err), finished_at: new Date().toISOString() }).eq("id", run!.id);
    log.error("bigquery ingest failed", { mode: opts.mode, err: String(err) });
    throw err;
  }
}

export async function rebuildFamilies(pubs: Publication[]): Promise<number> {
  const groups = groupFamilies(pubs);
  const rows = groups.map((g) => ({
    family_id: g.family_id,
    representative_publication: g.representative.publication_number,
    earliest_priority_date: g.earliest_priority_date,
    offices: g.offices,
    technology_bucket: g.technology_bucket,
  }));
  // Batched: a five-year backfill has ~2k families; one request per family took minutes.
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db().from("patent_families").upsert(rows.slice(i, i + 500), { onConflict: "family_id", ignoreDuplicates: false });
    if (error) throw new Error(`upsert families: ${error.message}`);
  }
  log.info("families rebuilt", { families: groups.length });
  return groups.length;
}
