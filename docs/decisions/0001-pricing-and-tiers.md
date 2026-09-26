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

## Update 2026-09-26 — scope per price validated (research 01 §8)

Founder's question: at their prices, do competitors deliver one technology area or many? Finding:
curated patent/technology intelligence is sold **per area** across the market (Magic Number US$500/month
per sector; SDLE battery patent newsletter US$499/yr; Knowmade monitors and EUR 4,990 landscapes per
technology; TechInsights per channel; Yole per report with bundle discounts). Whole-universe coverage is
sold only as uncurated database seats (Lens US$1,000/yr up to PatSnap/Orbit US$15–30K). Nobody sells
curated whole-universe coverage. All figures are search excerpts (vendor sites blocked); confidence per
row in research 01 §8.

Decision: **prices unchanged** (Analyst ≈ half a Magic Number sector; Team 1.25–1.5×; Enterprise inside
the PatSnap entry band and justified by the bespoke mini-landscape, portfolio watch and API).
- The unit of sale is stated explicitly wherever price appears: "each subscription covers one coverage
  stream" (site pricing page updated today; order form when the lawyer review starts).
- A second-stream discount is pre-decided, not published: placeholder 60–70% of list for the second
  stream, to be evidenced when Stream 02 exists (precedents: Magic Number multi-sector discount, Yole
  bundles).
- Enterprise proposals itemise the mini-landscape (EUR 4,990 list at Knowmade), portfolio watch and API so
  buyers do not compare US$24K against a database seat on scope alone.
- Open verification before quoting externally: Magic Number multi-sector discount; Knowmade monitor price
  (only a monitor below ~US$5K/yr would change the Team story); IDTechEx and Everest report prices.

## Consequences
- US$200 entry is dropped; Analyst starts at US$249 to sit below the Magic Number anchor while
  clearing the "individual newsletter" band.
- Team is where corporate budgets sit; it is the featured plan on the site.
- Revisit with real conversion data; write ADR 0005+ for any change.
