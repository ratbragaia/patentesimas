import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { config } from "../lib/config.js";
import { fetchPatentsViewGrants } from "./patentsview.js";
import { fetchOpsPublications, lookupFamilyId } from "./epo-ops.js";
import { fetchBigQueryPublications, BQ_LOOKBACK_DAYS } from "./bigquery.js";
import { groupFamilies } from "./families.js";
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

async function runSource(source: "patentsview" | "epo_ops" | "bigquery", fetcher: (w: IngestWindow) => Promise<Publication[]>, lookbackDays = 21) {
  const w = await computeWindow(source, new Date(), lookbackDays);
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
    try { all.push(...(await runSource("bigquery", (w) => fetchBigQueryPublications(w.from, w.to), BQ_LOOKBACK_DAYS))); }
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

export async function rebuildFamilies(pubs: Publication[]): Promise<void> {
  const groups = groupFamilies(pubs);
  for (const g of groups) {
    await db().from("patent_families").upsert({
      family_id: g.family_id,
      representative_publication: g.representative.publication_number,
      earliest_priority_date: g.earliest_priority_date,
      offices: g.offices,
      technology_bucket: g.technology_bucket,
    }, { onConflict: "family_id", ignoreDuplicates: false });
  }
  log.info("families rebuilt", { families: groups.length });
}
