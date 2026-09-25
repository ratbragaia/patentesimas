import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { db, audit } from "../lib/db.js";
import { config } from "../lib/config.js";
import { runQa, type KnownPublication } from "./qa.js";
import { notifyFounder } from "../reporting/telegram.js";

const here = dirname(fileURLToPath(import.meta.url));

export interface FamilyRow {
  family_id: string; representative_publication: string; earliest_priority_date: string | null; offices: string[];
  technology_bucket: string; analyst_summary: string | null; triage_status: string;
  pub: { publication_number: string; title: string | null; abstract: string | null; applicants: string[]; publication_date: string; country_code: string; kind_code: string | null } | null;
}

/** Pull included families whose representative publication falls in the period. */
export async function loadIssueFamilies(periodStart: string, periodEnd: string): Promise<FamilyRow[]> {
  const { data, error } = await db().from("patent_families")
    .select("family_id, representative_publication, earliest_priority_date, offices, technology_bucket, analyst_summary, triage_status, pub:patent_publications!representative_publication(publication_number,title,abstract,applicants,publication_date,country_code,kind_code)")
    .eq("triage_status", "include");
  if (error) throw new Error(error.message);
  return (data as unknown as FamilyRow[]).filter((f) => f.pub && f.pub.publication_date >= periodStart && f.pub.publication_date <= periodEnd);
}

const BUCKET_LABEL: Record<string, string> = {
  iron_nitride: "Iron nitride (Fe16N2)", mnbi: "Mn–Bi", mnal: "Mn–Al–C", feni_l10: "L10 FeNi / tetrataenite",
  ferrite: "Advanced ferrites", re_lean: "Rare-earth-lean designs", motor_topology: "RE-free motor topologies", other: "Other",
};

/** Deterministic markdown skeleton. The production agent adds analyst_summary per family beforehand. */
export function renderIssueMarkdown(issueNumber: number, periodStart: string, periodEnd: string, fams: FamilyRow[]): string {
  const lines: string[] = [];
  lines.push(`# RareFree Intelligence — Issue #${issueNumber}`);
  lines.push(`Coverage period: ${periodStart} to ${periodEnd}. ${fams.length} new patent families across ${new Set(fams.flatMap((f) => f.offices)).size} offices.`);
  lines.push("");
  const byBucket = new Map<string, FamilyRow[]>();
  for (const f of fams) byBucket.set(f.technology_bucket, [...(byBucket.get(f.technology_bucket) ?? []), f]);
  lines.push("## This week in numbers");
  for (const [b, list] of byBucket) lines.push(`- ${BUCKET_LABEL[b] ?? b}: ${list.length} ${list.length === 1 ? "family" : "families"}`);
  lines.push("");
  for (const [b, list] of byBucket) {
    lines.push(`## ${BUCKET_LABEL[b] ?? b}`);
    for (const f of list) {
      const p = f.pub!;
      lines.push(`### ${p.title ?? "(untitled)"}`);
      lines.push(`${p.publication_number} · published ${p.publication_date} · ${p.applicants.join("; ") || "applicant not recorded"} · family ${f.family_id} · offices: ${f.offices.join(", ")}`);
      lines.push("");
      lines.push(f.analyst_summary?.trim() || "_Analyst note pending._");
      lines.push("");
    }
  }
  lines.push("---");
  lines.push("All patent data is sourced from USPTO PatentsView, EPO Open Patent Services and Google Patents Public Data. Numbers link to the official record. This newsletter is information, not legal advice.");
  return lines.join("\n");
}

export function renderIssueHtml(markdown: string, unsubscribeUrl: string): string {
  const tpl = readFileSync(join(here, "templates", "issue.html"), "utf8");
  const body = markdownToHtml(markdown);
  return tpl.replace("{{BODY}}", body).replace("{{UNSUBSCRIBE_URL}}", unsubscribeUrl)
    .replace("{{COMPANY_NAME}}", config().COMPANY_NAME).replace("{{COMPANY_ADDRESS}}", config().COMPANY_POSTAL_ADDRESS)
    .replace("{{SITE_URL}}", config().PUBLIC_SITE_URL);
}

/** Minimal, dependency-free markdown → HTML for our controlled skeleton (headings, paragraphs, lists, hr, links). */
export function markdownToHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (s: string) => esc(s)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\b(US|EP|WO|CN|JP|KR)-(\d{5,13})(?:-([A-Z]\d?))?\b/g, (m, cc, n, k) => `<a href="https://patents.google.com/patent/${cc}${n}${k ?? ""}">${m}</a>`);
  const out: string[] = []; let inList = false;
  for (const raw of md.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) { if (!inList) { out.push("<ul>"); inList = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }
    if (inList) { out.push("</ul>"); inList = false; }
    if (line === "") continue;
    if (line === "---") { out.push("<hr>"); continue; }
    const h = line.match(/^(#{1,3}) (.*)$/);
    if (h) { out.push(`<h${h[1]!.length}>${inline(h[2]!)}</h${h[1]!.length}>`); continue; }
    out.push(`<p>${inline(line)}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

/** Build (or rebuild) a weekly issue, run QA, persist. Never marks ready when QA fails. */
export async function buildWeeklyIssue(periodStart: string, periodEnd: string): Promise<{ issueNumber: number; qaPassed: boolean }> {
  const fams = await loadIssueFamilies(periodStart, periodEnd);
  const { data: last } = await db().from("issues").select("issue_number").order("issue_number", { ascending: false }).limit(1).maybeSingle();
  const { data: existing } = await db().from("issues").select("issue_number").eq("period_start", periodStart).eq("period_end", periodEnd).maybeSingle();
  const issueNumber = existing?.issue_number ?? (last?.issue_number ?? 0) + 1;
  const markdown = renderIssueMarkdown(issueNumber, periodStart, periodEnd, fams);

  const { data: known } = await db().from("patent_publications").select("publication_number,publication_date,applicants,family_id,title");
  const qa = runQa(markdown, (known ?? []) as KnownPublication[]);
  const html = renderIssueHtml(markdown, "{{UNSUBSCRIBE_URL}}"); // per-recipient substitution at send time
  await db().from("issues").upsert({
    issue_number: issueNumber, kind: "weekly", title: `RareFree Intelligence #${issueNumber}`,
    period_start: periodStart, period_end: periodEnd, markdown, html,
    family_ids: fams.map((f) => f.family_id), qa_passed: qa.passed, qa_report: qa,
    status: qa.passed ? "ready" : "qa_failed",
  }, { onConflict: "issue_number" });
  await audit("production", "issue_built", "issues", String(issueNumber), { qa });
  if (!qa.passed) await notifyFounder(`❌ Issue #${issueNumber} failed QA: ${qa.unknown.length} unknown numbers, ${qa.dateMismatches.length} date mismatches. Not sent.`);
  else await notifyFounder(`✅ Issue #${issueNumber} ready (${fams.length} families). Sends on schedule.`);
  return { issueNumber, qaPassed: qa.passed };
}
