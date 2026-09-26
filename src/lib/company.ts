/**
 * Legal identity of the company (public record in Brazil; also printed in every email footer, so
 * nothing here is secret). Single source for footers, legal templates and invoices. Provided by the
 * founder on 2026-09-26; fiscal parameters (CNAE, NFS-e service code, ISS) still pending in ADR 0002.
 */
export const COMPANY = {
  brand: "PatentSonar",
  legalName: "Rockfort Hub de Inovação Ltda",
  cnpj: "40.435.866/0001-40",
  street: "Av. Tiradentes 209, Centro",
  city: "São João del Rei",
  state: "Minas Gerais",
  postalCode: "36307-346",
  country: "Brazil",
  /** One line for email footers (CAN-SPAM/CASL/LGPD sender identification). */
  postalAddress: "Rockfort Hub de Inovação Ltda · Av. Tiradentes 209, Centro, São João del Rei, Minas Gerais, 36307-346, Brazil",
  /** Full identification for legal documents. */
  legalLine: "Rockfort Hub de Inovação Ltda (trading as PatentSonar), CNPJ 40.435.866/0001-40, Av. Tiradentes 209, Centro, São João del Rei, Minas Gerais, 36307-346, Brazil",
} as const;
