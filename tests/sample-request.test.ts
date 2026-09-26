import { describe, it, expect } from "vitest";
import { parseSampleRequest, hashIp, RateLimiter, CONSENT_TEXT } from "../src/site/sample-request.js";

describe("sample request parsing", () => {
  it("accepts a plain HTML form post", () => {
    const r = parseSampleRequest("email=Jane.Doe%40Example.com&company=Example+GmbH&website=&source=site", "application/x-www-form-urlencoded");
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.value.email).toBe("jane.doe@example.com"); expect(r.value.company).toBe("Example GmbH"); expect(r.bot).toBe(false); expect(r.freemail).toBe(false); }
  });
  it("accepts JSON", () => {
    const r = parseSampleRequest(JSON.stringify({ email: "ip@bosch.com" }), "application/json; charset=utf-8");
    expect(r.ok).toBe(true); if (r.ok) expect(r.value.source).toBe("site");
  });
  it("rejects invalid emails and malformed bodies", () => {
    expect(parseSampleRequest("email=not-an-email", undefined).ok).toBe(false);
    expect(parseSampleRequest("company=x", undefined).ok).toBe(false);
    expect(parseSampleRequest("{", "application/json").ok).toBe(false);
    expect(parseSampleRequest("[1]", "application/json").ok).toBe(false);
    expect(parseSampleRequest("email=a%40b.com&source=%3Cscript%3E", undefined).ok).toBe(false);
  });
  it("flags honeypot hits and free-mail addresses", () => {
    const bot = parseSampleRequest("email=a%40b.com&website=http%3A%2F%2Fspam", undefined);
    expect(bot.ok && bot.bot).toBe(true);
    const free = parseSampleRequest("email=someone%40gmail.com", undefined);
    expect(free.ok && free.freemail).toBe(true);
  });
  it("consent text matches what the site shows", () => {
    expect(CONSENT_TEXT).toContain("No automated drip, no list sale");
  });
});

describe("ip hashing and rate limiting", () => {
  it("never stores the raw ip and rotates daily", () => {
    const a = hashIp("203.0.113.9", "2026-09-26"); const b = hashIp("203.0.113.9", "2026-09-27");
    expect(a).not.toContain("203.0.113"); expect(a).not.toEqual(b); expect(hashIp(undefined)).toBeNull();
  });
  it("limits per key and overall within the window", () => {
    const rl = new RateLimiter(2, 3, 1000);
    expect(rl.allow("k1", 0)).toBe(true); expect(rl.allow("k1", 1)).toBe(true); expect(rl.allow("k1", 2)).toBe(false);
    expect(rl.allow("k2", 3)).toBe(true); expect(rl.allow("k3", 4)).toBe(false); // overall cap
    expect(rl.allow("k1", 2000)).toBe(true); // window passed
  });
});
