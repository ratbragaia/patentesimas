/**
 * Monthly landscape report (kind = monthly_report): filing activity by office, technology bucket
 * and applicant, quarter-on-quarter movement, and the families published in the month. Every
 * number is an aggregate of ps.patent_publications / ps.patent_families (loaded from BigQuery,
 * ADR 0009/0011); every publication number, date and applicant printed comes from those rows, so
 * the same QA gate as the weekly issue applies (CLAUDE.md rule 1).
 */
import { db, audit } from "../lib/db.js";
import { runQa } from "./qa.js";
import { renderIssueHtml, STREAM_NAME } from "./newsletter.js";
import { notifyFounder } from "../reporting/telegram.js";

export interface LandscapePub {
  publication_number: string; country_code: string; kind_code: string | null; family_id: string | null; title: string | null;
  applicants: string[]; publication_date: string; priority_date: string | null; source: string;
}
export interface LandscapeFamily {
  family_id: string; representative_publication: string | null; earliest_priority_date: string | null; offices: string[];
  technology_bucket: string | null; triage_status: string; analyst_summary: string | null;
}

export const BUCKET_LABEL: Record<string, string> = {
  iron_nitride: "Iron nitride (Fe16N2)", mnbi: "Mn–Bi", mnal: "Mn–Al–C", feni_l10: "L10 FeNi / tetrataenite",
  ferrite: "Advanced ferrites", re_lean: "Rare-earth-lean designs", motor_topology: "RE-free motor topologies", other: "Other",
};
const OFFICE_LABEL: Record<string, string> = { US: "USPTO", EP: "EPO", WO: "WIPO (PCT)", CN: "CNIPA", JP: "JPO", KR: "KIPO", DE: "DPMA", TW: "TIPO" };

// ---------- date helpers ----------
export function previousMonth(today: Date): string {
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  return d.toISOString().slice(0, 7);
}
export function monthBounds(ym: string): { start: string; end: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(ym); if (!m) throw new Error(`month must be YYYY-MM, got ${ym}`);
  const y = Number(m[1]), mo = Number(m[2]);
  const start = new Date(Date.UTC(y, mo - 1, 1)); const end = new Date(Date.UTC(y, mo, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export function monthLabel(ym: string): string {
  const { start } = monthBounds(ym);
  return new Date(start + "T00:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}
function shiftMonths(ym: string, n: number): string {
  const { start } = monthBounds(ym); const d = new Date(start + "T00:00:00Z");
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)).toISOString().slice(0, 7);
}
export function quarterOf(date: string): string { return `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`; }
function quarterBounds(q: string): { start: string; end: string } {
  const y = Number(q.slice(0, 4)), n = Number(q.slice(6));
  return { start: new Date(Date.UTC(y, (n - 1) * 3, 1)).toISOString().slice(0, 10), end: new Date(Date.UTC(y, n * 3, 0)).toISOString().slice(0, 10) };
}
function previousQuarter(q: string): string { const y = Number(q.slice(0, 4)), n = Number(q.slice(6)); return n === 1 ? `${y - 1}-Q4` : `${y}-Q${n - 1}`; }

// ---------- statistics ----------
export interface Counted { key: string; label: string; current: number; previous: number }
export interface LandscapeStats {
  month: string; start: string; end: string;
  monthPubs: number; monthFamilies: number; monthOffices: string[];
  window12: { start: string; end: string }; prev12: { start: string; end: string };
  families12: number; familiesPrev12: number;
  byOffice: Counted[]; byBucket: Counted[]; topApplicants: Counted[];
  quarters: { quarter: string; families: number; publications: number; partial: boolean }[];
  lastQuarter: { quarter: string; families: number; previousQuarter: string; previousFamilies: number; complete: boolean };
  freshness: { office: string; through: string }[];
  monthFamilyRows: { family: LandscapeFamily; pub: LandscapePub }[];
  coverageStart: string | null; totalPubs: number; totalFamilies: number;
}

function familyKey(p: LandscapePub): string { return p.family_id ?? `PUB:${p.publication_number}`; }

/** Pure aggregation over the rows, so it can be unit-tested with fixtures. */
export function computeLandscape(allPubs: LandscapePub[], fams: LandscapeFamily[], month: string): LandscapeStats {
  const { start, end } = monthBounds(month);
  const famById = new Map(fams.map((f) => [f.family_id, f]));
  // Analyst triage is authoritative: a family marked `exclude` leaves every count, not just the listing.
  const pubs = allPubs.filter((p) => famById.get(p.family_id ?? `PUB:${p.publication_number}`)?.triage_status !== "exclude");
  const pubByNumber = new Map(pubs.map((p) => [p.publication_number, p]));
  // First publication date per family: a family counts in the period where it first published.
  const firstPub = new Map<string, LandscapePub>();
  for (const p of [...pubs].sort((a, b) => a.publication_date.localeCompare(b.publication_date))) {
    const k = familyKey(p); if (!firstPub.has(k)) firstPub.set(k, p);
  }
  const inRange = (d: string, a: string, b: string) => d >= a && d <= b;
  const famsIn = (a: string, b: string) => [...firstPub.entries()].filter(([, p]) => inRange(p.publication_date, a, b));

  const window12 = { start: monthBounds(shiftMonths(month, -11)).start, end };
  const prev12 = { start: monthBounds(shiftMonths(month, -23)).start, end: monthBounds(shiftMonths(month, -12)).end };
  const cur = famsIn(window12.start, window12.end); const prev = famsIn(prev12.start, prev12.end);

  const count = (list: [string, LandscapePub][], keyOf: (k: string, p: LandscapePub) => string[]) => {
    const m = new Map<string, number>();
    for (const [k, p] of list) for (const key of new Set(keyOf(k, p))) m.set(key, (m.get(key) ?? 0) + 1);
    return m;
  };
  const merge = (label: (k: string) => string, a: Map<string, number>, b: Map<string, number>, limit?: number): Counted[] => {
    const keys = [...new Set([...a.keys(), ...b.keys()])];
    const rows = keys.map((key) => ({ key, label: label(key), current: a.get(key) ?? 0, previous: b.get(key) ?? 0 }))
      .sort((x, y) => y.current - x.current || y.previous - x.previous || x.label.localeCompare(y.label));
    return limit ? rows.filter((r) => r.current > 0).slice(0, limit) : rows;
  };
  const officesOf = (k: string) => pubs.filter((p) => familyKey(p) === k).map((p) => p.country_code);
  const bucketOf = (k: string) => [famById.get(k)?.technology_bucket ?? "other"];
  const applicantsOf = (k: string) => pubs.filter((p) => familyKey(p) === k).flatMap((p) => p.applicants).map((a) => a.trim()).filter(Boolean);

  const byOffice = merge((k) => OFFICE_LABEL[k] ? `${OFFICE_LABEL[k]} (${k})` : k, count(cur, officesOf), count(prev, officesOf));
  const byBucket = merge((k) => BUCKET_LABEL[k] ?? k, count(cur, bucketOf), count(prev, bucketOf));
  const topApplicants = merge((k) => k, count(cur, applicantsOf), count(prev, applicantsOf), 15);

  const lastQ = quarterOf(end); const quarters: LandscapeStats["quarters"] = [];
  let q = lastQ;
  for (let i = 0; i < 8; i++) {
    const qb = quarterBounds(q);
    quarters.unshift({ quarter: q, families: famsIn(qb.start, qb.end).length, publications: pubs.filter((p) => inRange(p.publication_date, qb.start, qb.end)).length, partial: qb.end > end });
    q = previousQuarter(q);
  }
  const lq = quarters[quarters.length - 1]!; const pq = quarters[quarters.length - 2]!;

  const freshness = [...new Set(pubs.map((p) => p.country_code))].map((office) => ({ office, through: pubs.filter((p) => p.country_code === office).map((p) => p.publication_date).sort().at(-1)! })).sort((a, b) => a.office.localeCompare(b.office));

  const monthPubsList = pubs.filter((p) => inRange(p.publication_date, start, end));
  const monthFamKeys = famsIn(start, end).map(([k]) => k);
  const monthFamilyRows = monthFamKeys.map((k) => {
    const fam = famById.get(k) ?? { family_id: k, representative_publication: firstPub.get(k)!.publication_number, earliest_priority_date: firstPub.get(k)!.priority_date, offices: officesOf(k), technology_bucket: "other", triage_status: "new", analyst_summary: null };
    const pub = (fam.representative_publication && pubByNumber.get(fam.representative_publication)) || firstPub.get(k)!;
    return { family: fam, pub };
  }).sort((a, b) => (a.family.technology_bucket ?? "other").localeCompare(b.family.technology_bucket ?? "other") || a.pub.publication_date.localeCompare(b.pub.publication_date));

  return {
    month, start, end, monthPubs: monthPubsList.length, monthFamilies: monthFamKeys.length, monthOffices: [...new Set(monthPubsList.map((p) => p.country_code))].sort(),
    window12, prev12, families12: cur.length, familiesPrev12: prev.length, byOffice, byBucket, topApplicants, quarters,
    lastQuarter: { quarter: lq.quarter, families: lq.families, previousQuarter: pq.quarter, previousFamilies: pq.families, complete: !lq.partial },
    freshness, monthFamilyRows, coverageStart: pubs.map((p) => p.publication_date).sort()[0] ?? null, totalPubs: pubs.length, totalFamilies: firstPub.size,
  };
}

// ---------- rendering ----------
const delta = (c: number, p: number) => (p === 0 ? (c === 0 ? "—" : "new") : `${c >= p ? "+" : ""}${Math.round(((c - p) / p) * 100)}%`);
const esc = (s: string) => s.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

export function renderLandscapeMarkdown(s: LandscapeStats): string {
  const L: string[] = [];
  const label = monthLabel(s.month);
  L.push(`# PatentSonar · ${STREAM_NAME} — Landscape Report, ${label}`);
  L.push(`Coverage: publications dated ${s.start} to ${s.end}, with trends over the trailing twelve months (${s.window12.start} to ${s.window12.end}). Data in this edition span ${s.coverageStart ?? "n/a"} to ${s.end}: ${s.totalPubs} publications in ${s.totalFamilies} patent families within the published scope.`);
  L.push("");
  L.push("## Summary");
  L.push(`- ${label}: ${s.monthFamilies} new patent ${s.monthFamilies === 1 ? "family" : "families"} (${s.monthPubs} publications) across ${s.monthOffices.length} ${s.monthOffices.length === 1 ? "office" : "offices"}${s.monthOffices.length ? ` (${s.monthOffices.join(", ")})` : ""}.`);
  L.push(`- Trailing twelve months: ${s.families12} families, versus ${s.familiesPrev12} in the twelve months before (${delta(s.families12, s.familiesPrev12)}).`);
  L.push(`- ${s.lastQuarter.quarter}${s.lastQuarter.complete ? "" : " (quarter to date)"}: ${s.lastQuarter.families} families, versus ${s.lastQuarter.previousFamilies} in ${s.lastQuarter.previousQuarter} (${delta(s.lastQuarter.families, s.lastQuarter.previousFamilies)}).`);
  if (s.byBucket[0]?.current) L.push(`- Most active technology bucket over twelve months: ${s.byBucket[0].label} (${s.byBucket[0].current} families).`);
  if (s.topApplicants[0]?.current) L.push(`- Most active applicant over twelve months: ${s.topApplicants[0].label} (${s.topApplicants[0].current} families).`);
  L.push("");
  L.push("## Filing activity by quarter");
  L.push("Families are counted in the quarter of their first publication; publications count every office member. Quarters marked * are incomplete because the dataset lags publication (see Data notes).");
  L.push("");
  L.push("| Quarter | New families | Publications |"); L.push("|---|---:|---:|");
  for (const q of s.quarters) L.push(`| ${q.quarter}${q.partial ? "*" : ""} | ${q.families} | ${q.publications} |`);
  L.push("");
  L.push("## By office (trailing twelve months)");
  L.push("A family is counted once per office in which a member has published, so rows can add up to more than the family total.");
  L.push("");
  L.push("| Office | Families | Previous 12 months | Change |"); L.push("|---|---:|---:|---:|");
  for (const r of s.byOffice) L.push(`| ${esc(r.label)} | ${r.current} | ${r.previous} | ${delta(r.current, r.previous)} |`);
  L.push("");
  L.push("## By technology bucket (trailing twelve months)");
  L.push("");
  L.push("| Technology | Families | Previous 12 months | Change |"); L.push("|---|---:|---:|---:|");
  for (const r of s.byBucket) L.push(`| ${esc(r.label)} | ${r.current} | ${r.previous} | ${delta(r.current, r.previous)} |`);
  L.push("");
  L.push("## Most active applicants (trailing twelve months)");
  L.push("Applicant names are the harmonised assignee names in the source record; subsidiaries are not merged. A family with several applicants counts once for each.");
  L.push("");
  if (s.topApplicants.length) {
    L.push("| Applicant | Families | Previous 12 months | Change |"); L.push("|---|---:|---:|---:|");
    for (const r of s.topApplicants) L.push(`| ${esc(r.label)} | ${r.current} | ${r.previous} | ${delta(r.current, r.previous)} |`);
  } else L.push("No applicant names recorded in the period.");
  L.push("");
  L.push(`## Families first published in ${label}`);
  L.push("One row per family, representative publication shown. Families our analysts have reviewed carry a note; the rest are listed as recorded and will be covered in the weekly briefing.");
  L.push("");
  if (s.monthFamilyRows.length === 0) L.push("No families in scope were first published this month.");
  let bucket = "";
  for (const { family, pub } of s.monthFamilyRows) {
    const b = family.technology_bucket ?? "other";
    if (b !== bucket) { bucket = b; L.push(`### ${BUCKET_LABEL[b] ?? b}`); L.push(""); }
    L.push(`**${esc(pub.title ?? "(untitled)")}**`);
    L.push(`${pub.publication_number} · published ${pub.publication_date} · ${pub.applicants.map(esc).join("; ") || "applicant not recorded"} · offices: ${family.offices.join(", ") || pub.country_code}`);
    if (family.analyst_summary?.trim()) L.push(family.analyst_summary.trim());
    L.push("");
  }
  L.push("## Data notes");
  L.push(`- Scope: the published CPC and keyword definition for ${STREAM_NAME.toLowerCase()} (methodology page on the website), applied to Google Patents Public Data and deduplicated by DOCDB family.`);
  L.push("- Latest publication date present per office in this edition's data: " + (s.freshness.map((f) => `${f.office} ${f.through}`).join(", ") || "n/a") + ". Offices whose latest date falls before the end of the period are under-counted for the last weeks; those figures are revised in the next edition.");
  L.push("- Japanese and German filings without English titles or abstracts in the source dataset are not yet in scope; coverage of those offices improves when the EPO source is live.");
  L.push("- Counts are of patent families and publications, not of granted rights; legal status is not assessed here.");
  L.push("");
  L.push("---");
  L.push("Data: Google Patents Public Data by IFI CLAIMS Patent Services and Google (CC BY 4.0); EPO Open Patent Services bibliographic data where present. Numbers link to the official record. This report is information, not legal advice.");
  return L.join("\n");
}

// ---------- persistence ----------
export async function loadLandscapeRows(): Promise<{ pubs: LandscapePub[]; fams: LandscapeFamily[] }> {
  const pubs: LandscapePub[] = []; const fams: LandscapeFamily[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("patent_publications").select("publication_number,country_code,kind_code,family_id,title,applicants,publication_date,priority_date,source").order("publication_number").range(from, from + 999);
    if (error) throw new Error(error.message);
    pubs.push(...((data ?? []) as LandscapePub[])); if (!data || data.length < 1000) break;
  }
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db().from("patent_families").select("family_id,representative_publication,earliest_priority_date,offices,technology_bucket,triage_status,analyst_summary").order("family_id").range(from, from + 999);
    if (error) throw new Error(error.message);
    fams.push(...((data ?? []) as LandscapeFamily[])); if (!data || data.length < 1000) break;
  }
  return { pubs, fams };
}

/** Monthly reports live in ps.issues with issue_number = YYYYMM, far from the weekly sequence and idempotent per month. */
export function monthlyIssueNumber(month: string): number { return Number(month.replace("-", "")); }

export async function previewMonthlyReport(month: string): Promise<string> {
  const { pubs, fams } = await loadLandscapeRows();
  return renderLandscapeMarkdown(computeLandscape(pubs, fams, month));
}

export async function buildMonthlyReport(month: string): Promise<{ issueNumber: number; qaPassed: boolean; families: number; markdown: string }> {
  const { pubs, fams } = await loadLandscapeRows();
  const stats = computeLandscape(pubs, fams, month);
  const markdown = renderLandscapeMarkdown(stats);
  const qa = runQa(markdown, pubs); // same rows the report was computed from
  const issueNumber = monthlyIssueNumber(month);
  const html = renderIssueHtml(markdown, "{{UNSUBSCRIBE_URL}}");
  const { error } = await db().from("issues").upsert({
    issue_number: issueNumber, kind: "monthly_report", title: `PatentSonar · ${STREAM_NAME} — Landscape Report, ${monthLabel(month)}`,
    period_start: stats.start, period_end: stats.end, markdown, html,
    family_ids: stats.monthFamilyRows.map((r) => r.family.family_id), qa_passed: qa.passed, qa_report: qa,
    status: qa.passed ? "ready" : "qa_failed",
  }, { onConflict: "issue_number" });
  if (error) throw new Error(`issues upsert: ${error.message}`);
  await audit("production", "monthly_report_built", "issues", String(issueNumber), { month, qa, families: stats.monthFamilies });
  if (!qa.passed) await notifyFounder(`❌ Landscape report ${monthLabel(month)} failed QA: ${qa.unknown.length} unknown numbers, ${qa.dateMismatches.length} date mismatches. Not published.`);
  else await notifyFounder(`📈 Landscape report ${monthLabel(month)} ready (issue ${issueNumber}): ${stats.monthFamilies} new families in the month, ${stats.families12} over twelve months. Sent to subscribers only by hand (newsletter send ${issueNumber}).`);
  return { issueNumber, qaPassed: qa.passed, families: stats.monthFamilies, markdown };
}
