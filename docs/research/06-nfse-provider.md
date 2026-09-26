# NFS-e channel and provider for 1–2 notes a month (2026-09-26)

Founder's objection: NFe.io's cheapest plan is R$190/month for up to 250 notes; we will issue one NFS-e per
Paddle payout (one or two a month). Question: why not Notaas, which is free?

## Findings (search excerpts; notaas.com.br, nfe.io and the municipal site are blocked from the cloud session)
- **São João del Rei moved to the national NFS-e on 2026-01-01.** "A partir de 1º de janeiro de 2026, todos os
  prestadores de serviços de São João del-Rei… serão obrigados a emitir a NFS-e de padrão nacional… a emissão
  deixa de ser feita pelo sistema municipal e passa a ocorrer exclusivamente pelo portal nacional (nfse.gov.br),
  que oferece… página web, aplicativo e integração via API. O modelo nacional é gratuito e, para pessoas
  jurídicas, exige assinatura com certificado digital." (LC 214/2025.)
  [Rádio Campos de Minas](https://www.radiocamposdeminas.com.br/news-4536-%E2%80%8Bsao-joao-del-rei-adotara-nota-fiscal-de-servicos-eletronica-nacional-a-partir-de-2026),
  [Prefeitura — Decretos NFSe](https://saojoaodelrei.mg.gov.br/pagina/4053/Decretos%20NFSe)
- Consequence: the municipal Nfiss integration that NFe.io/Focus advertise is legacy; any provider is now a
  wrapper over the same free national API (DPS XML signed with the A1 certificate, mTLS).
- **Notaas**: REST `POST https://platform.notaas.com.br/api/v1/emitir`, header `x-api-key`, sandbox, webhooks
  (`nfse.issued`, `nfse.cancelled`), PDF/XML/protocol in the response, SDKs for Node/Python/PHP; supports the
  national standard and municipal layouts; **free tier: 50 notes/month**; requires the company's A1
  certificate uploaded to the platform. [Notaas](https://www.notaas.com.br/),
  [Notaas — free APIs compared](https://www.notaas.com.br/blog/post/api-gratuita-emissao-nfs-e-brasil-melhores-opcoes-2026),
  [Notaas — national API guide](https://www.notaas.com.br/blog/post/api-nfse-nacional-guia-integracao-tech)
- Per-note alternatives if Notaas' free tier goes away: eNotas (from ~R$0.40/note), Asaas Notas (R$0.30–0.80/note,
  needs an Asaas account), Focus NFe (from R$39/month). Direct integration with the national API is free and
  is the long-term fallback (our draft already uses the DPS vocabulary).
- National layout for exports (all guides agree): tomador "no exterior", classification "exportação" (ISS not
  due), country of the result, foreign-trade block (currency, amount in currency, mode of provision). Rejection
  E1303 happens when ISS fields are filled on an export; we send ISS 0 and no ISS amounts.
  [Tecnospeed — E1303](https://atendimento.tecnospeed.com.br/hc/pt-br/articles/36814016167447)

## Decision (ADR 0002 updated)
Notaas free tier as the provider; NFe.io dropped. Cost: R$0/month for our volume. What the founder provides:
a Notaas account and an **e-CNPJ A1 certificate** (needed for any NFS-e as a legal entity, whatever the
provider; ~R$150–250/year at any ICP-Brasil certifier; also gives access to nfse.gov.br as a manual fallback).
Open item for the VPS session (it can read docs.notaas.com.br): confirm the payload field names for the foreign
tomador and the export block, test in the sandbox, then set `NOTAAS_SCHEMA_CONFIRMED=1`.
