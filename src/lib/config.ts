import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.string().default("development"),
  COMPANY_NAME: z.string().default("RareFree Intelligence"),
  COMPANY_POSTAL_ADDRESS: z.string().default(""),
  PUBLIC_SITE_URL: z.string().default("https://rarefree.com"),
  SPEND_CAP_USD_PER_ACTION: z.coerce.number().default(50),
  SPEND_CAP_USD_PER_MONTH: z.coerce.number().default(300),

  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),

  PATENTSVIEW_API_KEY: z.string().optional(),
  EPO_OPS_CONSUMER_KEY: z.string().optional(),
  EPO_OPS_CONSUMER_SECRET: z.string().optional(),
  GCP_PROJECT_ID: z.string().optional(),

  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
  NFEIO_API_KEY: z.string().optional(),
  NFEIO_COMPANY_ID: z.string().optional(),

  POSTMARK_SERVER_TOKEN: z.string().optional(),
  POSTMARK_BROADCAST_STREAM: z.string().default("newsletter"),
  POSTMARK_TRANSACTIONAL_STREAM: z.string().default("outbound"),
  EMAIL_FROM: z.string().default("RareFree Intelligence <newsletter@rarefree.com>"),
  OUTREACH_FROM: z.string().optional(),

  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_FOUNDER_CHAT_ID: z.string().optional(),
  WEBHOOK_PORT: z.coerce.number().default(8787),
});

export type Config = z.infer<typeof schema>;

let cached: Config | undefined;
export function config(): Config {
  if (!cached) cached = schema.parse(process.env);
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
