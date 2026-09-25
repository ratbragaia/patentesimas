/**
 * Pre-send compliance check for cold B2B outreach. Encodes the checklist from
 * docs/research/04-compliance-and-payments.md. Opt-in-only jurisdictions are blocked for cold
 * email entirely; the prospecting agent must find another compliant channel for them.
 */
export interface OutreachDraft { toEmail: string; toCountry: string | null; subject: string; body: string; senderName: string; companyName: string; postalAddress: string; unsubscribeUrl: string }
export interface ComplianceResult { ok: boolean; problems: string[] }

/** Jurisdictions where unsolicited B2B marketing email to a named person requires prior opt-in. */
export const OPT_IN_ONLY = new Set(["DE", "AT", "IT", "NL", "ES", "PL", "CZ", "DK", "NO", "SE", "FI", "JP", "KR", "CN", "AU", "CA-STRICT"]);

export function checkOutreach(d: OutreachDraft, suppressed: Set<string>): ComplianceResult {
  const problems: string[] = [];
  const email = d.toEmail.toLowerCase();
  const domain = email.split("@")[1] ?? "";
  if (suppressed.has(email) || suppressed.has(`@${domain}`)) problems.push("recipient or domain is on the do-not-contact list");
  if (/^(info|contact|sales|hello|noreply|no-reply|privacy|legal)@/.test(email) === false && !d.toCountry) problems.push("country unknown for a named individual; determine jurisdiction first");
  if (d.toCountry && OPT_IN_ONLY.has(d.toCountry.toUpperCase())) problems.push(`cold email to a named person is opt-in-only in ${d.toCountry}; use a role mailbox, referral, or inbound channel`);
  if (!d.body.includes(d.unsubscribeUrl)) problems.push("missing opt-out link");
  if (!d.body.includes(d.postalAddress) || d.postalAddress.trim() === "") problems.push("missing sender postal address (CAN-SPAM)");
  if (!d.body.includes(d.companyName)) problems.push("sender company not identified");
  if (/\b(re:|fwd:)/i.test(d.subject)) problems.push("deceptive subject line (fake reply/forward)");
  if (/urgent|act now|last chance|guaranteed/i.test(d.subject + d.body)) problems.push("pressure language; keep analyst tone");
  if (d.body.length > 1800) problems.push("body too long for a first touch (>1800 chars)");
  if (!/because|noticed|your (team|company|filing|portfolio)/i.test(d.body)) problems.push("no stated reason why this recipient is relevant (legitimate-interest rationale)");
  return { ok: problems.length === 0, problems };
}
