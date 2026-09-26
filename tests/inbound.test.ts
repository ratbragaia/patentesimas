import { describe, it, expect } from "vitest";
import { parseInbound, isAutomated } from "../src/email/inbound.js";
import { bearerOk } from "../src/webhooks/server.js";

const raw = [
  "From: Jane Analyst <jane@example-oem.com>", "To: support@patentsonar.com", "Subject: Sample issue?",
  "Message-ID: <abc123@example-oem.com>", "In-Reply-To: <issue0@patentsonar.com>", "Date: Sat, 26 Sep 2026 10:00:00 +0000",
  "Content-Type: text/plain; charset=utf-8", "", "Hi, could you send the sample issue? Thanks, Jane",
].join("\r\n");

describe("inbound email", () => {
  it("parses sender, subject, body and threading headers", async () => {
    const p = await parseInbound(raw, { from: "jane@example-oem.com", to: "support@patentsonar.com" });
    expect(p.from_email).toBe("jane@example-oem.com"); expect(p.from_name).toBe("Jane Analyst");
    expect(p.to_email).toBe("support@patentsonar.com"); expect(p.subject).toBe("Sample issue?");
    expect(p.message_id).toBe("<abc123@example-oem.com>"); expect(p.in_reply_to).toBe("<issue0@patentsonar.com>");
    expect(p.text_body).toContain("sample issue"); expect(p.content_hash).toHaveLength(64);
    expect(isAutomated(p)).toBe(false);
  });
  it("flags auto-replies and daemons", async () => {
    const auto = await parseInbound(raw.replace("Subject:", "Auto-Submitted: auto-replied\r\nSubject:"), {});
    expect(isAutomated(auto)).toBe(true);
    const daemon = await parseInbound(raw.replace("jane@example-oem.com", "mailer-daemon@example-oem.com"), {});
    expect(isAutomated(daemon)).toBe(true);
  });
  it("bearer check requires a long secret and exact match", () => {
    const s = "x".repeat(40);
    expect(bearerOk(`Bearer ${s}`, s)).toBe(true); expect(bearerOk(`Bearer ${s}1`, s)).toBe(false);
    expect(bearerOk(`Bearer short`, "short")).toBe(false); expect(bearerOk(undefined, s)).toBe(false);
  });
});
