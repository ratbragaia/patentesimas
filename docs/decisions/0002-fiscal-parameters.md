# ADR 0002 — Fiscal parameters for service export (PENDING accountant)

Date: 2026-09-25 · Status: **pending** — invoices stay `pending` in `ps.invoices` until filled.

Update 2026-09-26: entity confirmed by the founder — **Rockfort Hub de Inovação Ltda**, CNPJ 40.435.866/0001-40,
Av. Tiradentes 209, Centro, São João del Rei/MG, 36307-346 (`src/lib/company.ts`). A Ltda, so Wise Business is
eligible for the USD account (ADR 0004). **Tax regime: Lucro Presumido** (founder, 2026-09-26; the briefing had assumed Simples Nacional).
**CNAE confirmed 2026-09-26: 63.19-4-00 — Portais, provedores de conteúdo e outros serviços de informação na
internet.** Fits a paid newsletter/report subscription delivered online.

Still missing from the accountant (candidates noted so the question is concrete, not decided here):
- NFS-e service code (LC 116 list item): likely **1.09** (disponibilização de conteúdos de texto por meio da
  internet, sem cessão definitiva) or **1.03/17.01**; the São João del Rei municipal code table decides.
- ISS on exports: LC 116 art. 2, I exempts service exports unless the result occurs in Brazil; confirm the
  municipality accepts the exemption for a foreign subscriber base and how the NFS-e must be marked.
- ~~Simples Nacional annex~~ **Corrected 2026-09-26: the company is on Lucro Presumido, not Simples.** Questions
  become: (a) PIS/COFINS on export revenue: Lei 10.637/2002 art. 5, I and Lei 10.833/2003 art. 6, I exempt
  service exports paid in convertible currency with "ingresso de divisas"; confirm the accountant accepts
  Paddle payouts landing in Wise/Payoneer as ingresso de divisas and what evidence (contrato de câmbio /
  extrato) must be kept; (b) IRPJ/CSLL presumption base for services (32%) and the quarterly regime;
  (c) ISS: municipal export exemption as above. Effective load to model in `docs/research/04` §5.
- Whether the NFS-e is issued to Paddle (merchant of record) for the net payout or gross of Paddle's fee.

Research (`docs/research/04-compliance-and-payments.md` §5): a Simples Nacional ME/EPP excludes
ISS, PIS, COFINS, ICMS and IPI from the DAS on export revenue (LC 123 art. 18 §14); IRPJ/CSLL still
apply; export revenue is segregated monthly in PGDAS-D; export sub-limit R$4.8M separate from the
domestic R$4.8M; SISCOSERV extinguished (Portaria Conjunta SECINT/RFB 22.091, 21 Oct 2020).

Needed from the accountant (founder relays; agent never guesses):
| Parameter | Value |
|---|---|
| CNAE and Simples annex | ☐ |
| Municipal service code (LC 116 item, e.g. 1.03 / 17.01 / 10.02) | ☐ |
| NFS-e "export" taxation type / ISS exemption code in the municipality | ☐ |
| Whether tomador abroad needs a tax id field left blank or "EXTERIOR" | ☐ |
| Monthly PTAX convention (transaction date vs. issue date) | ☐ |

Once filled, set `cityServiceCode` and taxation fields in `src/invoicing/nfeio.ts`.
