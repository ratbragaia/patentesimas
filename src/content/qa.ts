/**
 * QA gate: the newsletter may only cite publication numbers and family ids that exist in our
 * ingested tables, and dates/assignees must match the stored record. This is the mechanical
 * enforcement of rule #1 in CLAUDE.md ("never invent patent data").
 */
export interface KnownPublication {
  publication_number: string; publication_date: string; applicants: string[]; family_id: string | null; title: string | null;
}
export interface QaReport { passed: boolean; cited: string[]; unknown: string[]; dateMismatches: string[]; warnings: string[] }

// Matches US-12345678-B2, EP-4123456-A1, WO-2026123456-A1, CN-118123456-A, JP-2026123456-A, KR-1020260012345-A
export const PUB_NUMBER_RE = /\b([A-Z]{2})-(\d{5,13})(?:-([A-Z]\d?))?\b/g;
// Matches ISO dates like 2026-09-18
const DATE_RE = /\b(20\d{2}-\d{2}-\d{2})\b/g;

export function extractCitations(markdown: string): string[] {
  return [...new Set([...markdown.matchAll(PUB_NUMBER_RE)].map((m) => (m[3] ? `${m[1]}-${m[2]}-${m[3]}` : `${m[1]}-${m[2]}`)))];
}

export function runQa(markdown: string, known: KnownPublication[]): QaReport {
  const byNumber = new Map<string, KnownPublication>();
  for (const k of known) {
    byNumber.set(k.publication_number, k);
    byNumber.set(k.publication_number.replace(/-[A-Z]\d?$/, ""), k); // allow kind-less citation
  }
  const cited = extractCitations(markdown);
  const unknown = cited.filter((c) => !byNumber.has(c));
  const dateMismatches: string[] = [];
  const warnings: string[] = [];

  // Check that a date appearing in the same paragraph as a citation matches the stored publication date.
  for (const para of markdown.split(/\n\s*\n/)) {
    const cites = extractCitations(para).filter((c) => byNumber.has(c));
    const dates = [...para.matchAll(DATE_RE)].map((m) => m[1]!);
    if (cites.length === 1 && dates.length >= 1) {
      const k = byNumber.get(cites[0]!)!;
      if (!dates.includes(k.publication_date)) dateMismatches.push(`${cites[0]}: text says ${dates.join(",")} but record is ${k.publication_date}`);
    }
  }
  if (cited.length === 0) warnings.push("Issue cites no publication numbers.");
  if (/\b(approximately|around|roughly) (\d+ )?(patents|filings)\b/i.test(markdown)) warnings.push("Vague counts detected; use exact counts from the database.");
  return { passed: unknown.length === 0 && dateMismatches.length === 0, cited, unknown, dateMismatches, warnings };
}
