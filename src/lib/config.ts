import { z } from "zod";
import { existsSync, readFileSync } from "node:fs";
import { COMPANY } from "./company.js";

/**
 * systemd units get credentials via EnvironmentFile=/etc/patentsonar/env. Interactive runs
 * (`npm run cli ...`) do not, so load the same file as a fallback: existing process.env wins,
 * lines are KEY=value, `#` lines are ignored, surrounding quotes are stripped.
 */
export const ENV_FILE = process.env.PATENTSONAR_ENV_FILE ?? "/etc/patentsonar/env";
export function loadEnvFile(path = ENV_FILE, env: NodeJS.ProcessEnv = process.env): void {
  if (!existsSync(path)) return;
  for (const raw of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (env[key] === undefined) env[key] = value;
  }
}

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  COMPANY_NAME: z.string().default("PatentSonar"),
  COMPANY_POSTAL_ADDRESS: z.string().default(COMPANY.postalAddress),
  PUBLIC_SITE_URL: z.string().default("https://patentsonar.com"),
  SPEND_CAP_USD_PER_ACTION: z.coerce.number().default(50),
  SPEND_CAP_USD_PER_MONTH: z.coerce.number().default(300),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  PATENTSVIEW_API_KEY: z.string().optional(),
  EPO_OPS_CONSUMER_KEY: z.string().optional(),
  EPO_OPS_CONSUMER_SECRET: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  POSTMARK_WEBHOOK_SECRET: z.string().optional(),
  INBOUND_WEBHOOK_SECRET: z.string().optional(),
  CLOUDFLARE_API_TOKEN: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_ZONE_ID: z.string().optional(),
  PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  /** NFS-e provider: Notaas (REST over the national NFS-e API; free tier). Research 06 / ADR 0002. */
  NOTAAS_API_KEY: z.string().optional(),
  NOTAAS_SANDBOX: z.coerce.boolean().default(false),
  /** Set to 1 once the payload field names were checked against docs.notaas.com.br (VPS session). */
  NOTAAS_SCHEMA_CONFIRMED: z.coerce.boolean().default(false),

  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_BROADCAST_STREAM: z.string().default("newsletter"),
  POSTMARK_TRANSACTIONAL_STREAM: z.string().default("outbound"),
  EMAIL_FROM: z.string().default("PatentSonar <newsletter@patentsonar.com>"),
  OUTREACH_FROM: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_FOUNDER_CHAT_ID: z.string().optional(),
  WEBHOOK_PORT: z.coerce.number().default(8787),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;
export function config(): Config {
  if (!cached) { loadEnvFile(); cached = schema.parse(process.env); }
  return cached;
}

/** Throws a clear error when a credential the current job needs is missing. */
export function require<K extends keyof Config>(key: K): NonNullable<Config[K]> {
  const v = config()[key];
  if (v === undefined || v === "") {
    throw new Error(`Missing credential ${key}. See .env.example and docs/handoff-checklist.md`);
  }
  return v as NonNullable<Config[K]>;
}
