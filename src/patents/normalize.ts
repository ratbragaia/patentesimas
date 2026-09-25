/**
 * Publication-number normalisation. Sources disagree:
 *  - PatentsView: patent_id "11234567" (US grants), pregrant "20260012345"
 *  - EPO OPS epodoc: "US11234567B2", "EP4123456A1", "WO2026123456A1"
 *  - Google BigQuery: "US-11234567-B2"
 * Canonical form here: CC-NUMBER-KIND (kind may be omitted if unknown -> CC-NUMBER).
 */
export function normalizePublicationNumber(raw: string, countryHint?: string, kindHint?: string | null): string {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  let m = s.match(/^([A-Z]{2})-?(\d+)-?([A-Z]\d?)?$/);
  if (m) {
    const kind = m[3] ?? kindHint ?? null;
    return kind ? `${m[1]}-${m[2]}-${kind}` : `${m[1]}-${m[2]}`;
  }
  // bare number (PatentsView)
  m = s.match(/^(\d+)$/);
  if (m && countryHint) {
    const kind = kindHint ?? null;
    return kind ? `${countryHint.toUpperCase()}-${m[1]}-${kind}` : `${countryHint.toUpperCase()}-${m[1]}`;
  }
  throw new Error(`Cannot normalise publication number: ${raw}`);
}

export function normalizeCpc(code: string): string {
  // "H01F1/047" or "H01F 1/047" -> "H01F1/047"
  return code.replace(/\s+/g, "").toUpperCase();
}

export function toIsoDate(v: unknown): string | null {
  if (!v) return null;
  const s = String(v);
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}
