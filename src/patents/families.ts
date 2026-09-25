import type { Publication } from "./types.js";
import { bucketFor } from "./query.js";

export interface FamilyGroup {
  family_id: string;
  members: Publication[];
  representative: Publication;
  earliest_priority_date: string | null;
  offices: string[];
  technology_bucket: string;
}

/**
 * Group publications by DOCDB family id. Records with no family id fall back to a synthetic
 * key based on application number, then publication number, so nothing is silently dropped.
 * Representative preference: English-language US/EP/WO grant > any grant > earliest publication.
 */
export function groupFamilies(pubs: Publication[]): FamilyGroup[] {
  const map = new Map<string, Publication[]>();
  for (const p of pubs) {
    const key = p.family_id ?? (p.application_number ? `APP:${p.application_number}` : `PUB:${p.publication_number}`);
    const list = map.get(key) ?? [];
    if (!list.some((x) => x.publication_number === p.publication_number)) list.push(p);
    map.set(key, list);
  }
  const groups: FamilyGroup[] = [];
  for (const [family_id, members] of map) {
    const rep = pickRepresentative(members);
    const prio = members.map((m) => m.priority_date ?? m.filing_date).filter((d): d is string => !!d).sort()[0] ?? null;
    const offices = [...new Set(members.map((m) => m.country_code))].sort();
    const terms = [...new Set(members.flatMap((m) => m.matched_terms))];
    const cpcs = [...new Set(members.flatMap((m) => m.cpc_codes))];
    groups.push({ family_id, members, representative: rep, earliest_priority_date: prio, offices, technology_bucket: bucketFor(terms, cpcs) });
  }
  return groups.sort((a, b) => (b.representative.publication_date > a.representative.publication_date ? 1 : -1));
}

export function pickRepresentative(members: Publication[]): Publication {
  const score = (p: Publication) => {
    let s = 0;
    if (["US", "EP", "WO"].includes(p.country_code)) s += 4;
    if (p.kind_code?.startsWith("B")) s += 2;
    if (p.title && /[a-z]/i.test(p.title)) s += 1;
    return s;
  };
  return [...members].sort((a, b) => score(b) - score(a) || (a.publication_date < b.publication_date ? -1 : 1))[0]!;
}
