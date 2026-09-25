/** Normalised publication record, identical regardless of source. */
export interface Publication {
  publication_number: string; // CC-NUMBER-KIND, e.g. US-12345678-B2, EP-4123456-A1, WO-2026123456-A1
  country_code: string;
  kind_code: string | null;
  family_id: string | null;
  title: string | null;
  abstract: string | null;
  applicants: string[];
  inventors: string[];
  cpc_codes: string[];
  priority_date: string | null; // ISO date
  filing_date: string | null;
  publication_date: string;
  grant_date: string | null;
  application_number: string | null;
  source: "patentsview" | "epo_ops" | "bigquery";
  source_payload: unknown;
  matched_terms: string[];
}
