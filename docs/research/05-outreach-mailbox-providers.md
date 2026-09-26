# Research 05 — Mailbox provider for the cold-outreach domain

Date: 2026-09-26 · Requested by the founder ("alternatives to Hostinger, e.g. HostGator and Zoho;
compare real prices, not only the first-period promotion"). Research only; no account was created.

Scope: one mailbox on a separate outreach domain (ADR 0003), driven by our own code over
SMTP/IMAP, ≤ 25 first-touch emails/day, SPF/DKIM/DMARC on the domain. Vendor sites are blocked from
the cloud session's egress proxy, so figures come from third-party price trackers and vendor help
pages surfaced by search; every price must be re-checked on the checkout page before paying (the
"renews at" line). All prices are per mailbox unless stated.

## 1. Price comparison (renewal, not promo)

| Provider / plan | Promo (first term) | Renewal | Per year at renewal | Storage | Notes |
|---|---|---|---|---|---|
| Hostinger Business Starter (Titan platform) | US$0.39–0.99/mo on 12–48-month terms; BR site shows R$2.49/mo | **US$1.59/mo** (Standard US$2.79, Premium US$3.99). One BR review claims "renews at purchase price"; conflicting, verify at checkout | ≈ US$19 | 10 GB | 1,000 sends/day per mailbox; IMAP/SMTP; SPF/DKIM/DMARC |
| HostGator US "Professional Email" (Titan) | US$1.99/mo | **US$2.99/mo** | ≈ US$36 | 10 GB | Same Titan platform as Hostinger; renewal only shown in Customer Portal |
| HostGator Brasil "E-mail Titan" (Essentials/Premium/Ultra) | — | **R$9.39–26.19/mo** | ≈ R$113–314 | 10 GB (Essentials) | Same Titan platform; ~5× Hostinger for the same product |
| Zoho Mail Lite | US$1/mo (annual), 5 GB; 10 GB tier US$1.25 | **US$1/mo** (no promo/renewal gap; ~20 % more if monthly) | US$12 | 5 GB | IMAP/SMTP only on paid plans. **Usage policy explicitly forbids bulk/cold email; community reports of suspensions for small-volume cold outreach** |
| Google Workspace Business Starter | — | **US$7/mo annual, US$8.40 flexible; Brazil R$32.72–40.90/mo** | ≈ US$84 / R$393–491 | 30 GB | 2,000 sends/day cap (new accounts ramp from ~500). Industry default for cold outreach; IMAP/SMTP via app password or OAuth |
| Microsoft 365 Exchange Online Plan 1 | — | **US$4/mo annual** (Business Basic US$7 from Jul 2026) | US$48 | 50 GB | Basic-auth SMTP/IMAP retired; needs OAuth2 app registration (more integration work) |
| Migadu Micro | — | **US$19/yr** flat (all domains/mailboxes) | US$19 | 5 GB pooled | **20 outbound/day** — below our 25/day cap |
| MXroute Small | — | **US$59/yr** flat, unlimited mailboxes | US$59 | 10 GB | 400/h per account, but **cold outreach explicitly prohibited** ("It's not marketing, it's cold outreach" → still no; US$1/email penalty) |
| Purelymail | — | **US$10/yr** flat | US$10 | fair use | **ToS forbids unsolicited/marketing email** |

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

1. **Keep Hostinger Business Starter** as the launch mailbox, bought on a 12- or 24-month term so the
   cost is known: budget the **renewal price (≈ US$1.59/mailbox/month, ≈ US$19/year)**, not the promo.
   Confirm the "renews at" figure on the checkout page; if the BR checkout really renews at R$2.49,
   even better. Total outreach stack ≈ US$29/year (mailbox + domain).
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
