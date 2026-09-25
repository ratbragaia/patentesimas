# 04 — Compliance, Payments and Operations Research

**Project:** RareFree Intelligence — USD-priced B2B subscription newsletter on rare-earth-free magnet patents
**Seller entity:** Brazilian ME/EPP (CNPJ), Simples Nacional
**Date:** 2026-09-25
**Author:** compliance & operations research (autonomous agent) — for lawyer/accountant review, not legal advice

> **Research-integrity note.** This session's egress proxy blocked direct fetches of paddle.com, developer.paddle.com, postmarkapp.com, wise.com, ico.org.uk, ftc.gov, crtc.gc.ca, gov.br, uspto.gov, espacenet.com, nfe.io and most third-party blogs. Where a claim rests only on a search-engine excerpt of the primary page rather than a full read, it is marked **[excerpt-only]**. Where it rests on the author's prior knowledge with no page fetched this session, it is marked **[unverified — confirm]**. Everything else was read from the cited page (mainly github.com-hosted sources, which were reachable).

---

## Executive answers

| Question | Answer | Confidence |
|---|---|---|
| Does Paddle accept a Brazilian company as a **seller** and pay it out? | **Yes, per Paddle's own help article** ("Paddle supports sellers and can payout to anywhere in the world with exception to sanctioned countries"; Brazil listed as supported). Payouts by bank transfer, PayPal or Payoneer. | Medium-high **[excerpt-only]** — confirm during onboarding (Paddle also performs a business/product review and can decline). |
| Does Postmark allow cold outreach? | **No.** Terms require permission-based lists, ban purchased/rented lists and call out "emails sent unsolicited"; Broadcast streams force an unsubscribe link and the same permission rule. | High |
| Can a Brazilian CNPJ open Wise Business and hold USD? | **Yes, with restrictions**: only EI/MEI, Ltda/SLU and single-lawyer companies; the company owner must be the personal Wise account holder; R$250 one-off activation fee; 40+ currency balances incl. USD. Per-transfer limits apply when sending from BRL. | Medium-high **[excerpt-only]** |

---

## 1. Cold B2B email law — per-country rules

### 1.1 Framework

- **EU/EEA:** ePrivacy Directive 2002/58/EC art. 13 (transposed nationally) + GDPR. Art. 13 requires prior consent for e-mail marketing to *natural persons*; Member States decide how to treat *legal persons*. Result: a patchwork. GDPR applies regardless because a named work address (`j.smith@company.com`) is personal data, so a documented Legitimate Interest Assessment (LIA, art. 6(1)(f)) and an art. 14 information notice are needed wherever consent is not the basis.
- **UK:** PECR 2003 + UK GDPR. Corporate-subscriber exemption is the key feature.
- **US:** CAN-SPAM (2003) — opt-out regime, no consent needed.
- **Canada:** CASL — consent regime, but with an "implied consent by conspicuous publication" route that fits hand-picked B2B outreach.
- **Brazil:** LGPD — legitimate interest (art. 7, IX) is accepted for B2B prospecting with opt-out.
- **Japan, Korea, China:** opt-in regimes. Japan has a narrow business-published-address carve-out; Korea and China effectively do not.

### 1.2 Rule table

| Jurisdiction | Cold B2B e-mail allowed? | Consent model | Mandatory elements / conditions | Max penalty (headline) | Sources |
|---|---|---|---|---|---|
| **United States** (CAN-SPAM) | **Yes** | Opt-out. "There is no requirement for consent to contact subscribers based in the USA." | Accurate From/Reply-To/routing; non-deceptive subject; identify the message as an ad; **valid physical postal address** (street, USPS PO box or CMRA box); clear opt-out that works **≥30 days**; honor opt-outs **within 10 business days**; no fee or extra data for opt-out; you are liable for what vendors send on your behalf. | Up to **US$53,088 per e-mail** (2025 adjustment). | [FTC guide](https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business) **[excerpt-only]**; [EmailOctopus repo — USA](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/usa.md) |
| **Canada** (CASL) | **Yes, conditionally** | Consent (express or implied). Implied consent via **conspicuous publication**: (1) the *recipient themself* published the address (not a third-party directory), (2) no statement that they do not want unsolicited CEMs, (3) message **relevant to the person's business role/duties**. Not available for consumers. Existing-business-relationship implied consent: 2 years after purchase / 6 months after inquiry. | Sender name (and on-behalf-of), **physical mailing address** + phone/e-mail/URL; unsubscribe that needs no login, works **≥60 days**, honored **≤10 business days**; burden of proving consent is on the sender — keep records of *where* each address was published. | Up to **CAD 10M per violation** (corporations); director liability. | [CRTC implied-consent guidance](https://crtc.gc.ca/eng/com500/guide.htm) **[excerpt-only]**; [CRTC FAQ](https://crtc.gc.ca/eng/com500/faq500.htm) **[excerpt-only]**; [ISED — getting consent](https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email) **[excerpt-only]**; [EmailOctopus repo — Canada](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/canada.md) |
| **United Kingdom** (PECR + UK GDPR) | **Yes** to corporate subscribers | **No consent needed for corporate subscribers** (limited companies, LLPs, Scottish partnerships, public bodies). Sole traders and ordinary partnerships are *individual* subscribers → consent or soft opt-in required. UK GDPR still applies to named employee addresses → LIA + privacy notice + right to object. | Do not disguise identity; **valid address for opt-out**; geographic address per E-Commerce Regs 2002; honor objections. | PECR fine ceiling raised to **£17.5M / 4% global turnover** from 5 Feb 2026 (Data (Use and Access) Act) — **[verify; taken from community repo]**. | [ICO — electronic mail marketing](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/) **[excerpt-only]**; [ICO — choosing lawful basis](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/sending-direct-marketing-choosing-your-lawful-basis/) **[excerpt-only]**; [EmailOctopus repo — UK](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/uk.md) |
| **Germany** (UWG §7(2), GDPR, DDG) | **No** (without consent) | **Express prior consent required for e-mail advertising, including B2B.** Only exception: existing customer, similar goods, opt-out offered at collection and in every message. Courts almost never accept "presumed consent" for e-mail. Enforcement is mostly via competitor/association *Abmahnung* (cease-and-desist with cost reimbursement). | Full *Impressum*-style identification (name, company, **street address — no PO box**, e-mail, registration/VAT numbers), directly linked from the e-mail; opt-out. Double opt-in is the evidentiary standard. | GDPR €20M/4%; DDG up to **€300k** (concealed commercial nature), €50k (missing legal notice); UWG injunctions + costs. | [Overloop — Germany](https://overloop.com/blog/b2b-cold-email-germany-gdpr-compliance) **[excerpt-only]**; [EmailOctopus repo — Germany](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/germany.md) |
| **Austria** (TKG §174, ECG) | **No** (without consent) | Treated like Germany: prior consent for e-mail advertising, B2B included; check the RTR "ECG-Liste" (Robinson list) before any send. | Identification; opt-out; no sending to ECG-listed addresses. | Administrative fines (up to €37k historically) **[unverified — confirm]**. | [Asphia — GDPR cold email 2026](https://asphia.consulting/blog/cold-email-gdpr-europe-2026/) **[excerpt-only]**; [Quarvio](https://www.quarvio.io/blog/cold-email-gdpr-guide) **[excerpt-only]** |
| **Italy** (Codice Privacy art. 130, Garante) | **No** (without consent) | Garante reads art. 130 as requiring **opt-in even for B2B addresses**; legitimate interest is not accepted for unsolicited promotional e-mail. | Identification; opt-out; consent records. | GDPR ceilings (€20M/4%); Garante fines regularly issued for B2B spam. | [Asphia](https://asphia.consulting/blog/cold-email-gdpr-europe-2026/) **[excerpt-only]**; [Overloop — is cold email illegal](https://overloop.com/blog/cold-email-illegal) **[excerpt-only]** |
| **Other EU** (France, Netherlands, Spain, Nordics, Ireland, Belgium) | **Mostly yes for legal-person / role-relevant addresses; country-by-country** | France (CNIL): B2B professional addresses may be contacted without consent if the message relates to the recipient's role and an opt-out is offered. Netherlands: legal persons may be e-mailed with opt-out; natural persons need consent. Spain (LSSI art. 21): consent unless prior contractual relationship — treat as consent-leaning. Nordics/Ireland/Belgium: consent-leaning per EmailOctopus repo. **[unverified — confirm per market before first send]** | GDPR art. 14 notice + LIA; identification; opt-out. | GDPR ceilings. | [EmailOctopus repo — README](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/README.md); [Scrap.io — GDPR cold email B2B](https://scrap.io/gdpr-cold-email-b2b) **[excerpt-only]** |
| **Brazil** (LGPD) | **Yes** | Legitimate interest (art. 7, IX; art. 10) for B2B prospecting to corporate addresses with relevant content and opt-out; ANPD published a Legitimate Interest guide (Feb 2024) requiring a documented balancing test (LIA) and transparency. Purchased lists are hard to justify under any basis. | Identify sender; state purpose; provide **clear opt-out** and honor it "sem demora"; keep LIA on file; privacy notice covering prospecting. | Warning; fine **up to 2% of Brazil revenue, capped at R$50M per infraction**; daily fines; publicization; blocking/deletion of data (art. 52). | [ANPD — Guia Legítimo Interesse](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse) **[excerpt-only]**; [EmailOctopus repo — Brazil](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/brazil.md); [eesier — Cold email e LGPD](https://eesier.com.br/cold-email-lgpd) **[excerpt-only]** |
| **Japan** (Act on Regulation of Transmission of Specified Electronic Mail 2002/2008; ASCT) | **Limited** | **Opt-in** since 2008. Statutory exceptions: existing business relationship; recipients who supplied their address in writing (business card); and — per Anti-Spam Act art. 3(1)(iii) — **addresses a business has itself published on the Internet in connection with its business, unless accompanied by a "no advertising e-mail" notice** **[unverified — statute not fetched; confirm with the MIC/Dekyo English guidelines]**. Safest reading: only e-mail corporate addresses published on the company's own site. | Sender name/company, **postal address**, e-mail or URL for opt-out, statement that advertising mail may be refused; stop immediately on refusal; **keep consent/authority records** (ASCT: 3 years after last mail; Anti-Spam Act: while sending + 1 month). | Individuals: ¥1M / 1 year prison; corporations: **up to ¥30M**. | [Dekyo — English guidelines PDF](https://www.dekyo.or.jp/soudan/contents/antispam/data/en/EN_Guidelines_of_Japanese_anti-spam_law.pdf) **[excerpt-only]**; [Japanese Law Translation — Anti-Spam Act](https://www.japaneselawtranslation.go.jp/en/laws/view/3767/en) **[excerpt-only]**; [Monolith Law](https://monolith.law/en/it/onlineshop-email-act-protection-of-personal-information) **[excerpt-only]**; [EmailOctopus repo — Japan](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/japan.md) |
| **South Korea** (Network Act art. 50) | **No** | **Express prior opt-in; no business-address exception.** Only exceptions: same-kind offers to a customer within 6 months of a sale; voice telemarketing under the Door-to-Door Sales Act. Consent must be re-confirmed **every 2 years**. | Subject prefix **"(광고)"**; sender identity and contact; free opt-out instructions; no night-time sends (21:00–08:00) without separate consent (applies to non-e-mail media per KISA guide — **[verify]**). | Administrative fines up to **KRW 30M** per violation; criminal liability for evasion techniques **[unverified — confirm]**. | [DLA Piper — Korea e-marketing](https://www.dlapiperdataprotection.com/index.html?t=electronic-marketing&c=KR) **[excerpt-only]**; [imisofts — Korea cold email](https://imisofts.com/blog/cold-email-laws-south-korea/) **[excerpt-only]**; [DataGuidance — KISA guide](https://www.dataguidance.com/news/south-korea-kisa-publishes-revised-guide-information) **[excerpt-only]** |
| **China** (Measures for the Administration of Internet E-mail Services 2006; PIPL 2021; Network Data Security Regs 2025) | **No** | **Prior express consent** for commercial e-mail; PIPL requires informed, voluntary, withdrawable consent for processing personal data (a named address counts). Cross-border transfer rules add friction for storing Chinese contacts outside China. | Subject must start with **"AD" or "广告"**; sender identity not concealed; valid contact for refusal kept **≥30 days**; stop on refusal. | Measures: RMB 10k (30k with illegal gains); PIPL: **RMB 50M or 5% turnover** for serious cases. | [EmailOctopus repo — China](https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/china.md); [Globig — China e-mail law](https://platform.globig.co/knowledgebase/CN/marketing-and-regulations-china/email-marketing-law-in-china) **[excerpt-only]** |

**Operating conclusion for RareFree.**
- **Green (cold outreach OK with the checklist below):** US, UK corporate subscribers, Canada (conspicuous-publication route with proof), Brazil, France/Netherlands legal persons.
- **Amber (warm-intro or double-check only):** Japan (only addresses the company itself publishes, no "no-ads" notice; keep screenshot proof), Spain, Nordics, Ireland, Belgium.
- **Red (no cold e-mail; use LinkedIn InMail, trade-show contact, partner intro, inbound content, or opt-in landing page first):** Germany, Austria, Italy, South Korea, China. For Korea/China this also avoids PIPA/PIPL cross-border headaches.

### 1.3 Outreach e-mail checklist (every message, every market)

1. **Recipient qualification recorded before send:** company type (legal person vs sole trader), country, role relevance to rare-earth-free magnets/IP, and *where the address was found* (URL + date screenshot) — needed for CASL conspicuous publication, Japan art. 3 exception and GDPR/LGPD LIA.
2. **Country gate:** sender tool blocks DE/AT/IT/KR/CN domains and TLDs unless a consent flag exists on the contact record.
3. **Suppression check:** global do-not-contact list (hashed e-mail + domain) queried before every send, including follow-ups.
4. **Honest headers:** From name = real person + company; Reply-To monitored; no spoofed domains; subject accurately describes content (CAN-SPAM, Japan, China).
5. **Identify as commercial** in body (e.g., "I'm writing because…"), and for the rare JP/CN opt-in contact add the "AD"/"広告"/"(광고)" prefix as required.
6. **Identification block:** legal name + CNPJ, **physical street address** (not PO box — Germany/CAN-SPAM/CASL), e-mail, website.
7. **Opt-out sentence in plain text** ("Reply 'unsubscribe' or click here and you will never hear from us again") + `List-Unsubscribe` / `List-Unsubscribe-Post` headers (RFC 8058 one-click) even at low volume.
8. **Opt-out SLA:** processed automatically within 24 h; hard legal ceilings are 10 business days (US, CA); "without delay" (BR, UK/EU).
9. **Link to privacy notice** with GDPR art. 14 / LGPD art. 9 content, source of data, legal basis (legitimate interest), retention, rights.
10. **Cadence cap:** max 3 touches per contact per 90 days; stop on any negative reply; never re-add after opt-out.
11. **Volume cap:** ≤30 new contacts/day per mailbox, human-reviewed lists only, no purchased/scraped bulk lists.
12. **Records:** log send, opens (if any), replies, opt-outs; retain consent/opt-out evidence 3 years (Japan ASCT requires 3 years; CASL burden of proof).

---

## 2. Postmark acceptable use and the outreach stack

### 2.1 Postmark policy (verified via multiple secondary sources quoting the ToS; primary blocked)

- "All email lists contained and/or used with Postmark must be permission-based subscriptions"; purchased or rented lists are prohibited; "emails sent unsolicited will receive abuse complaints that will be reflected on your account"; complaint threshold **<0.1%**. — [Postmark Terms of Service](https://postmarkapp.com/terms-of-service/) **[excerpt-only]**, [EmailQo](https://emailqo.com/aws-ses-vs-postmark) **[excerpt-only]**, [Puzzle Inbox](https://puzzleinbox.com/blog/postmark-vs-mailgun-cold-email-2026) **[excerpt-only]**.
- **Message Streams:** *Transactional* (receipts, password resets, subscriber-requested issues) and *Broadcast* (newsletters/announcements to opted-in lists). "Every message sent through a Broadcast Message Stream in Postmark is required to have an unsubscribe link"; if the `{{{ pm:unsubscribe }}}` placeholder is absent Postmark appends one automatically. Unsubscribe links are optional on Transactional streams. — [Why Broadcasts require an unsubscribe link](https://postmarkapp.com/support/article/1217-why-broadcasts-require-an-unsubscribe-link) **[excerpt-only]**, [How to add an unsubscribe link](https://postmarkapp.com/support/article/1208-how-to-add-an-unsubscribe-link) **[excerpt-only]**, [Message Streams](https://postmarkapp.com/message-streams) **[excerpt-only]**.

**Verdict:** Postmark is the right tool for (a) transactional mail — checkout receipts are sent by Paddle anyway, but account/magic-link/renewal notices go via a Transactional stream — and (b) the paid newsletter via a Broadcast stream (paying subscribers = permission). **Cold outreach on Postmark would breach the ToS and risk the account that delivers the paid product.** Never route outreach through it.

### 2.2 Compliant alternative for low-volume outreach

| Option | Cold outreach permitted? | Indicative cost | Notes |
|---|---|---|---|
| **Google Workspace mailbox + sequencing/warm-up tool** (recommended) | Yes — outreach is sent from a normal business mailbox; the tool automates sequences and warm-up. Google's own policy still forbids spam, so volume must stay low and complaint-free. | Workspace Business Starter ≈ US$7/user/mo **[unverified — confirm current price]**; tools below US$37–39/mo entry tiers | Best deliverability profile for hand-picked, human-written mail. |
| **Instantly** | Yes (built for it) | Hyper Growth **$37/mo**, Light Speed $97, custom $358+; flat fee, unlimited warm-up | Strong UX for a solo operator; 160M-contact database bundled (do **not** bulk-load it — see suppression rules). |
| **Smartlead** | Yes | Basic **$39/mo**, Pro $94, Custom $174+; unlimited inboxes and warm-up | Independent tests place it highest on inbox placement (~85%). |
| **Lemlist** | Yes | Email Outreach **$39/user/mo**, Multichannel $69, Enterprise $109+ | Per-seat pricing; strongest for heavy personalization and LinkedIn steps; lower measured inbox placement (~62%). |
| Microsoft 365 mailbox | Yes (same caveats as Google) | Business Basic ≈ US$6/user/mo **[unverified]** | Fine alternative; Outlook warm-up networks are smaller. |
| Amazon SES | Technically possible, but AUP requires consent-based sending; account suspensions common | Pay-per-mail | Not recommended. |

Sources: [Instantly vs Smartlead vs Lemlist 2026](https://instantly.ai/blog/instantly-vs-smartlead-lemlist-2026/) **[excerpt-only]**, [Puzzle Inbox 90-day test](https://puzzleinbox.com/blog/smartlead-vs-instantly-vs-lemlist-2026-three-way/) **[excerpt-only]**, [Sera AI cost comparison](https://www.seraleads.com/blogs/lemlist-vs-instantly-vs-smartlead-2026) **[excerpt-only]**. Prices are vendor-published entry tiers as of 2026 and change often.

**Recommended outreach architecture**

1. **Separate outreach domain** (e.g., `rarefree-intel.com` or `getrarefree.com`) that 301-redirects to the main site. Never send outreach from the newsletter/transactional domain (`rarefree.ai`/main brand) so that a spam complaint can never poison Postmark delivery of the paid product.
2. **2 mailboxes on the outreach domain**, warmed for 2–3 weeks before first real send, then capped at ~30 outreach mails/day each (~1,200/month capacity — more than the account-based plan needs).
3. **Authentication on both domains:** SPF (`v=spf1 include:_spf.google.com include:spf.mtasv.net -all` — Postmark's include is `spf.mtasv.net`; confirm in the Postmark DNS panel), DKIM 2048-bit for each sending service, **DMARC** starting `p=none; rua=mailto:dmarc@…` and moving to `p=quarantine` after 4 clean weeks; BIMI optional. Google/Yahoo bulk-sender rules (Feb 2024) require SPF+DKIM alignment, DMARC, one-click unsubscribe and <0.3% spam rate for senders above 5,000/day — adopt them anyway. — [Google sender guidelines](https://support.google.com/a/answer/81126) **[unverified — not fetched this session]**.
4. **One suppression list shared** by the outreach tool, Postmark and the CRM (see §7).

---

## 3. Paddle as Merchant of Record

### 3.1 Model and fees

- Paddle is the **Merchant of Record**: it is the legal seller to the end customer, collects and remits VAT/GST/sales tax in ~all jurisdictions, handles chargebacks/fraud and issues customer invoices; RareFree sells to Paddle (a cross-border B2B supply, reverse-charged in the UK) and receives a net payout. — [How Paddle handles VAT](https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf) **[excerpt-only]**, [Should I charge Paddle VAT on payouts?](https://www.paddle.com/help/manage/get-paid/should-i-charge-paddle-vattax-for-payouts) **[excerpt-only]**.
- **Fee:** **5% + US$0.50 per transaction** on the standard plan, bundling processing, tax, fraud and chargebacks; enterprise pricing is negotiated. Effective cost rises with FX conversion on payouts; the fixed $0.50 hurts sub-$10 prices (irrelevant for a $-hundreds/month B2B product). — [Paddle pricing](https://www.paddle.com/pricing) **[blocked — fee confirmed by**  [StackScored](https://www.stackscored.com/pricing/saas-billing/paddle/), [Dodo Payments analysis](https://dodopayments.com/blogs/paddle-fees-explained), [DEV review](https://dev.to/onsen/paddle-review-2026-pros-cons-pricing-explained-4cgk) **excerpt-only]**.
- Implication for the Brazilian entity: because Paddle is the seller of record to the customer, **RareFree's single customer is Paddle Ltd (UK) / Paddle.com Inc (US)** for invoicing purposes. The NFS-e (see §5) is issued to Paddle for the net payout as an export of services, not to each subscriber. Confirm with the accountant whether to invoice gross with Paddle's fee as a cost, or net — practice among Brazilian Paddle sellers is to invoice the payout amount **[unverified — accountant]**.

### 3.2 Seller country eligibility — Brazil

- Paddle's help article "Which countries are supported by Paddle?" states that **Paddle supports sellers and can pay out anywhere in the world except sanctioned countries**, and Brazil appears in the supported list. — [Paddle help: supported countries](https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle) **[excerpt-only]**.
- Caveats: (i) the developer page [Supported countries](https://developer.paddle.com/concepts/sell/supported-countries-locales/) concerns *buyer* countries and locales, not seller eligibility — do not confuse the two; (ii) Paddle vets each seller's business and product (newsletters/information products are generally accepted as "digital goods/SaaS", but Paddle rejects some content categories) — expect a manual review during onboarding; (iii) payouts to a **Brazilian bank in BRL** are not mentioned; plan to receive **USD** into Wise or Payoneer (see §4). **Action:** confirm in writing with Paddle sales before building on it.

### 3.3 Payouts

- Methods: **bank transfer (local rails or SWIFT), PayPal, Payoneer**. Paddle adds no payout fee; bank/intermediary fees apply. When payout currency ≠ the bank's local currency the transfer goes via SWIFT. Minimum payout threshold **$100** (adjustable up to $100k). Schedule per help center excerpt: payout created on the 1st and sent by the 15th (monthly); some third-party sources say weekly — **[conflict; confirm in dashboard]**. — [When and how do I get paid?](https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid) **[excerpt-only]**, [Is there a fee for payouts?](https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts) **[excerpt-only]**.
- Practical route: Paddle → USD via US ACH/wire to **Wise Business USD account details** or **Payoneer USD receiving account** → convert to BRL when needed.

### 3.4 B2B invoicing features

- **Tax IDs / reverse charge:** at checkout the buyer can enter a VAT/GST number; Paddle validates and removes VAT (EU reverse charge, UK, AU, etc.). Sales-tax-exempt US buyers submit exemption certificates. — [How does sales tax exemption work?](https://www.paddle.com/help/sell/tax/how-does-sales-tax-exemption-work) **[excerpt-only]**, [Which countries does Paddle charge tax for?](https://www.paddle.com/help/sell/tax/which-countries-does-paddle-charge-sales-tax-or-vat-for) **[excerpt-only]**.
- **Customer invoices:** Paddle issues compliant invoices/receipts for every transaction and exposes them via API and the customer portal (Paddle's `billing-history` skill lists invoice links). — [paddle-agent-skills README](https://github.com/PaddleHQ/paddle-agent-skills/blob/main/README.md).
- **Manual invoicing / purchase orders (enterprise):** Paddle Billing supports **invoice (manual collection mode) transactions** — you create a transaction with `collection_mode: manual`, Paddle e-mails an invoice with bank-transfer details, and the subscription activates on payment; the Invoicing tool lets you enter the customer's tax ID and PO reference. — [Paddle Invoicing](https://www.paddle.com/billing/invoicing) **[excerpt-only; PO-number field unverified]**.
- **Business entities on customers:** the `businesses` API object stores company name, tax identifier and address for B2B invoices **[unverified — from author's knowledge of Paddle Billing API]**.

### 3.5 Subscription API, webhooks, sandbox (verified from Paddle's official agent-skills repo)

- Events to subscribe: `customer.created/updated`, `subscription.created/updated/canceled`, optionally `transaction.completed`, `subscription.activated`.
- **Delivery is at-least-once**; success = any 2xx **within 5 seconds**; anything else is retried. Retries reuse the **same `event_id`** with fresh signature timestamps. **Sandbox: 3 attempts over ~15 min; Live: 60 attempts over ~3 days** with exponential backoff. No status code stops retries.
- **Signature:** `Paddle-Signature` header, HMAC-SHA256 over the **raw body**; SDK `paddle.webhooks.unmarshal(rawBody, secret, signature)`; reject stale timestamps (>5 min).
- **Idempotency:** UPSERT keyed on `subscription.id`/`customer.id` for state; keep an **`event_id` ledger** for non-idempotent side effects (sending e-mails, granting access). `subscription.updated` may arrive before `subscription.created`; upserts make ordering irrelevant.
- **Sandbox:** dashboard `sandbox-vendors.paddle.com`, API `sandbox-api.paddle.com`, keys prefixed `pdl_sdbx_`; test cards `4242 4242 4242 4242` (success), `4000 0038 0000 0446` (3DS), `4000 0000 0000 0002` (decline), `4000 0027 6000 3184` (renewal decline for dunning); webhook simulator for single events and multi-event scenarios; no payouts, adjustments auto-approved, domains auto-approved.
- Sources: [webhooks SKILL.md](https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/webhooks/SKILL.md), [subscription-sync SKILL.md](https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/subscription-sync/SKILL.md), [sandbox-testing SKILL.md](https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/sandbox-testing/SKILL.md), [How webhooks work](https://developer.paddle.com/webhooks/about/how-webhooks-work/) **[blocked]**.

### 3.6 Fallback MoRs if Paddle declines the Brazilian entity

| MoR | Brazil as seller? | Fee (published) | Notes / source |
|---|---|---|---|
| **Dodo Payments** | **Yes** — Brazil listed among supported merchant countries | 4% + $0.40 (+1.5% international, +0.5% subscriptions) | [supportedcountries.com — Dodo](https://supportedcountries.com/dodo-payments/) **[excerpt-only]**, [Dodo MoR pricing comparison](https://dodopayments.com/blogs/cheapest-merchant-of-record) **[excerpt-only]** |
| **Polar.sh** | **Likely no** — payouts via Stripe Connect Express, so only Stripe-Connect countries; Brazil is not a Stripe Connect Express payout country | 4% + $0.40 **[verify]** | [Polar supported countries](https://polar.apidocumentation.com/documentation/polar-as-merchant-of-record/supported-countries) **[blocked]**, [Polar on X](https://x.com/polar_sh/status/1915379610809782428) **[excerpt-only]** |
| **Lemon Squeezy / Stripe Managed Payments** | **Unclear** — Lemon Squeezy pays out to 79 countries (bank) and PayPal; Stripe Managed Payments covers 35+ merchant countries; Brazil not confirmed either way | LS 5% + $0.50; SMP fees per Stripe | [LS supported countries](https://docs.lemonsqueezy.com/help/getting-started/supported-countries) **[blocked]**, [LS 2026 update](https://www.lemonsqueezy.com/blog/2026-update) **[blocked]**, [LS bank payouts to 79 countries](https://www.lemonsqueezy.com/blog/new-bank-payouts) **[excerpt-only]** |
| **Creem** | Claims ~100 merchant countries; Brazil not confirmed | 3.9% + $0.40 **[verify]** | [Creem supported countries](https://docs.creem.io/merchant-of-record/supported-countries) **[blocked]** |
| **FastSpring** | Historically global incl. LatAm sellers; custom pricing (~5.9% + $0.95 list) **[unverified]** | Custom | Enterprise-oriented; good for PO/invoice billing |
| **Gumroad** | Payouts to Brazil via PayPal/Payoneer historically **[unverified]** | 10% + processing | Not suited to B2B invoicing |
| **Stripe Brazil (direct, not MoR)** | Yes, Stripe operates in Brazil, but a Brazilian Stripe account settles in **BRL only**, cannot charge in USD without conversion, and you become responsible for foreign VAT registration (EU OSS, UK, JP, KR) — defeats the purpose | 3.99% + R$0.39 domestic, +2% international **[verify]** | Not recommended for this business |

Order of preference: **Paddle → Dodo Payments → FastSpring → Lemon Squeezy (if confirmed)**.

---

## 4. Receiving USD in Brazil — Wise Business and alternatives

### 4.1 Wise Business for a Brazilian CNPJ

- **Eligibility:** active CNPJ; legal types **Empresário Individual (incl. MEI), Sociedade Limitada / SLU, Sociedade Unipessoal de Advocacia**; the company **owner must be the same person as the Wise personal account holder** (multi-owner onboarding is restricted). — [Wise Help: open a Wise account for my Brazilian business](https://wise.com/help/articles/7hdqRgpo7Otr84XRtMBdqv/how-do-i-open-a-wise-account-for-my-brazilian-business) **[excerpt-only]**.
- **Currencies:** hold **40+ currencies including USD**; receive with local account details in USD (ACH/wire), EUR (IBAN), GBP and others. Annual receiving limit on business USD balances up to US$150M per Wise BR blog. — [Wise BR: receber na conta PJ](https://wise.com/br/blog/receber-wise-pj) **[excerpt-only]**, [Wise BR: Wise para empresas](https://wise.com/br/blog/wise-para-empresas-brasil) **[excerpt-only]**.
- **Cost:** one-off **R$250 activation**, no monthly fee; conversion at mid-market + Wise fee; Brazilian IOF applies on conversions to BRL. — [Wise BR business pricing](https://wise.com/br/pricing/business) **[excerpt-only]**.
- **Limits/restrictions:** transfers **from BRL** capped at **US$5,000 equivalent per transfer** (business); BRL balances are handled by Wise Pagamentos under Brazilian payment-institution rules and BRL cannot be held like other balances (see Wise "Holding money if you live in Brazil") **[excerpt-only — confirm]**. Wise Pagamentos Brasil Ltda (CNPJ 40.571.694/0001-31) is the regulated entity. — [Wise Customer Agreement Brazil](https://wise.com/br/legal/terms-of-use-wise-pagamentos-en) **[excerpt-only]**.
- **Fit:** good for receiving Paddle USD payouts and paying USD SaaS vendors (Postmark, OpenAI/Anthropic, outreach tool) without converting; converting to BRL creates the FX record the accountant needs (Wise provides the "comprovante de câmbio").

### 4.2 Alternatives

| Provider | What it is | Brazil business fit | Cost signals | Source |
|---|---|---|---|---|
| **Payoneer** | Global receiving accounts (USD/EUR/GBP + BRL); Paddle pays to Payoneer natively | Yes; local BRL withdrawals via partner bank (Banco Inter) | Up to **2% FX** on USD→BRL withdrawals; receiving fees vary by source; $20–30 intermediary fees on wires | [Payoneer receiving accounts](https://www.payoneer.com/receiving-accounts/) **[excerpt-only]**, [Airtm — Payoneer in Brazil](https://www.airtm.com/en/blog/digital-entrepreneurship/payoneer-in-brazil/) **[excerpt-only]** |
| **Husky (by Nomad)** | Brazilian fintech; multi-currency account with IBAN/SWIFT for CNPJ; auto-converts to BRL and settles in your Brazilian bank | Purpose-built for Brazilian service exporters | Spread on commercial rate; no USD holding (auto-convert) | [Husky](https://www.husky.io/) **[excerpt-only]**, [Nomad — Husky by Nomad](https://www.nomadglobal.com/conteudos/o-que-e-husky-by-nomad) **[excerpt-only]** |
| **Remessa Online** | Regulated FX broker/remittance; receives international payments for CNPJ and issues contrato de câmbio | Yes; strong on export-of-services paperwork | ~1–2% fee + IOF | [Remessa Online — impostos exportação Simples](https://www.remessaonline.com.br/blog/quais-sao-os-impostos-que-incidem-sobre-exportacao-simples-nacional/) **[excerpt-only]** |
| **Nomad Business** | Nomad's CNPJ account (USD account in the US via partner bank) | Yes; holds USD | Fees per plan **[unverified]** | [Nomad](https://www.nomadglobal.com/) **[unverified]** |
| **Banco Inter Empresas / BS2** | Brazilian banks with international-receipt products (Inter partners with Payoneer; BS2 has a corporate FX desk) | Yes | Bank FX spread | **[unverified — confirm current products]** |

**Recommendation:** open **Wise Business (primary)** and **Payoneer (backup and Paddle-native)**; keep Remessa Online/Husky as the conversion channel if Wise's BRL constraints bite. Regardless of channel, every USD receipt must be matched to an NFS-e and a contrato de câmbio (or the provider's equivalent) for the accountant.

---

## 5. Brazilian service-export tax and invoicing (Simples Nacional ME/EPP)

| Topic | Rule | Source |
|---|---|---|
| **Definition of service export** | LC 116/2003 art. 2, I: ISS does not apply to exports of services; *parágrafo único*: it **does** apply when the service is developed in Brazil and its **result occurs here**, even if paid from abroad. A newsletter consumed by a foreign company, with the customer's benefit realized abroad, is the classic "resultado no exterior" case — document it (contract, foreign address, foreign payment). | [Colinear — exportação de serviços no Simples](https://colinear.com.br/exportacao-de-servicos-com-simples-nacional-guia-para-devs/) **[excerpt-only]**; [Art Data Contábil](https://www.artdatacontabil.com.br/exportacao-servicos-simples-nacional/) **[excerpt-only]** |
| **Taxes removed from the DAS on export revenue** | LC 123/2006 art. 18 §14 (as amended by LC 147/2014, effective 1 Jan 2015): export revenue is taxed in the DAS **without PIS, COFINS, IPI, ICMS and ISS**; **IRPJ and CSLL remain** (and CPP if applicable). | [Receita — Manual PGDAS-D](https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/manual_pgdas-d_2018_v4.pdf) **[excerpt-only]**; [Remessa Online](https://www.remessaonline.com.br/blog/quais-sao-os-impostos-que-incidem-sobre-exportacao-simples-nacional/) **[excerpt-only]** |
| **PGDAS-D** | Export revenue must be **segregated** each month in the specific "Receitas de exportação de serviços" field; otherwise the system taxes it as domestic. | [Grupo Módulos — PGDAS-D](https://grupomodulos.com.br/centraldeajuda/pgdas-d-simples-nacional/) **[excerpt-only]**; [Contabilidade Cidadã](https://contabilidadecidada.com.br/pgdas-do-simples-nacional/) **[excerpt-only]** |
| **Revenue cap and export sub-limit** | LC 123 art. 3 §14: up to **R$4.8M** domestic revenue **plus, separately, up to R$4.8M** export revenue per calendar year; the two limits are assessed independently and **not** summed into a R$9.6M single cap. Note the R$3.6M state/municipal sub-limit for ICMS/ISS (irrelevant while revenue is export-only, but relevant if domestic sales start). | [LC 123/2006 text](https://www.comprasnet.gov.br/legislacao/leis/lei123_2006.htm) **[excerpt-only]**; [SP Resposta à Consulta 17596/2018](https://legislacao.fazenda.sp.gov.br/Paginas/RC17596_2018.aspx) **[excerpt-only]** |
| **NFS-e** | Municipal competence; issue an NFS-e to the foreign customer (Paddle) with **natureza da operação / tributação = exportação**, ISS not withheld; municipalities vary in required fields (many accept "tomador no exterior" with country only). With the new **NFS-e Nacional** standard (2023+) the padrão nacional supports a foreign tomador natively **[unverified — confirm your município's adoption]**. | [NFe.io — cliente domiciliado no exterior](https://nfe.io/docs/documentacao/nota-fiscal-servico-eletronica/duvidas/cenarios-de-emissao/cliente-exterior/) **[excerpt-only]**; [NFe.io — nota fiscal de exportação](https://nfe.io/blog/nota-fiscal/nota-fiscal-de-exportacao-como-emitir-para-servicos-e-produtos-para-o-exterior/) **[excerpt-only]** |
| **NFe.io** | REST API (`POST /v1/companies/{id}/serviceinvoices`; docs describe `/nfse/emissao` JSON flow) with per-city integrations; for foreign borrowers, address fields normally mandatory become **optional**, and `taxationType` is set to the export value; PDF+XML e-mailed to the customer automatically; webhooks on issuance. Recommended by NFe.io itself: confirm with an accountant that the service qualifies as export before configuring. | [NFe.io NFS-e](https://nfe.io/nota-fiscal-de-servico-eletronica/) **[excerpt-only]**; [NFe.io primeiros passos](https://nfe.io/docs/nota-fiscal-servico/integracao-nfs-e) **[excerpt-only]** |
| **SISCOSERV** | Reporting obligation **suspended 1 Jul–31 Dec 2020 (Portaria Conjunta SECINT/RFB 25/2020)** and **extinguished by Portaria Conjunta SECINT/RFB nº 22.091 of 21 Oct 2020**. No replacement filing for service exporters (statistics now drawn from FX and tax data). | [SINDCONT-SP](https://www.sindcontsp.org.br/obrigatoriedade-de-entrega-do-siscoserv-e-extinta/) **[excerpt-only]**; [Vieira Rezende](https://www.vieirarezende.com.br/newsletter/portaria-extingue-o-siscoserv) **[excerpt-only]**; [gov.br Siscomex notice](https://www.gov.br/siscomex/pt-br/informacoes/ministerio-da-economia-anuncia-desligamento-definitivo-do-siscoserv-2014-portugues-brasil.pdf) **[excerpt-only]** |
| **FX and receipts** | Each USD receipt converted to BRL generates a contrato de câmbio (or simplified equivalent) via the bank/fintech; under Lei 14.286/2021 exporters may keep export proceeds abroad (e.g., in a Wise USD balance) **[unverified — confirm with accountant]**; keep the Paddle payout statement + NFS-e + FX receipt as the evidentiary trio. | [Remessa Online](https://www.remessaonline.com.br/blog/quais-sao-os-impostos-que-incidem-sobre-exportacao-simples-nacional/) **[excerpt-only]** |
| **CNAE / Simples annex** | Information/newsletter services usually fall under Anexo III or V depending on the "fator r" (payroll ratio); a low-payroll company may land in Anexo V (15.5% starting rate). Engage the accountant on CNAE choice (e.g., 6319-4/00 portais/provedores de conteúdo, 7320-3/00 pesquisas de mercado) **[unverified]**. | — |

---

## 6. Redistributing patent data and quoting content

| Issue | Position | Source |
|---|---|---|
| **US patents (text, claims, abstracts, drawings)** | USPTO: "the text and drawings of a patent are typically not subject to copyright restrictions", subject to 37 CFR 1.71(d)/(e) and 1.84(s) (an applicant may include a copyright notice on limited material such as code listings/mask works). Quoting abstracts and claims, and full-text redistribution, is therefore permissible in the US; the patent *right* itself is unaffected by copying the document. | [USPTO Terms of Use](https://www.uspto.gov/terms-use-uspto-websites) **[excerpt-only]** |
| **EPO / Espacenet** | Access is free, but Espacenet's terms state it "is not intended to be a source for bulk downloads"; there is a Fair Use Charter and separate Terms for automated retrieval (OPS). Commentators describe it as "open access, not open licence": reading is free, systematic re-publication of *EPO-curated* data (bibliographic databases, machine translations, classification data) may need an arrangement. EU sui generis **database right** (Directive 96/9/EC) can protect EPO's compilation even though individual documents are public. **Mitigation:** quote individual abstracts/claims with citation (unlikely to be "substantial extraction"), pull bulk data via **OPS under its fair-use terms** or **Google Patents Public Datasets (BigQuery, CC-BY 4.0)**, and never mirror Espacenet. | [Espacenet limitations](https://worldwide.espacenet.com/help?method=handleHelpTopic&topic=limitations) **[excerpt-only]**; [Espacenet disclaimer](https://worldwide.espacenet.com/?locale=en_EP&view=disclaimer) **[blocked]**; [RAG Repo — EPO OPS notes](https://rag-repo.org/source/epo-espacenet/) **[excerpt-only]**; Google Patents Public Data licence **[unverified — confirm CC-BY on BigQuery dataset page]** |
| **JPO, KIPO, CNIPA, INPI-BR documents** | Official patent publications are government documents; national copyright treatment varies (Japan: laws/official notices excluded from copyright, but original expression in specifications arguably belongs to applicants; practice universally tolerates quotation with citation). Quote abstracts/claims with citation and link to the office record; avoid re-hosting full PDFs from those offices. **[unverified — lawyer review]** | — |
| **Machine translations** | EPO/Google Patents machine translations carry their own terms (EPO: for information only, not for redistribution). Produce your own summaries in English rather than republishing office MT text. | Espacenet disclaimer **[blocked]** |
| **Assignee / company names** | Naming assignees (Proterial, Niron Magnetics, Toyota, etc.) in factual reporting is **nominative/descriptive use**; not trademark infringement as long as you don't imply endorsement or use logos as branding. Add a footer disclaimer: "All company names and trademarks belong to their owners; RareFree Intelligence is independent and not affiliated." Never use assignee logos in marketing. Avoid characterizations that could be defamatory (e.g., "infringing", "stolen") — stick to "claims", "cites", "filed". | General trademark law — **[no URL; lawyer review]** |
| **Analytical content** | Your own analysis, rankings, landscape maps and commentary are your copyright; state licence terms in ToS (single-seat vs team licence; no redistribution outside the subscribing company). | — |
| **Data-protection angle** | Inventor names in patents are public record; including them in analysis is legitimate interest/journalistic-style use; do not build inventor contact lists from patents for outreach (that becomes prospecting under GDPR/LGPD/PIPA). | — |

---

## 7. Guardrails checklist for the autonomous agent

### Billing (Paddle)
- [ ] Verify `Paddle-Signature` (HMAC-SHA256 over raw body) on every webhook; reject if timestamp older than 5 minutes.
- [ ] `event_id` ledger table (unique index) — insert before side effects; skip if exists. Reason: at-least-once delivery with up to **60 retries over ~3 days** in live.
- [ ] UPSERT customers/subscriptions by Paddle ID; never rely on event order.
- [ ] Return 200 within 5 seconds; enqueue heavy work.
- [ ] Before any API write (create customer, create transaction, cancel, refund) query for an existing resource by external reference (`custom_data.internal_id`) — Paddle Billing does not offer Stripe-style idempotency keys on all endpoints **[unverified — check API reference; if present, always send one]**.
- [ ] Refunds/credits and subscription cancellations require a human approval flag in the ops queue; the agent may *propose* only.
- [ ] Sandbox and live use different keys/secrets stored in separate environment scopes; CI runs only against `sandbox-api.paddle.com`.
- [ ] Reconcile monthly: Paddle payout report ↔ Wise/Payoneer receipt ↔ NFS-e issued ↔ PGDAS-D export field.

### Spend caps
- [ ] Hard monthly caps set in each vendor console: Postmark plan tier, LLM API budget with alerting at 50/80/100%, outreach tool seat count, NFe.io invoice quota, cloud budget alerts.
- [ ] Agent cannot change payment methods, add seats, or upgrade plans; those actions are behind a human approval step.
- [ ] Daily send caps: outreach ≤30/mailbox/day; Broadcast sends only to `status = active_subscriber`.

### Mandatory unsubscribe / consent
- [ ] Every Broadcast (Postmark) contains `{{{ pm:unsubscribe }}}` plus `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click` headers.
- [ ] Every outreach e-mail contains plain-text opt-out + physical address + identification block (§1.3).
- [ ] Unsubscribe processed automatically within 24 h; audit log retained.
- [ ] Country gate blocks DE/AT/IT/KR/CN cold sends unless `consent_evidence` is present on the contact.
- [ ] Consent/opt-out evidence (source URL screenshot, timestamp, message ID) retained 3 years.

### Do-not-contact list
- [ ] Single suppression store (SHA-256 of lower-cased e-mail + optional domain-level flag) queried by the outreach tool, Postmark webhook handler and CRM before every send.
- [ ] Sources merged in: unsubscribe clicks, "unsubscribe" replies (NLP-classified then human-confirmed if ambiguous), spam complaints (Postmark bounce/complaint webhooks), bounces (hard), manual requests, competitors' and regulators' domains.
- [ ] Suppression is permanent unless the person re-opts-in via a double-opt-in form.
- [ ] Never import purchased lists; every contact record must carry `source_url` and `qualification_note`.

### Data retention and privacy
- [ ] Prospects with no reply: delete personal data **12 months** after last touch (LIA-proportionate); keep only hashed e-mail in suppression list.
- [ ] Subscribers: keep account data for the contract + **5 years** (Brazilian tax statute of limitations for invoices/receipts) then anonymize; billing records mirror Paddle's retention.
- [ ] Logs with personal data: 90 days.
- [ ] Data map + Privacy Notice covers: Paddle (MoR), Postmark (mail), Wise/Payoneer (finance), NFe.io (fiscal), outreach tool, LLM provider (no personal data sent to LLMs except with a DPA; strip e-mail addresses before summarization).
- [ ] Designate LGPD *encarregado* (DPO) contact on the site; GDPR art. 27 EU representative is required for a non-EU controller regularly processing EU data — assess once EU subscribers exceed occasional volume **[lawyer review]**.
- [ ] DPIA/LIA documents versioned in the repo alongside this file.

### Content
- [ ] Every patent quote carries publication number, office and link; no full-text mirroring of EPO/JPO/KIPO PDFs; no office machine translations republished.
- [ ] Trademark disclaimer in footer; no assignee logos.
- [ ] Human review before publishing any statement characterizing a company's legal position (infringement, validity).

---

## 8. Open items for humans (in priority order)

1. **Paddle:** written confirmation that a Brazilian Simples Nacional company is accepted as seller and of payout method to a Wise/Payoneer USD account; ask whether PO-number and manual-invoice (collection_mode manual) features are on the standard plan.
2. **Accountant:** CNAE/annex choice; confirm "resultado no exterior" position for a newsletter; NFS-e template for foreign tomador in your município; invoicing Paddle net vs gross; treatment of Paddle fee as expense; FX/proceeds-abroad policy under Lei 14.286/2021.
3. **Lawyer:** ToS licence scope (seat-based), Privacy Notice covering legitimate-interest prospecting, LIA templates (GDPR + LGPD), GDPR art. 27 representative need, EPO database-right exposure for any bulk feature.
4. **Wise:** confirm the exact restrictions on Brazilian business accounts (BRL balance, per-transfer caps, USD account details availability) at signup — the blocked help article is the primary source.
5. **Markets:** decide whether to invest in consent-first funnels (webinar, whitepaper opt-in) for Germany, Japan and Korea, where cold e-mail is off the table.

---

## Sources

Primary/official (fetched or excerpt-only as marked above):
- Paddle — Which countries are supported: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- Paddle — Supported (buyer) countries and locales: https://developer.paddle.com/concepts/sell/supported-countries-locales/
- Paddle — Pricing: https://www.paddle.com/pricing
- Paddle — When and how do I get paid: https://www.paddle.com/help/manage/get-paid/when-and-how-do-i-get-paid
- Paddle — Is there a fee taken for payouts: https://www.paddle.com/help/manage/get-paid/is-there-a-fee-taken-for-payouts
- Paddle — How Paddle handles VAT: https://www.paddle.com/help/sell/tax/how-paddle-handles-vat-on-your-behalf
- Paddle — Sales tax exemption: https://www.paddle.com/help/sell/tax/how-does-sales-tax-exemption-work
- Paddle — Countries where tax is charged: https://www.paddle.com/help/sell/tax/which-countries-does-paddle-charge-sales-tax-or-vat-for
- Paddle — Should I charge Paddle VAT on payouts: https://www.paddle.com/help/manage/get-paid/should-i-charge-paddle-vattax-for-payouts
- Paddle — Invoicing: https://www.paddle.com/billing/invoicing
- Paddle — How webhooks work: https://developer.paddle.com/webhooks/about/how-webhooks-work/
- PaddleHQ agent skills (README, webhooks, subscription-sync, sandbox-testing): https://github.com/PaddleHQ/paddle-agent-skills/blob/main/README.md · https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/webhooks/SKILL.md · https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/subscription-sync/SKILL.md · https://github.com/PaddleHQ/paddle-agent-skills/blob/main/skills/sandbox-testing/SKILL.md
- Postmark — Terms of Service: https://postmarkapp.com/terms-of-service/
- Postmark — Message Streams: https://postmarkapp.com/message-streams
- Postmark — Why Broadcasts require an unsubscribe link: https://postmarkapp.com/support/article/1217-why-broadcasts-require-an-unsubscribe-link
- Postmark — How to add an unsubscribe link: https://postmarkapp.com/support/article/1208-how-to-add-an-unsubscribe-link
- Wise — Open a Wise account for my Brazilian business: https://wise.com/help/articles/7hdqRgpo7Otr84XRtMBdqv/how-do-i-open-a-wise-account-for-my-brazilian-business
- Wise — Holding money if you live in Brazil: https://wise.com/help/articles/7cUlHeJwqj6AHM69S8qRCA/holding-money-if-you-live-in-brazil
- Wise — Customer Agreement (Brazil): https://wise.com/br/legal/terms-of-use-wise-pagamentos-en
- Wise BR — Receber na conta PJ: https://wise.com/br/blog/receber-wise-pj · Wise para empresas: https://wise.com/br/blog/wise-para-empresas-brasil · Business pricing: https://wise.com/br/pricing/business
- FTC — CAN-SPAM compliance guide: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
- CRTC — CASL implied-consent guidance: https://crtc.gc.ca/eng/com500/guide.htm · CASL FAQ: https://crtc.gc.ca/eng/com500/faq500.htm
- ISED — Getting consent to send email: https://ised-isde.canada.ca/site/canada-anti-spam-legislation/en/getting-consent-send-email
- ICO — Electronic mail marketing (PECR): https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/electronic-and-telephone-marketing/electronic-mail-marketing/ · Choosing your lawful basis: https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/sending-direct-marketing-choosing-your-lawful-basis/
- ANPD — Guia Orientativo Legítimo Interesse: https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-lanca-guia-orientativo-sobre-legitimo-interesse
- Japan — Anti-Spam Act (English translation): https://www.japaneselawtranslation.go.jp/en/laws/view/3767/en · ASCT: https://www.japaneselawtranslation.go.jp/en/laws/view/3340/en · Dekyo English guidelines: https://www.dekyo.or.jp/soudan/contents/antispam/data/en/EN_Guidelines_of_Japanese_anti-spam_law.pdf
- DLA Piper — Electronic marketing, Korea: https://www.dlapiperdataprotection.com/index.html?t=electronic-marketing&c=KR · Japan: https://www.dlapiperdataprotection.com/?t=electronic-marketing&c=JP
- DataGuidance — KISA revised spam guide: https://www.dataguidance.com/news/south-korea-kisa-publishes-revised-guide-information
- USPTO — Terms of use: https://www.uspto.gov/terms-use-uspto-websites
- Espacenet — Limitations: https://worldwide.espacenet.com/help?method=handleHelpTopic&topic=limitations · Disclaimer/terms: https://worldwide.espacenet.com/?locale=en_EP&view=disclaimer
- Receita Federal — Manual PGDAS-D: https://www8.receita.fazenda.gov.br/simplesnacional/arquivos/manual/manual_pgdas-d_2018_v4.pdf
- LC 123/2006 (text): https://www.comprasnet.gov.br/legislacao/leis/lei123_2006.htm
- SEFAZ-SP Resposta à Consulta 17596/2018 (export sub-limit): https://legislacao.fazenda.sp.gov.br/Paginas/RC17596_2018.aspx
- gov.br Siscomex — desligamento definitivo do Siscoserv: https://www.gov.br/siscomex/pt-br/informacoes/ministerio-da-economia-anuncia-desligamento-definitivo-do-siscoserv-2014-portugues-brasil.pdf
- NFe.io — Cliente domiciliado no exterior: https://nfe.io/docs/documentacao/nota-fiscal-servico-eletronica/duvidas/cenarios-de-emissao/cliente-exterior/ · NFS-e product: https://nfe.io/nota-fiscal-de-servico-eletronica/ · Primeiros passos: https://nfe.io/docs/nota-fiscal-servico/integracao-nfs-e · Nota fiscal de exportação: https://nfe.io/blog/nota-fiscal/nota-fiscal-de-exportacao-como-emitir-para-servicos-e-produtos-para-o-exterior/
- Google — Email sender guidelines: https://support.google.com/a/answer/81126

Secondary (fetched: EmailOctopus repo; others excerpt-only):
- EmailOctopus email-marketing-regulations repo: README https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/README.md · USA https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/usa.md · UK https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/uk.md · Canada https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/canada.md · Germany https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/germany.md · Brazil https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/brazil.md · Japan https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/japan.md · China https://github.com/threeheartsdigital/email-marketing-regulations/blob/main/country/china.md
- Overloop — Germany: https://overloop.com/blog/b2b-cold-email-germany-gdpr-compliance · Is cold email illegal: https://overloop.com/blog/cold-email-illegal
- Asphia — Cold email GDPR Europe 2026: https://asphia.consulting/blog/cold-email-gdpr-europe-2026/
- Quarvio — Cold email and GDPR: https://www.quarvio.io/blog/cold-email-gdpr-guide
- Scrap.io — GDPR cold email B2B: https://scrap.io/gdpr-cold-email-b2b
- Monolith Law — Japan Specified Electronic Mail Act: https://monolith.law/en/it/onlineshop-email-act-protection-of-personal-information
- imisofts — Cold email laws South Korea: https://imisofts.com/blog/cold-email-laws-south-korea/
- Globig — China email marketing law: https://platform.globig.co/knowledgebase/CN/marketing-and-regulations-china/email-marketing-law-in-china
- eesier — Cold email e LGPD: https://eesier.com.br/cold-email-lgpd
- EmailQo — AWS SES vs Postmark: https://emailqo.com/aws-ses-vs-postmark · Puzzle Inbox — Postmark vs Mailgun: https://puzzleinbox.com/blog/postmark-vs-mailgun-cold-email-2026
- Instantly — Instantly vs Smartlead vs Lemlist 2026: https://instantly.ai/blog/instantly-vs-smartlead-lemlist-2026/ · Puzzle Inbox 90-day test: https://puzzleinbox.com/blog/smartlead-vs-instantly-vs-lemlist-2026-three-way/ · Sera AI: https://www.seraleads.com/blogs/lemlist-vs-instantly-vs-smartlead-2026
- StackScored — Paddle pricing: https://www.stackscored.com/pricing/saas-billing/paddle/ · Dodo — Paddle fees explained: https://dodopayments.com/blogs/paddle-fees-explained · Dodo — Cheapest MoR: https://dodopayments.com/blogs/cheapest-merchant-of-record · DEV — Paddle review 2026: https://dev.to/onsen/paddle-review-2026-pros-cons-pricing-explained-4cgk
- supportedcountries.com — Dodo Payments: https://supportedcountries.com/dodo-payments/ · Polar supported countries: https://polar.apidocumentation.com/documentation/polar-as-merchant-of-record/supported-countries · Polar on X: https://x.com/polar_sh/status/1915379610809782428 · Creem: https://docs.creem.io/merchant-of-record/supported-countries · Lemon Squeezy supported countries: https://docs.lemonsqueezy.com/help/getting-started/supported-countries · LS 2026 update: https://www.lemonsqueezy.com/blog/2026-update · LS bank payouts: https://www.lemonsqueezy.com/blog/new-bank-payouts
- Payoneer receiving accounts: https://www.payoneer.com/receiving-accounts/ · Airtm — Payoneer in Brazil: https://www.airtm.com/en/blog/digital-entrepreneurship/payoneer-in-brazil/
- Husky: https://www.husky.io/ · Nomad — Husky by Nomad: https://www.nomadglobal.com/conteudos/o-que-e-husky-by-nomad
- Remessa Online — impostos exportação Simples: https://www.remessaonline.com.br/blog/quais-sao-os-impostos-que-incidem-sobre-exportacao-simples-nacional/ · Siscoserv: https://www.remessaonline.com.br/blog/desativacao-do-siscoserv-e-suas-implicacoes/
- Colinear — exportação de serviços Simples (devs): https://colinear.com.br/exportacao-de-servicos-com-simples-nacional-guia-para-devs/ · Art Data Contábil: https://www.artdatacontabil.com.br/exportacao-servicos-simples-nacional/ · Grupo Módulos PGDAS-D: https://grupomodulos.com.br/centraldeajuda/pgdas-d-simples-nacional/ · Contabilidade Cidadã: https://contabilidadecidada.com.br/pgdas-do-simples-nacional/
- SINDCONT-SP — Siscoserv extinto: https://www.sindcontsp.org.br/obrigatoriedade-de-entrega-do-siscoserv-e-extinta/ · Vieira Rezende: https://www.vieirarezende.com.br/newsletter/portaria-extingue-o-siscoserv · Thomson Reuters: https://www.thomsonreuters.com.br/pt/tax-accounting/comercio-exterior/blog/tudo-o-que-voce-precisa-saber-sobre-a-descontinuacao-do-siscoserv.html
- RAG Repo — EPO Espacenet/OPS notes: https://rag-repo.org/source/epo-espacenet/
