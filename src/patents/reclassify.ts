/**
 * Re-apply the current niche classifier to everything already stored. Classifier fixes (ADR 0011: token
 * matching) must reach the rows loaded before the fix, or the landscape counts keep the noise. Dry-run by
 * default; `apply` deletes off-topic publications and empty families, then rebuilds families for the rest.
 * Analyst decisions survive: rebuildFamilies never touches triage_status or analyst_summary, and a family
 * an analyst marked `include` is kept even if the classifier now disagrees.
 */
import { db, audit } from "../lib/db.js";
import { log } from "../lib/log.js";
import { classify } from "./query.js";
import { rebuildFamilies } from "./ingest.js";
import type { Publication } from "./types.js";

export interface ReclassifyResult { scanned: number; kept: number; dropped: number; protectedByAnalyst: number; familiesDeleted: number; familiesRebuilt: number; applied: boolean; sample: string[] }

export function decide(pubs: Publication[], includeFamilies: Set<string>): { keep: Publication[]; drop: Publication[]; protectedByAnalyst: number } {
  const keep: Publication[] = []; const drop: Publication[] = []; let protectedByAnalyst = 0;
  for (const p of pubs) {
    const terms = classify({ title: p.title, abstract: p.abstract, cpc_codes: p.cpc_codes });
    if (terms) { keep.push({ ...p, matched_terms: terms }); continue; }
    if (p.family_id && includeFamilies.has(p.family_id)) { protectedByAnalyst++; keep.push(p); continue; }
    drop.push(p);
  }
  return { keep, drop, protectedByAnalyst };
}

export async function reclassifyStored(apply: boolean): Promise<ReclassifyResult> {
  const pubs: Publication[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("patent_publications").select("publication_number,country_code,kind_code,family_id,title,abstract,applicants,inventors,cpc_codes,priority_date,filing_date,publication_date,grant_date,application_number,source,matched_terms").order("publication_number").range(from, from + 999);
    if (error) throw new Error(error.message);
    pubs.push(...((data ?? []) as Publication[])); if (!data || data.length < 1000) break;
  }
  const { data: fams, error: fe } = await db().from("patent_families").select("family_id,triage_status").eq("triage_status", "include");
  if (fe) throw new Error(fe.message);
  const includeFamilies = new Set((fams ?? []).map((f: any) => f.family_id as string));
  const { keep, drop, protectedByAnalyst } = decide(pubs, includeFamilies);
  const result: ReclassifyResult = { scanned: pubs.length, kept: keep.length, dropped: drop.length, protectedByAnalyst, familiesDeleted: 0, familiesRebuilt: 0, applied: false,
    sample: drop.slice(0, 15).map((p) => `${p.publication_number} ${p.title ?? ""}`.slice(0, 120)) };
  log.info("reclassify", { ...result, sample: undefined });
  if (!apply || drop.length === 0) return result;

  // Families that lose every member go; families that keep members are re-pointed by rebuildFamilies.
  const keptFamilies = new Set(keep.map((p) => p.family_id ?? `PUB:${p.publication_number}`));
  const familyKey = (p: Publication) => p.family_id ?? (p.application_number ? `APP:${p.application_number}` : `PUB:${p.publication_number}`);
  const goneFamilies = [...new Set(drop.map(familyKey))].filter((k) => !keptFamilies.has(k));
  for (let i = 0; i < goneFamilies.length; i += 200) {
    const { error } = await db().from("patent_families").delete().in("family_id", goneFamilies.slice(i, i + 200));
    if (error) throw new Error(`delete families: ${error.message}`);
  }
  // Representative pointers to dropped publications must move before the rows can go (FK).
  const dropNumbers = drop.map((p) => p.publication_number);
  for (let i = 0; i < dropNumbers.length; i += 200) {
    const { error } = await db().from("patent_families").update({ representative_publication: null }).in("representative_publication", dropNumbers.slice(i, i + 200));
    if (error) throw new Error(`unlink representatives: ${error.message}`);
  }
  for (let i = 0; i < dropNumbers.length; i += 200) {
    const { error } = await db().from("patent_publications").delete().in("publication_number", dropNumbers.slice(i, i + 200));
    if (error) throw new Error(`delete publications: ${error.message}`);
  }
  const familiesRebuilt = await rebuildFamilies(keep);
  await audit("production", "reclassify_applied", "patent_publications", undefined, { ...result, applied: true, familiesDeleted: goneFamilies.length, familiesRebuilt });
  return { ...result, applied: true, familiesDeleted: goneFamilies.length, familiesRebuilt };
}
