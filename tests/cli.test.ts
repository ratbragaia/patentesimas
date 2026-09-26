import { describe, it, expect } from "vitest";
import { lastFullWeek } from "../src/cli.js";

describe("lastFullWeek", () => {
  it("on a Tuesday returns the previous Mon..Sun", () => expect(lastFullWeek(new Date("2026-09-29T10:00:00Z"))).toEqual({ from: "2026-09-21", to: "2026-09-27" }));
  it("on a Monday returns the week that just ended", () => expect(lastFullWeek(new Date("2026-09-28T00:00:00Z"))).toEqual({ from: "2026-09-21", to: "2026-09-27" }));
  it("on a Sunday returns the week before (current week not complete)", () => expect(lastFullWeek(new Date("2026-09-27T23:00:00Z"))).toEqual({ from: "2026-09-14", to: "2026-09-20" }));
});

import { basicAuthOk } from "../src/webhooks/server.js";
describe("postmark webhook basic auth", () => {
  const h = "Basic " + Buffer.from("postmark:s3cret").toString("base64");
  it("accepts the right credential", () => expect(basicAuthOk(h, "postmark", "s3cret")).toBe(true));
  it("rejects a wrong password", () => expect(basicAuthOk(h, "postmark", "other")).toBe(false));
  it("rejects when the secret is unset or the header is missing", () => { expect(basicAuthOk(h, "postmark", undefined)).toBe(false); expect(basicAuthOk(undefined, "postmark", "s3cret")).toBe(false); });
});
