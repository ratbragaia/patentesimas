/**
 * EPO Open Patent Services 3.2. Docs: https://www.epo.org/en/searching-for-patents/data/web-services/ops
 * Auth: OAuth2 client credentials -> POST /3.2/auth/accesstoken with Basic base64(key:secret).
 * Used for: worldwide bibliographic search (CQL), and DOCDB family lookup to deduplicate.
 */
import { require } from "../lib/config.js";
import { http, httpJson } from "../lib/http.js";
import { normalizePublicationNumber, normalizeCpc, toIsoDate } from "./normalize.js";
import { NICHE, classify } from "./query.js";
import type { Publication } from "./types.js";

const BASE = "https://ops.epo.org/3.2";
let token: { value: string; exp: number } | undefined;

async function accessToken(): Promise<string> {
  if (token && token.exp > Date.now() + 30_000) return token.value;
  const creds = Buffer.from(`${require("EPO_OPS_CONSUMER_KEY")}:${require("EPO_OPS_CONSUMER_SECRET")}`).toString("base64");
  const res = await httpJson<{ access_token: string; expires_in: string }>(`${BASE}/auth/accesstoken`, {
    method: "POST",
    headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  token = { value: res.access_token, exp: Date.now() + Number(res.expires_in) * 1000 };
  return token.value;
}

async function ops<T>(path: string, accept = "application/json"): Promise<T> {
  const res = await http(`${BASE}${path}`, { headers: { Authorization: `Bearer ${await accessToken()}`, Accept: accept } });
  if (res.status === 404) return {} as T; // OPS returns 404 for "no results"
  if (!res.ok) throw new Error(`OPS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** CQL for the niche. pd = publication date. ti/ab = title/abstract. cpc = classification. */
export function buildOpsCql(from: string, to: string): string {
  const kw = NICHE.keywords.slice(0, 25).map((k) => `"${k.replace(/"/g, "")}"`).join(" or ");
  const cpc = NICHE.cpcInclude.map((c) => `cpc=${c.replace("/", "/")}`).join(" or ");
  return `pd within "${from.replace(/-/g, "")} ${to.replace(/-/g, "")}" and ((ti=(${kw}) or ab=(${kw})) or (${cpc}))`;
}

// OPS JSON is deeply nested with "$" text nodes; helpers keep it readable.
const txt = (n: unknown): string | null => {
  if (n == null) return null;
  if (typeof n === "string") return n;
  if (Array.isArray(n)) return txt(n[0]);
  if (typeof n === "object" && "$" in (n as Record<string, unknown>)) return String((n as Record<string, unknown>)["$"]);
  return null;
};
const arr = <T>(n: T | T[] | undefined): T[] => (n == null ? [] : Array.isArray(n) ? n : [n]);

export async function fetchOpsPublications(from: string, to: string): Promise<Publication[]> {
  const out: Publication[] = [];
  const cql = encodeURIComponent(buildOpsCql(from, to));
  for (let start = 1; start <= 2000; start += 100) {
    const range = `${start}-${Math.min(start + 99, 2000)}`;
    const res = await ops<any>(`/rest-services/published-data/search/biblio?q=${cql}&Range=${range}`);
    const docs = arr<any>(res?.["ops:world-patent-data"]?.["ops:biblio-search"]?.["ops:search-result"]?.["exchange-documents"])
      .flatMap((e: any) => arr<any>(e?.["exchange-document"]));
    for (const d of docs) {
      const pub = opsToPublication(d);
      if (pub) out.push(pub);
    }
    if (docs.length < 100) break;
  }
  return out;
}

function opsToPublication(d: any): Publication | null {
  const cc = String(d["@country"]); const num = String(d["@doc-number"]); const kind = String(d["@kind"]);
  const family = d["@family-id"] ? String(d["@family-id"]) : null;
  const bib = d["bibliographic-data"] ?? {};
  const titles = arr<any>(bib["invention-title"]);
  const title = txt(titles.find((t) => t["@lang"] === "en")) ?? txt(titles[0]);
  const abstracts = arr<any>(d["abstract"]);
  const abstract = txt(abstracts.find((a) => a["@lang"] === "en")?.p) ?? txt(abstracts[0]?.p);
  const cpcs = arr<any>(bib["patent-classifications"]?.["patent-classification"])
    .filter((c) => txt(c["classification-scheme"]?.["@scheme"]) === "CPCI" || c["classification-scheme"]?.["@scheme"] === "CPCI")
    .map((c) => normalizeCpc(`${txt(c.section)}${txt(c.class)}${txt(c.subclass)}${txt(c["main-group"])}/${txt(c.subgroup)}`));
  const matched = classify({ title, abstract, cpc_codes: cpcs });
  if (!matched) return null;
  const pubDate = arr<any>(bib["publication-reference"]?.["document-id"]).map((x) => txt(x.date)).find(Boolean);
  const appRef = arr<any>(bib["application-reference"]?.["document-id"]).find((x) => x["@document-id-type"] === "docdb");
  const prio = arr<any>(bib["priority-claims"]?.["priority-claim"]).map((p) => txt(p.date)).filter(Boolean).sort()[0];
  const parties = bib.parties ?? {};
  return {
    publication_number: normalizePublicationNumber(`${cc}${num}${kind}`),
    country_code: cc, kind_code: kind, family_id: family, title, abstract,
    applicants: arr<any>(parties.applicants?.applicant).filter((a) => a["@data-format"] === "epodoc").map((a) => txt(a["applicant-name"]?.name) ?? "").filter(Boolean),
    inventors: arr<any>(parties.inventors?.inventor).filter((a) => a["@data-format"] === "epodoc").map((a) => txt(a["inventor-name"]?.name) ?? "").filter(Boolean),
    cpc_codes: cpcs,
    priority_date: toIsoDate(prio), filing_date: toIsoDate(txt(appRef?.date)),
    publication_date: toIsoDate(pubDate) ?? "",
    grant_date: kind.startsWith("B") ? toIsoDate(pubDate) : null,
    application_number: appRef ? `${txt(appRef.country)}${txt(appRef["doc-number"])}` : null,
    source: "epo_ops", source_payload: d, matched_terms: matched,
  };
}

/** DOCDB family lookup for a publication known only by number (e.g. from PatentsView). */
export async function lookupFamilyId(publicationNumber: string): Promise<string | null> {
  const epodoc = publicationNumber.replace(/-/g, "");
  const res = await ops<any>(`/rest-services/family/publication/epodoc/${epodoc}`);
  const members = arr<any>(res?.["ops:world-patent-data"]?.["ops:patent-family"]?.["ops:family-member"]);
  const fam = members[0]?.["@family-id"];
  return fam ? String(fam) : null;
}
