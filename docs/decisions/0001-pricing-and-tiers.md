# ADR 0001 — Pricing and tiers

Date: 2026-09-25 · Status: accepted (revisit after 10 paying accounts or 2026-12-31)

## Context
Founder briefing proposed "from US$200/month" and asked whether that is underpriced. Research in
`docs/research/01-competitors-and-pricing.md` found: the closest curated analog (Magic Number
"Patent Forecast") sells at US$500/month per sector; entry seats on patent databases run roughly
US$10K–30K/year; individual-paid deep-tech intelligence clusters at US$150–1,000/year; no paid
service dedicated to rare-earth-free magnet patents exists, but free one-off landscapes anchor buyers
at "free". Figures are from search excerpts (vendor pages were blocked in the research environment)
and must be re-verified before quoting externally.

## Decision
| Tier | Monthly | Annual | Includes |
|---|---|---|---|
| Analyst | US$249 | US$2,490 | weekly issue, monthly report, archive, 1 reader |
| Team | US$750 | US$7,500 | + 5 readers, custom watchlists/alerts, quarterly briefing, CSV export |
| Enterprise | from US$2,000 | annual only | + unlimited readers (one entity), custom scope, one bespoke mini-landscape/yr, API/feed, PO invoicing |

Annual prepay = 2 months free (~17%). Founding-member offer: 30% off year one for the first 20
organisations. Sales may not discount beyond these two mechanisms (CLAUDE.md §1.4, sales agent).

## Consequences
- US$200 entry is dropped; Analyst starts at US$249 to sit below the Magic Number anchor while
  clearing the "individual newsletter" band.
- Team is where corporate budgets sit; it is the featured plan on the site.
- Revisit with real conversion data; write ADR 0005+ for any change.
