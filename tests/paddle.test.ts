import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyPaddleSignature } from "../src/billing/paddle.js";

describe("paddle signature", () => {
  const secret = "pdl_ntfset_test"; const body = '{"event_id":"evt_1"}'; const ts = 1_700_000_000;
  const sig = (t: number) => `ts=${t};h1=${createHmac("sha256", secret).update(`${t}:${body}`).digest("hex")}`;
  it("accepts a valid fresh signature", () => expect(verifyPaddleSignature(body, sig(ts), secret, ts + 10)).toBe(true));
  it("rejects tampered body", () => expect(verifyPaddleSignature(body + " ", sig(ts), secret, ts)).toBe(false));
  it("rejects stale timestamp (replay)", () => expect(verifyPaddleSignature(body, sig(ts), secret, ts + 3600)).toBe(false));
  it("rejects missing header", () => expect(verifyPaddleSignature(body, undefined, secret, ts)).toBe(false));
});
