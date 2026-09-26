# ADR 0014 — Legal templates reviewed and published at the founder's direction (no counsel available)

- **Date:** 2026-09-26
- **Status:** accepted
- **Relates to:** CLAUDE.md rule 4, `legal/REVIEW_STATUS.md`, ADR 0002 (fiscal), ADR 0004 (Paddle), ADR 0010 (site form)

## Context
Rule 4 required lawyer review before publishing the legal templates. The founder has no lawyer for this and
asked the agent to "act as a patent lawyer and review in depth". The agent is not a licensed attorney; the
founder accepted that and took the publication decision. This memo records the review so a professional can
audit it quickly later.

## What was reviewed against
Brazilian law (Código Civil; LGPD, Lei 13.709/2018 incl. Res. CD/ANPD 2/2022 small-agent exemption and Res.
19/2024 transfer clauses; CDC art. 49 for the rare consumer case), GDPR/UK GDPR (Arts. 6, 13–14, 27, 28,
Chapter V, SCC Decision 2021/914), US CAN-SPAM and auto-renewal practice, Paddle's Seller Handbook and Buyer
Terms (reseller wording, 30-day money-back minimum, acceptance before purchase, support contact on the
site), the EPO OPS terms (no redistribution of raw data), and the CC BY 4.0 attribution duties for Google
Patents Public Data and PatentsView.

## Issues found in the 0.1 drafts and how they were resolved
1. **Governing law left blank.** Set: Brazilian law, comarca of São João del Rei/MG, 30-day negotiation
   first, injunctive relief anywhere, CISG excluded; Enterprise Order Forms may deviate. Rationale: the
   company, its assets and its evidence are in Brazil; foreign forums would cost more than any likely claim.
2. **Paddle reseller structure not stated the way Paddle requires.** Added the reseller/Merchant-of-Record
   clause, reference to Paddle's Buyer Terms, taxes handled by Paddle, and the buyer-support address.
3. **Refund policy below Paddle's minimum.** Monthly plans had a 14-day window; Paddle requires at least 30
   days. Now: 30-day full refund on the first charge of any plan; annual pro-rata minus one month after
   that; duplicates refunded; statutory consumer rights preserved (EU/UK 14 days, CDC 7 days).
4. **Licence too thin to enforce.** Defined Subscriber/Reader/Content; internal-use licence; explicit bans on
   forwarding to non-Readers, public posting and use to train or ground ML systems; carve-out keeping
   bibliographic patent data free (we cannot and do not claim it); confidentiality of Content.
5. **Third-party data terms not reflected.** Added attribution for CC BY 4.0 sources and the EPO OPS
   no-raw-redistribution position; Content is described as prepared by analysts with automated systems and
   checked against official records (true: `src/content/qa.ts`).
6. **No renewal mechanics.** Auto-renewal stated plainly; 30-day reminder before annual renewals; price
   changes only at renewal; termination with pro-rata refund if terms change materially.
7. **Liability clause.** Kept the 12-month-fees cap and consequential-loss exclusion; added the carve-out
   Brazilian law requires (dolo, gross negligence cannot be excluded).
8. **Missing boilerplate.** Added suspension mechanics matching the finance agent's dunning schedule,
   sanctions clause (Paddle also enforces), force majeure, assignment, notices, severability, entire
   agreement, survival, language clause.
9. **Privacy policy.** Fixed LGPD article numbers (legitimate interest is Art. 7, IX; contract Art. 7, V);
   replaced placeholders with the real processor list and locations (Supabase us-east-1, Hostinger VPS in Boston/US per `ops.sh host-info`, Postmark/ActiveCampaign,
   Paddle, Cloudflare, Google BigQuery, Anthropic, Telegram for internal alerts, Notaas); disclosed the hashed
   IP kept by the sample form and the AI-assisted drafting of replies; added transfer mechanisms (SCCs/DPF;
   ANPD clauses), the small-agent encarregado position, security and breach commitments, LGPD 15-day
   response, children statement, retention per category.
10. **DPA did not exist.** Written (`legal/dpa.md`): roles (processor for Reader data, controller otherwise),
    Art. 28 GDPR / Art. 39 LGPD content, sub-processor notice, 48-hour breach notice, deletion, audits,
    SCC Module 2/3 and UK Addendum by reference, ANPD clauses.
11. **Order form.** Added renewal choice, PO/invoicing line, DPA toggle, signature block, and the rule that
    PO terms never override.
12. **Site.** Draft banners removed; pages rebuilt from the markdown by `npm run legal:build`; DPA page added;
    footer shows support@ (Paddle asks for a visible support contact).

## Trademark clearance (quick, not a formal search)
Web search on 2026-09-26 found no company, product or domain using "PatentSonar" / "Patent Sonar" in patent
information services. A US registration for "SONAR" exists in an unrelated field (Sierra International LLC,
2018), which does not block a composite mark in class 42/45 services. The USPTO, EUIPO and INPI databases
are not reachable from the cloud session; a five-minute check by the founder (TESS/TSDR, eSearch plus, INPI
busca) before any trademark filing is recommended. Filing in Brazil (INPI, classes 42 and 45) costs a few
hundred reais and is worth doing once revenue starts.

## Residual risks a paid hour of counsel would address (in priority order)
1. **Enforceability of the Brazilian forum clause against EU/US enterprise buyers**, and whether to offer
   arbitration (CAM-CCBC or ICC) in the Enterprise Order Form.
2. **GDPR Art. 27 representative**: our "occasional" reading may stop holding once EU subscribers are
   regular; a representative service costs ~EUR 100–300/year.
3. **Consumer-law edge cases** for sole practitioners buying with personal cards (withdrawal rights and
   digital-content exceptions) — mitigated by the B2B positioning and the generous refund policy.

## Follow-ups queued
- Cloudflare Email Routing rules for billing@, legal@, privacy@ and support@ → inbound worker (task in
  `ps.tasks`; the Cloudflare token now allows it).
- Paddle asks for a support phone number on the site; a virtual number is a founder item (optional until
  Paddle's review asks for it).
