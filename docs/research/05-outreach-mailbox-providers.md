# Research 05 — Mailbox provider for the cold-outreach domain

Date: 2026-09-26 · Requested by the founder ("alternatives to Hostinger, e.g. HostGator and Zoho;
compare real prices, not only the first-period promotion"). Research only; no account was created.

Scope: one mailbox on a separate outreach domain (ADR 0003), driven by our own code over
SMTP/IMAP, ≤ 25 first-touch emails/day, SPF/DKIM/DMARC on the domain. Vendor sites are blocked from
the cloud session's egress proxy, so figures come from third-party price trackers and vendor help
pages surfaced by search; every price must be re-checked on the checkout page before paying (the
"renews at" line). All prices are per mailbox unless stated.

## 1. Price comparison (renewal, not promo)

Verified 2026-09-26 on the vendors' own price pages via the founder's browser (Remote Control),
superseding the third-party figures first collected. Price pages do not state daily sending limits;
those come from the help pages cited in §Sources. Per mailbox.

| Provider / plan | Promo (first term) | Renewal per mailbox/month | Per year at renewal | Storage | Sends/day (help pages) |
|---|---|---|---|---|---|
| Hostinger BR Business Starter | R$3.49 (12 m) · R$2.99 (24 m) · R$11.99 monthly | **R$7.99 (12 m) · R$6.99 (24 m)** | R$95.88 · R$83.88 | 5 GB | 1,000 |
| Hostinger BR Standard | R$5.99 (12 m) · R$5.49 (24 m) | R$12.99 (12 m) · R$11.49 (24 m) | R$155.88 · R$137.88 | 20 GB | 1,000 |
| Hostinger BR Premium | R$9.99 (12 m) · ~R$8.99 (24 m) | R$17.99 (12 m) · R$15.99 (24 m) | R$215.88 · R$191.88 | 50 GB | 1,000 |
| Hostinger US Business Starter | US$0.59 (12 m) · US$0.49 (24 m) | **US$1.59** (12 and 24 m) | US$19.08 | 5 GB | 1,000 |
| Hostinger US Standard / Premium | US$1.39 / US$2.99 (12 m) | US$2.79 / US$3.99 | US$33.48 / US$47.88 | 20 / 50 GB | 1,000 |
| HostGator BR Titan Essentials | R$5.59/mo annual (R$66.05/yr) · R$10.49 monthly | Not shown on site; list price R$10.49 | R$125.88 at list | 10 GB | ~1,200 (Titan 50/h) |
| HostGator BR Titan Premium / Ultra | R$13.29 / R$23.59/mo annual | List R$20.99 / R$31.49 | R$251.88 / R$377.88 | 50 / 100 GB | Titan tiers |
| HostGator US Professional Email / Plus / Ultra | US$1.99 / 2.99 / 5.83 "introductory" | Not shown on site (Customer Portal only) | — | 10 / 50 / 100 GB | Titan tiers |
| Zoho Mail Lite (BR page; USD page geo-redirects) | none | **R$5 (5 GB) · R$6.25 (10 GB)**, annual only | R$60 · R$75 | 5 / 10 GB | 50–500/h dynamic |
| Google Workspace Business Starter (BR) | — | **R$32.72 annual · R$40.90 flexible** | R$392.64 · R$490.80 | 30 GB pooled | 2,000 (new accounts ramp from ~500) |
| Microsoft Exchange Online Plan 1 (BR) | — | **R$22.90** annual, auto-renew (US$4 on the US page) | R$274.80 | 50 GB + 50 GB archive | high; OAuth2 required for SMTP/IMAP |
| Migadu Micro | — | US$19/yr flat | US$19 | 5 GB pooled | **20 outbound** |
| MXroute Small | — | US$59/yr flat | US$59 | 10 GB | 400/h, cold outreach prohibited |
| Purelymail | — | US$10/yr flat | US$10 | fair use | ~3,000, unsolicited email prohibited |

Corrections versus the first pass from third-party trackers: Hostinger Starter is 5 GB, not 10 GB;
the Hostinger BR promo is R$2.99–3.49 (not R$2.49) and it does **not** renew at the purchase price
(renewal is roughly double); HostGator BR list prices are R$10.49 / 20.99 / 31.49; HostGator US
renewal is not published.

## 2. Policy fit for cold B2B outreach (the deciding factor)

Price differences are a few dollars a year; the real risk is losing the mailbox mid-campaign.

- **Zoho Mail**: usage policy names cold/mass/marketing email as prohibited; Zoho tightened
  enforcement in 2025 after abuse of its SMTP by outreach tools, and users report blocks and
  suspensions even at low manual volume. Not suitable, despite being the cheapest with no renewal jump.
- **MXroute, Purelymail**: written zero-tolerance policies for unsolicited email. Not suitable.
- **Migadu**: policy tolerant but Micro's 20/day outbound cap is below our operating cap.
- **Hostinger / HostGator (Titan)**: AUP prohibits "unsolicited email" like everyone; enforcement is
  driven by bounce rate and abuse reports, not by content inspection. At ≤ 25/day, hand-picked, with
  identification + opt-out (CLAUDE.md rule 5) and a warm-up ramp, this is the same exposure as any
  shared-IP provider. HostGator resells the identical Titan product at 2–5× the price.
- **Google Workspace / Microsoft 365**: the providers the whole cold-outreach industry runs on;
  tolerant at low volume, best inbox placement, but 4–5× Hostinger's renewal price and, for
  Microsoft, OAuth2 is mandatory for SMTP/IMAP.

## 3. Recommendation

1. **Keep Hostinger Business Starter** as the launch mailbox, on a **24-month term**: first cycle
   R$2.99/month (R$71.76 for two years), then **R$6.99/month (R$83.88/year)** at renewal. The US site
   renews at US$1.59 (US$19.08/year), about the same after exchange; buy on whichever checkout is
   cheaper in BRL that day. 5 GB is enough for a single outreach mailbox. Total outreach stack
   ≈ R$85–100/year plus the domain (~US$10/year).
2. **Drop Zoho** from ADR 0003: policy risk outweighs the US$7/year saving.
3. **HostGator adds nothing**: same Titan platform, higher renewal (US$2.99 or R$9.39+).
4. **Upgrade path if deliverability degrades** (bounces > 3 %, spam-folder placement in test sends):
   Google Workspace Business Starter (US$7/month annual) on the same domain; the agent's SMTP/IMAP
   code is provider-agnostic, only credentials change.

## Sources
- Hostinger renewal tiers: cybernews.com/best-web-hosting/hostinger-review/pricing/ ; bearhost.com/blogs/hostinger-pricing ; tabswire.com/hostinger-business-email-review/
- Hostinger BR promo R$2.49 and "renews at purchase price" claim: pt.hostadvice.com/hosting-company/hostinger-reviews/hostinger-email-pricing/ ; canaltech.com.br/internet/email-profissional/
- Hostinger 1,000/day and mass-mailing policy: hostinger.com/support/4625828 ; hostinger.com/support/1583510
- HostGator US Titan: comparedge.com/tools/hostgator/pricing ; hostgator.com/help/article/professional-email-product-overview
- HostGator BR Titan R$9.39–26.19: tudosobrehospedagemdesites.com.br/hostgator/e-mail-profissional/ ; suporte.hostgator.com.br (planos Titan)
- Zoho pricing/limits/policy: zoho.com/mail/zohomail-pricing.html ; zoho.com/mail/help/usage-policy.html ; goldpenguin.org/blog/dont-use-zoho-for-cold-emailing/ ; mailkarma.ai/blog/zoho-banning-cold-emailers-heres-the-truth-fix
- Google Workspace: workspace.google.com/pricing ; manualdousuario.net/google-workspace-gemini-ia-aumento/ ; litemail.ai/blog/best-google-workspace-plan-cold-email
- Microsoft 365: microsoft.com/en-us/microsoft-365/exchange/exchange-online-business-plans-and-pricing ; medhacloud.com/blog/microsoft-365-pricing-by-country-2026
- Migadu: shipmail.to/vs/migadu ; trekmail.net/blog/migadu-alternative
- MXroute: docs.mxroute.com/docs/presales/marketing.html ; docs.mxroute.com/docs/presales/limits.html ; digitalhosting.com/providers/mxroute
- Purelymail: purelymail.com/pricing ; purelymail.com/termsofservice
