/**
 * Render legal/*.md into site/legal/*.html with the site shell. Run: npm run legal:build
 * The markdown files are the source of truth (legal/REVIEW_STATUS.md says which version is published).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { markdownToHtml } from "../src/content/newsletter.js";

const PAGES: { md: string; html: string; title: string }[] = [
  { md: "legal/terms.md", html: "site/legal/terms.html", title: "Terms" },
  { md: "legal/privacy.md", html: "site/legal/privacy.html", title: "Privacy" },
  { md: "legal/refunds.md", html: "site/legal/refunds.html", title: "Refunds" },
  { md: "legal/dpa.md", html: "site/legal/dpa.html", title: "Data Processing Addendum" },
];
const shell = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — PatentSonar</title><link rel="stylesheet" href="../style.css"><style>main{max-width:760px}table{border-collapse:collapse;font-size:14px;width:100%}th,td{border:1px solid #e4e7ec;padding:6px 8px;vertical-align:top;text-align:left}th{background:#f5f7fa}h1{font-size:28px}p{margin:10px 0}</style></head><body><header class="nav"><a class="brand" href="/">Patent<span>Sonar</span></a><nav><a href="terms.html">Terms</a><a href="privacy.html">Privacy</a><a href="refunds.html">Refunds</a><a href="dpa.html">DPA</a></nav></header><main>
${body}
</main><footer><p><a href="/">Home</a> · legal@patentsonar.com · support@patentsonar.com · +55 32 93618-2698</p></footer></body></html>
`;
for (const p of PAGES) {
  const md = readFileSync(p.md, "utf8");
  writeFileSync(p.html, shell(p.title, markdownToHtml(md)));
  console.log(`built ${p.html} from ${p.md}`);
}
