# Legal templates — review status

| Document | Version | Status | Reviewed by | Date |
|---|---|---|---|---|
| terms.md | 1.0 | **Published** (site/legal/terms.html) | Agent review at the founder's direction (ADR 0014); no licensed counsel | 2026-09-26 |
| privacy.md | 1.0 | **Published** (site/legal/privacy.html) | same | 2026-09-26 |
| refunds.md | 1.0 | **Published** (site/legal/refunds.html) | same | 2026-09-26 |
| dpa.md | 1.0 | Published as reference (site/legal/dpa.html); signed on request | same | 2026-09-26 |
| order-form.md | 1.0 | Internal template for Enterprise | same | 2026-09-26 |

Rule (CLAUDE.md §1.4) applied as follows: the founder, having no counsel available, directed the agent on
2026-09-26 to review the drafts in depth and publish. The review memo, the issues found, the changes made
and the residual risks are in `docs/decisions/0014-legal-review-by-agent.md`. This is not legal advice from
a licensed lawyer; the memo lists the three points where a paid hour of counsel would add real protection.

Change control: any edit to these files bumps the version, updates the effective date, is re-rendered with
`npm run legal:build`, and (for material changes) triggers the 30-day customer notice in Terms §16.
