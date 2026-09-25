/**
 * USPTO PatentsView PatentSearch API (v1). Docs: https://search.patentsview.org/docs/
 * Auth: header X-Api-Key. Query: POST JSON {q, f, s, o}. Pagination via o.size + o.after cursor.
 * Endpoints used: /api/v1/patent/ (grants) and /api/v1/publication/ (pre-grant applications).
 */
import { require } from "../lib/config.js";
import { httpJson } from "../lib/http.js";
import { normalizePublicationNumber, normalizeCpc, toIsoDate } from "./normalize.js";
import { NICHE, classify } from "./query.js";
import type { Publication } from "./types.js";

const BASE = "https://search.patentsview.org/api/v1";

export function buildPatentsViewQuery(from: string, to: string, dateField: string) {
  const textOr = NICHE.keywords.slice(0, 40).flatMap((k) => [
    { _text_phrase: { patent_title: k } },
    { _text_phrase: { patent_abstract: k } },
  ]);
  return {
    _and: [
      { _gte: { [dateField]: from } },
      { _lte: { [dateField]: to } },
      { _or: [...textOr, ...NICHE.cpcInclude.map((c) => ({ _begins: { "cpc_current.cpc_group_id": c } }))] },
    ],
  };
}

interface PvPatent {
  patent_id: string; patent_title: string; patent_abstract: string; patent_date: string; patent_type?: string;
  application?: { application_id?: string; filing_date?: string }[];
  assignees?: { assignee_organization?: string; assignee_individual_name_last_name?: string }[];
  inventors?: { inventor_name_first?: string; inventor_name_last?: string }[];
  cpc_current?: { cpc_group_id: string }[];
  wipo_kind?: string;
}
interface PvResponse { error: boolean; count: number; total_hits: number; patents?: PvPatent[]; publications?: PvPatent[] }

async function page<T extends PvResponse>(endpoint: string, body: unknown): Promise<T> {
  return httpJson<T>(`${BASE}/${endpoint}/`, {
    method: "POST",
    headers: { "X-Api-Key": require("PATENTSVIEW_API_KEY"), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

/** Fetch US grants published in [from, to]. Yields only on-topic records. */
export async function fetchPatentsViewGrants(from: string, to: string): Promise<Publication[]> {
  const out: Publication[] = [];
  let after: string | undefined;
  const fields = ["patent_id", "patent_title", "patent_abstract", "patent_date", "patent_type", "wipo_kind",
    "application.application_id", "application.filing_date", "assignees.assignee_organization",
    "inventors.inventor_name_first", "inventors.inventor_name_last", "cpc_current.cpc_group_id"];
  for (;;) {
    const res = await page<PvResponse>("patent", {
      q: buildPatentsViewQuery(from, to, "patent_date"), f: fields,
      s: [{ patent_id: "asc" }], o: { size: 1000, ...(after ? { after } : {}) },
    });
    const rows = res.patents ?? [];
    for (const p of rows) {
      const pub = toPublication(p, "US", p.wipo_kind ?? "B2");
      if (pub) out.push(pub);
    }
    if (rows.length < 1000) break;
    after = rows[rows.length - 1]!.patent_id;
  }
  return out;
}

function toPublication(p: PvPatent, cc: string, kind: string): Publication | null {
  const cpcs = (p.cpc_current ?? []).map((c) => normalizeCpc(c.cpc_group_id));
  const matched = classify({ title: p.patent_title, abstract: p.patent_abstract, cpc_codes: cpcs });
  if (!matched) return null;
  return {
    publication_number: normalizePublicationNumber(p.patent_id, cc, kind),
    country_code: cc,
    kind_code: kind,
    family_id: null, // PatentsView has no DOCDB family; filled later by EPO OPS family lookup
    title: p.patent_title ?? null,
    abstract: p.patent_abstract ?? null,
    applicants: (p.assignees ?? []).map((a) => a.assignee_organization ?? a.assignee_individual_name_last_name ?? "").filter(Boolean),
    inventors: (p.inventors ?? []).map((i) => `${i.inventor_name_first ?? ""} ${i.inventor_name_last ?? ""}`.trim()).filter(Boolean),
    cpc_codes: cpcs,
    priority_date: null,
    filing_date: toIsoDate(p.application?.[0]?.filing_date),
    publication_date: toIsoDate(p.patent_date)!,
    grant_date: toIsoDate(p.patent_date),
    application_number: p.application?.[0]?.application_id ?? null,
    source: "patentsview",
    source_payload: p,
    matched_terms: matched,
  };
}
