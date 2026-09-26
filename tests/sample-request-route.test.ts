import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import type { Server } from "node:http";

// The route is exercised end-to-end over HTTP with the database and Telegram mocked.
const rpc = vi.fn(async () => ({ data: [{ request_id: "11111111-1111-1111-1111-111111111111", is_new: true, requests: 1 }], error: null }));
const insert = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/lib/db.js", () => ({
  db: () => ({ rpc, from: () => ({ insert }) }),
  audit: vi.fn(async () => undefined),
}));
const notifyFounder = vi.fn(async (_text: string) => undefined);
vi.mock("../src/reporting/telegram.js", () => ({ notifyFounder }));

let server: Server; let base = "";
beforeAll(async () => {
  process.env["PATENTSONAR_ENV_FILE"] = "/nonexistent/env";
  const { startServer } = await import("../src/webhooks/server.js");
  server = startServer(0);
  await new Promise<void>((r) => server.once("listening", () => r()));
  const addr = server.address(); base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe("POST /api/sample-request", () => {
  it("stores a form post, queues a sales task, notifies the founder and redirects", async () => {
    const res = await fetch(`${base}/api/sample-request`, { method: "POST", redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.5" },
      body: "email=ip.counsel%40example-motors.com&company=Example+Motors&website=&source=site" });
    expect(res.status).toBe(303); expect(res.headers.get("location")).toBe("/sample-requested.html");
    expect(rpc).toHaveBeenCalledWith("record_sample_request", expect.objectContaining({ p_email: "ip.counsel@example-motors.com", p_company: "Example Motors", p_source: "site" }));
    const args = (rpc.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(String(args["p_ip_hash"])).not.toContain("203.0.113");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ agent: "sales", priority: 2 }));
    expect(notifyFounder).toHaveBeenCalledTimes(1);
    expect(String(notifyFounder.mock.calls[0]?.[0])).toContain("ip.counsel@example-motors.com");
  });
  it("answers JSON clients with JSON and rejects bad input without touching the database", async () => {
    rpc.mockClear(); notifyFounder.mockClear();
    const res = await fetch(`${base}/api/sample-request`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "203.0.113.6" }, body: JSON.stringify({ email: "nope" }) });
    expect(res.status).toBe(400); expect(await res.json()).toMatchObject({ ok: false, outcome: "invalid" });
    expect(rpc).not.toHaveBeenCalled(); expect(notifyFounder).not.toHaveBeenCalled();
  });
  it("silently drops honeypot submissions", async () => {
    rpc.mockClear();
    const res = await fetch(`${base}/api/sample-request`, { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", "X-Forwarded-For": "203.0.113.7" }, body: "email=bot%40example.com&website=http%3A%2F%2Fx" });
    expect(res.status).toBe(303); expect(rpc).not.toHaveBeenCalled();
  });
  it("rate limits a single source", async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const r = await fetch(`${base}/api/sample-request`, { method: "POST", headers: { "Content-Type": "application/json", "X-Forwarded-For": "198.51.100.1" }, body: JSON.stringify({ email: `u${i}@example.org` }) });
      last = r.status;
    }
    expect(last).toBe(429);
  });
});
