# ADR 0006 — Company name: PatentSonar

Date: 2026-09-25 · Status: accepted (domain purchase pending, founder item 3)

## Context
The founder asked for a company name that (a) is about patents, not only rare-earth-free magnets,
(b) works worldwide, and (c) has the `.com` free. The original working name, RareFree Intelligence,
was too narrow, and `rarefree.com` is registered (parked at NameBright, confirmed by NS lookup).

## Method
1. Generated ~260 candidates (patent / claim / prior-art / novelty / invention roots, Latin and
   French "brevet" roots, monitoring metaphors).
2. Checked `.com` delegation in the Verisign zone with NS lookups (`scripts/check-domains.py`).
   The container cannot reach RDAP or registrar sites, so NXDOMAIN is the strongest signal
   available here; Cloudflare Registrar confirms at checkout.
3. Web-searched the top five for existing brands in the patent/IP space.

## Shortlist (all had .com/.io/.ai/.co/.net/.org free on 2026-09-25)
| Name | Verdict | Reason |
|---|---|---|
| **PatentSonar** | **chosen** | "Patent" is explicit in every language; "sonar" is a near-universal word meaning detection and continuous monitoring, which is exactly the product (weekly detection of new filings and alerts). 11 characters, easy to say in EN/PT/DE/JP/ZH. No patent-industry brand found; SonarSource (code quality) is a different field and class. |
| PriorAtlas | fallback 1 | Elegant for IP professionals (prior art + landscape maps); less obvious to non-IP buyers. No conflict found. |
| PatentNorth | fallback 2 | "True north" guidance metaphor; no conflict found. |
| PatentOrbit | rejected | Collides with Questel's **Orbit Intelligence**, the leading patent-analytics brand. |
| NoveltyScope | rejected | Too close to WIPO's **PATENTSCOPE**. |
| Other free names kept for products/streams | — | PatentBeam, PatentCrest, PatentMeridian, InventAtlas, ClaimFrontier, PatentFlux |

## Decision
- Company and brand: **PatentSonar**. Primary domain `patentsonar.com`; register `.io`, `.ai`,
  `.co` defensively (cheap, prevents copycats). Outreach domain: `patentsonar-mail.com` or similar.
- Positioning: PatentSonar is a patent-intelligence company that runs one technology **coverage
  stream** at a time. Stream 01: Rare-Earth-Free Magnets. New streams are opened only after the
  first is profitable and by an ADR grounded in research.
- Repository, schema (`ps`), systemd units, env, site and templates were renamed in this commit.

## Founder actions
1. Buy `patentsonar.com` (+ .io/.ai/.co) at Cloudflare Registrar; if it was taken in the meantime,
   buy fallback 1 or 2 and tell the agent, which will re-run the rename.
2. Ask the lawyer for a quick trademark clearance (USPTO TESS, EUIPO, INPI) in classes 35/42/45.
3. Reserve the handles `patentsonar` on LinkedIn and X once the domain is confirmed.
