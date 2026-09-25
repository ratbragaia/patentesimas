import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { require } from "./config.js";

type Client = SupabaseClient<any, "ps", any, any, any>;
let client: Client | undefined;

/** Service-role client bound to schema `ps`. Only the VPS ever holds this key. */
export function db(): Client {
  if (!client) {
    client = createClient<any, "ps">(require("SUPABASE_URL"), require("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false },
      db: { schema: "ps" },
    });
  }
  return client;
}

export async function audit(actor: string, action: string, entity?: string, entityId?: string, details?: unknown) {
  await db().from("audit_log").insert({ actor, action, entity, entity_id: entityId, details });
}
