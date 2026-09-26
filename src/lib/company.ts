/**
 * Legal identity of the company (public record in Brazil; also printed in every email footer, so
 * nothing here is secret). Single source for footers, legal templates and invoices. Provided by the
 * founder on 2026-09-26; fiscal parameters (CNAE, NFS-e service code, ISS) still pending in ADR 0002.
 */
export const COMPANY = {
  brand: "PatentSonar",
  legalName: "Rockfort Hub de Inovação Ltda",
  cnpj: "40.435.866/0001-40",
  /** Main activity as registered (founder, 2026-09-26). */
  taxRegime: "Lucro Presumido",
  cnae: "63.19-4-00",
  cnaeDescription: "Portais, provedores de conteúdo e outros serviços de informação na internet",
  street: "Av. Tiradentes 209, Centro",
  city: "São João del Rei",
  state: "Minas Gerais",
  postalCode: "36307-346",
  country: "Brazil",
  /** Support line shown on the site and in the Terms (Paddle asks for a visible support phone). */
  supportPhone: "+55 32 93618-2698",
  supportEmail: "support@patentsonar.com",
  /** One line for email footers (CAN-SPAM/CASL/LGPD sender identification). */
  postalAddress: "Rockfort Hub de Inovação Ltda · Av. Tiradentes 209, Centro, São João del Rei, Minas Gerais, 36307-346, Brazil",
  /** Full identification for legal documents. */
  legalLine: "Rockfort Hub de Inovação Ltda (trading as PatentSonar), CNPJ 40.435.866/0001-40, Av. Tiradentes 209, Centro, São João del Rei, Minas Gerais, 36307-346, Brazil",
} as const;

/** Fiscal parameters decided in ADR 0002 (2026-09-26). */
export const FISCAL = {
  regime: "Lucro Presumido",
  /** LC 116 list item printed on every NFS-e for the subscription service. */
  federalServiceCode: "1.09",
  /** NFe.io taxation type for a foreign tomador (export of services, ISS not due: LC 116 art. 2, I). */
  exportTaxationType: "Export",
  /** Código de tributação nacional (NFS-e padrão nacional) for LC 116 item 1.09; confirm the 6-digit code in the national table at onboarding. */
  cTribNac: "010901",
  /** Description prefix on the NFS-e (Portuguese, as municipal systems expect). */
  serviceDescription: "Disponibilização de conteúdo de inteligência de patentes por assinatura via internet (LC 116 item 1.09). Exportação de serviço: tomador no exterior, ISS não incidente (LC 116, art. 2º, I); PIS/COFINS isentos (MP 2.158-35/2001, art. 14, III e §1º).",
} as const;

/** Paddle entities that issue reverse invoices to us (research 05 §1). Address per the reverse invoice; verify on first sight. */
export const PADDLE_ENTITIES = {
  UK: { name: "Paddle.com Market Limited", country: "GBR", street: "Judd House, 18-29 Mora Street", city: "London", state: "", postalCode: "EC1V 8BT", registration: "Companies House 08172165" },
  US: { name: "Paddle.com Inc.", country: "USA", street: "3811 Ditmars Blvd #1071", city: "Astoria", state: "NY", postalCode: "11105-1803", registration: "confirm on first reverse invoice" },
  IE: { name: "Paddle Payments Limited", country: "IRL", street: "", city: "Dublin", state: "", postalCode: "", registration: "fill from first reverse invoice" },
} as const;
export type PaddleEntityCode = keyof typeof PADDLE_ENTITIES;
