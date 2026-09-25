# ADR 0002 — Fiscal parameters for service export (PENDING accountant)

Date: 2026-09-25 · Status: **pending** — invoices stay `pending` in `ps.invoices` until filled.

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
