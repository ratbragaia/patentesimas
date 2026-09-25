/**
 * Minimal HTTP server for inbound webhooks (Paddle, Postmark bounces/complaints) and the
 * one-click unsubscribe endpoint. Runs as a systemd service behind Caddy (infra/).
 */
import { createServer } from "node:http";
import { config, require } from "../lib/config.js";
import { log } from "../lib/log.js";
import { verifyPaddleSignature, handlePaddleEvent } from "../billing/paddle.js";
import { suppress } from "../email/postmark.js";
import { db } from "../lib/db.js";

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((res, rej) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => res(b)); req.on("error", rej); });
}

export function startServer(port = config().WEBHOOK_PORT) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/healthz") { res.writeHead(200); res.end("ok"); return; }

      if (req.method === "POST" && url.pathname === "/webhooks/paddle") {
        const raw = await readBody(req);
        if (!verifyPaddleSignature(raw, req.headers["paddle-signature"] as string | undefined, require("PADDLE_WEBHOOK_SECRET"))) { res.writeHead(401); res.end("bad signature"); return; }
        const processed = await handlePaddleEvent(JSON.parse(raw));
        res.writeHead(200); res.end(processed ? "processed" : "duplicate"); return;
      }

      if (req.method === "POST" && url.pathname === "/webhooks/postmark") {
        // Protect with basic auth configured in Postmark webhook URL: https://user:pass@host/webhooks/postmark
        const ev = JSON.parse(await readBody(req));
        if (ev.RecordType === "Bounce" && ev.Type === "HardBounce") await suppress(ev.Email, "bounce");
        if (ev.RecordType === "SpamComplaint") await suppress(ev.Email, "complaint");
        if (ev.RecordType === "SubscriptionChange" && ev.SuppressSending) await suppress(ev.Recipient, "unsubscribed");
        res.writeHead(200); res.end("ok"); return;
      }

      if (req.method === "GET" && url.pathname === "/unsubscribe") {
        const token = url.searchParams.get("token");
        const { data } = token ? await db().from("subscribers").select("email").eq("unsubscribe_token", token).maybeSingle() : { data: null };
        if (data?.email) await suppress(data.email, "unsubscribed");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<!doctype html><meta charset=utf-8><title>Unsubscribed</title><p style='font-family:sans-serif'>You have been unsubscribed. Sorry to see you go.</p>"); return;
      }

      res.writeHead(404); res.end("not found");
    } catch (err) {
      log.error("webhook error", { path: url.pathname, err: String(err) });
      res.writeHead(500); res.end("error");
    }
  });
  server.listen(port, () => log.info("webhook server listening", { port }));
  return server;
}

if (process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js")) startServer();
