import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { config } from "../lib/config.js";
import { fetchPatentsViewGrants } from "./patentsview.js";
import { fetchOpsPublications, lookupFamilyId } from "./epo-ops.js";
import { groupFamilies } from "./families.js";
import { runQuery, nicheSql, mapBigQueryRow, BQ_MAX_BYTES_BILLED, BQ_FREE_TIER_BYTES } from "./bigquery.js";
import { notifyFounder } from "../reporting/telegram.js";
import type { Publication } from "./types.js";

export interface IngestWindow { from: string; to: string }

/**
 * Window = [min(last successful window_end, today-21d), today]. DOCDB loads some offices late, so we
 * always re-scan three weeks; upserts ignore duplicates, and "new" is decided by first_seen_at, not by
 * publication date (docs/research/03-patent-data-sources.md §6.3).
 */
export async function computeWindow(source: string, today = new Date()): Promise<IngestWindow> {
  const { data } = await db().from("ingest_runs").select("window_end").eq("source", source).eq("status", "succeeded")
    .order("window_end", { ascending: false }).limit(1).maybeSingle();
  const to = today.toISOString().slice(0, 10);
  const lookback = new Date(today); lookback.setDate(lookback.getDate() - 21);
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

async function runSource(source: "patentsview" | "epo_ops", fetcher: (w: IngestWindow) => Promise<Publication[]>) {
  const w = await computeWindow(source);
  const { data: run } = await db().from("ingest_runs").insert({ source, window_start: w.from, window_end: w.to }).select("id").single();
  try {
    const pubs = await fetcher(w);
    const inserted = await upsertPublications(pubs);
    await db().from("ingest_runs").update({ status: "succeeded", fetched: pubs.length, inserted, finished_at: new Date().toISOString() }).eq("id", run!.id);
    log.info("ingest ok", { source, ...w, fetched: pubs.length, inserted });
    return pubs;
  } catch (err) {
    await db().from("ingest_runs").update({ status: "failed", error: String(err), finished_at: new Date().toISOString() }).eq("id", run!.id);
    log.error("ingest failed", { source, err: String(err) });
    throw err;
  }
}

/**
 * Weekly ingest. Source roles (ADR 0005): EPO OPS is the primary detector of new publications for
 * US/EP/WO/CN/JP/KR (DOCDB is weekly). PatentsView refreshes quarterly and is migrating to the USPTO
 * Open Data Portal, so it is enrichment/QA for US documents (assignee disambiguation, cpc_current,
 * claims), not the detector. BigQuery (quarterly) is back-fill and landscape counts.
 */
export async function ingestAll(): Promise<void> {
  const c = config();
  const all: Publication[] = [];
  if (c.EPO_OPS_CONSUMER_KEY) all.push(...(await runSource("epo_ops", (w) => fetchOpsPublications(w.from, w.to))));
  if (c.PATENTSVIEW_API_KEY) all.push(...(await runSource("patentsview", (w) => fetchPatentsViewGrants(w.from, w.to))));
  // BigQuery runs monthly (`cli ingest bigquery`, ADR 0009), not in the weekly job.

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

export type BigQueryMode = "monthly" | "backfill";
export interface BigQueryIngestResult { mode: BigQueryMode; from: string; to: string; bytes: number; monthBytes: number; dryRun: boolean; rows: number; onTopic: number; inserted: number; families: number }

/**
 * BigQuery window (ADR 0009/0011). The scan cost does not depend on the window (table is not
 * partitioned), so the monthly run re-scans a trailing 60 days (Asian offices lag 2–4 weeks; the
 * upsert is idempotent) and the one-off landscape backfill takes five years for the same price.
 */
export function bigQueryWindow(mode: BigQueryMode, today = new Date()): IngestWindow {
  const to = today.toISOString().slice(0, 10);
  const from = new Date(today);
  if (mode === "backfill") from.setUTCFullYear(from.getUTCFullYear() - 5); else from.setUTCDate(from.getUTCDate() - 60);
  return { from: from.toISOString().slice(0, 10), to };
}

/** Bytes already processed by BigQuery runs this calendar month (free tier is 1 TB/month). */
export async function bigQueryBytesThisMonth(today = new Date()): Promise<number> {
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).toISOString();
  const { data } = await db().from("ingest_runs").select("bytes_processed").eq("source", "bigquery").gte("started_at", monthStart);
  return (data ?? []).reduce((s: number, r: any) => s + Number(r.bytes_processed ?? 0), 0);
}

/**
 * Live BigQuery ingest through the REST API. Dry-run first; refuses to run above the per-query cap
 * or when the run would push the month past the free tier without a logged decision.
 */
export async function ingestBigQuery(opts: { mode: BigQueryMode; dryRun?: boolean; today?: Date } ): Promise<BigQueryIngestResult> {
  const today = opts.today ?? new Date();
  const w = bigQueryWindow(opts.mode, today);
  const params = { window_start: { type: "DATE" as const, value: w.from }, window_end: { type: "DATE" as const, value: w.to } };
  const sql = nicheSql();
  const est = await runQuery(sql, params, { dryRun: true });
  const monthBytes = await bigQueryBytesThisMonth(today);
  const base: BigQueryIngestResult = { mode: opts.mode, ...w, bytes: est.totalBytesProcessed, monthBytes, dryRun: true, rows: 0, onTopic: 0, inserted: 0, families: 0 };
  log.info("bigquery dry run", { mode: opts.mode, ...w, gb: +(est.totalBytesProcessed / 1e9).toFixed(1), monthGb: +(monthBytes / 1e9).toFixed(1) });
  if (est.totalBytesProcessed > BQ_MAX_BYTES_BILLED) throw new Error(`BigQuery dry run estimates ${(est.totalBytesProcessed / 1e9).toFixed(0)} GB > cap ${(BQ_MAX_BYTES_BILLED / 1e9).toFixed(0)} GB (ADR 0009); not run`);
  if (monthBytes + est.totalBytesProcessed > BQ_FREE_TIER_BYTES) throw new Error(`BigQuery run would exceed the 1 TB monthly free tier (${((monthBytes + est.totalBytesProcessed) / 1e9).toFixed(0)} GB); needs a spend_approvals row first (CLAUDE.md rule 3)`);
  if (opts.dryRun) return base;

  const { data: run } = await db().from("ingest_runs").insert({ source: "bigquery", mode: opts.mode, window_start: w.from, window_end: w.to }).select("id").single();
  try {
    const res = await runQuery(sql, params, { maximumBytesBilled: BQ_MAX_BYTES_BILLED });
    const pubs = res.rows.map(mapBigQueryRow).filter((p): p is Publication => !!p);
    const inserted = await upsertPublications(pubs);
    const families = await rebuildFamilies(pubs);
    await db().from("ingest_runs").update({ status: "succeeded", fetched: res.rows.length, inserted, bytes_processed: res.totalBytesProcessed, finished_at: new Date().toISOString() }).eq("id", run!.id);
    await audit("production", "ingest_bigquery", "ingest_runs", run!.id, { mode: opts.mode, ...w, rows: res.rows.length, onTopic: pubs.length, inserted, families, bytes: res.totalBytesProcessed, jobId: res.jobId });
    const out = { ...base, dryRun: false, bytes: res.totalBytesProcessed, rows: res.rows.length, onTopic: pubs.length, inserted, families };
    log.info("bigquery ingest ok", out);
    if (opts.mode === "backfill") await notifyFounder(`🗄️ BigQuery ${opts.mode} loaded (${w.from}..${w.to}): ${res.rows.length} candidates → ${pubs.length} on-topic, ${inserted} new publications, ${families} families. ${(res.totalBytesProcessed / 1e9).toFixed(0)} GB processed (month total ${((monthBytes + res.totalBytesProcessed) / 1e9).toFixed(0)} GB of 1000 free).`);
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
