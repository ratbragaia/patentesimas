import fs from "node:fs";
const [src, dst, title] = process.argv.slice(2);
const md = fs.readFileSync(src, "utf8");
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/_(.+?)_/g, "<em>$1</em>");
let html = [], inTable = false;
for (const line of md.split("\n")) {
  if (line.startsWith("|")) { if (!inTable) { html.push("<table>"); inTable = true; } if (/^\|[-| ]+\|$/.test(line)) continue; html.push("<tr>" + line.split("|").slice(1, -1).map(c => "<td>" + inl(c.trim()) + "</td>").join("") + "</tr>"); continue; }
  if (inTable) { html.push("</table>"); inTable = false; }
  const h = line.match(/^(#+) (.*)/); if (h) { html.push(`<h${h[1].length}>${inl(h[2])}</h${h[1].length}>`); continue; }
  if (line.trim()) html.push("<p>" + inl(line) + "</p>");
}
if (inTable) html.push("</table>");
fs.writeFileSync(dst, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} — RareFree Intelligence</title><link rel="stylesheet" href="../style.css"><style>main{max-width:760px}table{border-collapse:collapse;font-size:14px}td{border:1px solid #e4e7ec;padding:6px 8px;vertical-align:top}.banner{background:#fff4d6;border:1px solid #f0c36d;padding:10px 14px;border-radius:6px;margin:20px 0}</style></head><body><header class="nav"><a class="brand" href="/">RareFree <span>Intelligence</span></a></header><main><div class="banner"><strong>Draft under legal review.</strong> This document is not yet binding. Subscriptions open once counsel review is complete.</div>${html.join("\n")}</main><footer><p><a href="/">Home</a></p></footer></body></html>`);
