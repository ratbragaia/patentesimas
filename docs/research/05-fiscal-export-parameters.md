# Fiscal parameters for exporting a subscription service from Brazil (Lucro Presumido, CNAE 63.19-4-00)

Date: 2026-09-26 · Owner: agent (founder delegated the decision; see ADR 0002) · Sources are web-search
excerpts; nfe.io, legisweb, the São João del Rei NFS-e portal and paddle.com are blocked by the session proxy,
so nothing below was read in full (**[excerpt-only]** throughout). Statutes are cited by number so a
professional can check them in minutes.

## 1. Who we invoice, and for how much (the Paddle merchant-of-record model)

- Paddle is our **reseller**: "as Paddle is the seller of the Product to the Buyer, you shall not issue any
  invoice or make any demand for payment to any Buyer in a Transaction" (Paddle Master Services Agreement).
  For every payout Paddle generates a **Reverse Invoice**, "an invoice from you to Paddle for the amount of your
  payout"; sales outside the US are made by **Paddle.com Market Ltd (UK)** or **Paddle Payments Ltd (IE)**,
  US sales by **Paddle.com Inc.**, and the reverse invoice comes from the entity that sold.
  [Paddle help — do I need to invoice Paddle](https://www.paddle.com/help/manage/get-paid/do-i-need-to-invoice-paddle-for-my-payout),
  [Paddle MSA](https://www.paddle.com/legal/terms), [Paddle statements](https://www.paddle.com/help/manage/get-paid/what-statements-will-i-receive)
- Consequence for the NFS-e: our customer, in Brazilian fiscal terms, is Paddle, and our revenue is the
  **payout (net of Paddle's fee and of the taxes Paddle collected)**. One NFS-e per reverse invoice, same
  amount, tomador = the Paddle entity on that reverse invoice. Invoicing end subscribers would double-count
  revenue and contradict the MSA. This is the practice Brazilian exporters use with any foreign reseller/MoR.
- Paddle.com Market Limited: UK company 08172165, Judd House, 18-29 Mora Street, London EC1V 8BT
  ([Companies House](https://find-and-update.company-information.service.gov.uk/company/08172165)).

## 2. Service code (LC 116 list)

- **Item 1.09**: "Disponibilização, sem cessão definitiva, de conteúdos de áudio, vídeo, imagem e texto por meio
  da internet, respeitada a imunidade de livros, jornais e periódicos" (added by LC 157/2016). A paid
  newsletter/report subscription accessed online for the term of the subscription is exactly this.
  [Guia LC 116](https://buscadorncm.com.br/blog/lista-servicos-lc116-iss-guia),
  [Open Treinamentos — subitem 1.09](https://opentreinamentos.com.br/81-a-polemica-dos-servicos-do-subitem-1-09-da-lc-116-2003/)
- Alternatives if the municipal table lacks 1.09 (some municipalities never updated after LC 157):
  17.01 (assessoria/consultoria) or 1.03 (processamento/hospedagem). 17.01 is defensible because each issue
  carries analyst notes, but 1.09 describes the product better and is what content platforms use.
- Immunity of periodicals (CF art. 150, VI, d; STF RE 330.817, Súmula Vinculante 57 for e-books): a digital
  periodical may be immune from ISS even domestically. We do **not** rely on it: exports are already outside
  ISS (§3), and claiming immunity would invite a municipal dispute for no gain.
  [STF — RE 330.817](https://noticias.stf.jus.br/postsnoticias/stf-decide-que-livros-digitais-tem-imunidade-tributaria/)
- São João del Rei issues NFS-e through the **Nfiss** municipal system (saojoaodelrei.nfiss.com.br) and is
  listed as an integrated municipality by NFe.io and Focus NFe. The municipal `cityServiceCode` for item
  1.09 is read from NFe.io's municipality table at onboarding (item 12 of the handoff).
  [NFe.io — São João del Rei](https://nfe.io/docs/prefeituras-integradas/minas-gerais/sao-joao-del-rei-mg-3162500/),
  [Focus NFe — São João del Rei](https://focusnfe.com.br/guides/nfse/municipios-integrados/sao-joao-del-rei-mg/)

## 3. ISS: export, not taxed

- LC 116/2003 art. 2, I: ISS does not apply to exports of services; parágrafo único excludes services
  "desenvolvidos no Brasil, cujo resultado aqui se verifique". Our subscribers read and use the briefings
  abroad; the result is abroad. The NFS-e is still mandatory: "o fato de haver isenção... não afasta a
  obrigatoriedade de emissão".
- How the NFS-e is filled (consistent across the guides): natureza/exigibilidade = **Exportação de serviço**;
  **Tomador no exterior**, CPF/CNPJ blank, country + city of the tomador; ISS rate 0; value in BRL converted
  at PTAX. [Wise — NF para o exterior](https://wise.com/br/blog/emitir-nota-fiscal-exterior),
  [Spedy — NF de serviço para o exterior](https://blog.spedy.com.br/nota-fiscal-de-servico-para-o-exterior/),
  [Contabnet](https://contabnet.com.br/blog/nota-fiscal-de-exportacao-de-servicos/)

## 4. PIS/COFINS: exempt on export revenue (cumulative regime = Lucro Presumido)

- **MP 2.158-35/2001 art. 14, III and §1**: COFINS and PIS exemption for "receitas de serviços prestados a
  pessoa física ou jurídica residente ou domiciliada no exterior, cujo pagamento represente ingresso de
  divisas" (the non-cumulative twins are Lei 10.637 art. 5, II and Lei 10.833 art. 6, II).
  [MP 2.158-35 arts. 13-14](https://www.normaslegais.com.br/legislacao/tributario/art14_mp2158_35.htm)
- **Solução de Consulta COSIT 179/2025** (DOU Sept 2025): two requirements, tomador abroad and ingresso de
  divisas; the inflow may be in BRL or foreign currency, before or after the service; and **if the company
  keeps the money abroad under Lei 11.371/2006, the benefit stands without physical entry of funds**. This
  is what makes a Wise Business USD balance fed by Paddle payouts compliant.
  [COSIT 179/2025 — Normas Legais](https://www.normaslegais.com.br/legislacao/solucao-de-consulta-cosit-179-2025.htm),
  [Kincaid — ingresso de divisas](https://www.kincaid.com.br/exportacao-de-servicos-e-ingresso-de-divisas-para-fins-de-isencao-de-pis-cofins/)
- Evidence to keep per payout: Paddle reverse invoice + payout statement, Wise/Payoneer credit record, and the
  exchange receipt when converting to BRL. Resources kept abroad are reported yearly in the **ECF** (the DEREX
  form was abolished by IN RFB 1.801/2018; the information moved into the ECF; penalty 10% of resources held
  in disagreement). [RFB — Derex extinta](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2018/marco/receita-federal-extingue-a-derex)

## 5. IRPJ and CSLL (Lucro Presumido, quarterly)

- Presumption base for services: **32%** (Lei 9.249/1995 art. 15 §1, III, "a" for IRPJ; art. 20 for CSLL).
- IRPJ 15% on the base + 10% additional on the base above R$60,000 per quarter; CSLL 9% on the base.
- Effective load on export revenue: **7.68%** up to R$187,500 of quarterly revenue (base R$60k), **10.88%**
  marginal above. No ISS, PIS or COFINS on exports. Domestic sales (a Brazilian subscriber) would add ISS
  (São João del Rei rate for item 1.09) + PIS 0.65% + COFINS 3%.

## 6. What is decided vs. what a professional should still glance at

Decided by the agent (ADR 0002): item 1.09, export/no-ISS marking, PIS/COFINS exemption with the evidence
set above, NFS-e to the Paddle entity per reverse invoice at the payout amount, PTAX of the payout date.
Worth one paid hour of a tax professional before the first NFS-e (a few hundred reais, within the spend cap):
(a) that São João del Rei's Nfiss table offers 1.09 for CNAE 63.19-4-00 and how it labels export
non-incidence; (b) that keeping USD at Wise Business is documented as "recursos mantidos no exterior" in the
ECF. Neither changes the design; both are checks of municipal/RFB form-filling.
