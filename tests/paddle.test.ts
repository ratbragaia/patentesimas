import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaddleSignature, resolvePaddleEnvironment } from "../src/billing/paddle.js";

describe("paddle signature", () => {
  const secret = "pdl_ntfset_test"; const body = '{"event_id":"evt_1"}'; const ts = 1_700_000_000;
  const sig = (t: number) => `ts=${t};h1=${createHmac("sha256", secret).update(`${t}:${body}`).digest("hex")}`;
  it("accepts a valid fresh signature", () => expect(verifyPaddleSignature(body, sig(ts), secret, ts + 10)).toBe(true));
  it("rejects tampered body", () => expect(verifyPaddleSignature(body + " ", sig(ts), secret, ts)).toBe(false));
  it("rejects stale timestamp (replay)", () => expect(verifyPaddleSignature(body, sig(ts), secret, ts + 3600)).toBe(false));
  it("rejects missing header", () => expect(verifyPaddleSignature(body, undefined, secret, ts)).toBe(false));
});

describe("paddle environments", () => {
  const body = '{"event_id":"evt_2"}'; const ts = 1_700_000_000;
  const sig = (secret: string) => `ts=${ts};h1=${createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex")}`;
  it("routes to live or sandbox by which secret verifies, and rejects unknown", () => {
    const secrets = { production: "live_secret", sandbox: "sandbox_secret" };
    expect(resolvePaddleEnvironment(body, sig("live_secret"), secrets, ts)).toBe("production");
    expect(resolvePaddleEnvironment(body, sig("sandbox_secret"), secrets, ts)).toBe("sandbox");
    expect(resolvePaddleEnvironment(body, sig("other"), secrets, ts)).toBeNull();
    expect(resolvePaddleEnvironment(body, sig("sandbox_secret"), { production: "live_secret" }, ts)).toBeNull();
  });
});
