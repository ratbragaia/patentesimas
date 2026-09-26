import { describe, it, expect } from "vitest";
import { parseFounderText, parseCallbackData, shortCode } from "../src/reporting/founder-inbox.js";
import { telegramWebhookSecret, FOUNDER_KEYBOARD } from "../src/reporting/telegram.js";
import { cliAllowed } from "../src/ops/jobs.js";

describe("founder telegram input", () => {
  it("maps the keyboard labels and slash commands", () => {
    expect(parseFounderText("📊 Status")).toEqual({ command: "status" });
    expect(parseFounderText("📋 Tarefas")).toEqual({ command: "tarefas" });
    expect(parseFounderText("❓ Ajuda")).toEqual({ command: "ajuda" });
    expect(parseFounderText("/status")).toEqual({ command: "status" });
    expect(parseFounderText("/tarefas@patentsonar_bot")).toEqual({ command: "tarefas" });
    expect(parseFounderText("/ok 1a2b3c4d pode mandar")).toEqual({ command: "ok", code: "1a2b3c4d", note: "pode mandar" });
    expect(parseFounderText("/nao 1A2B3C sem desconto")).toEqual({ command: "nao", code: "1a2b3c", note: "sem desconto" });
  });
  it("turns anything else into a task, including /ok without a code", () => {
    expect(parseFounderText("manda a amostra para a Bosch hoje")).toEqual({ command: "tarefa", text: "manda a amostra para a Bosch hoje" });
    expect(parseFounderText("/ok")).toEqual({ command: "tarefa", text: "/ok" });
    expect(parseFounderText("   ")).toEqual({ command: "ignorado" });
  });
  it("parses button payloads and rejects junk", () => {
    expect(parseCallbackData("ok:1a2b3c4d")).toEqual({ command: "ok", code: "1a2b3c4d", note: "" });
    expect(parseCallbackData("nao:1a2b3c4d")).toEqual({ command: "nao", code: "1a2b3c4d", note: "" });
    expect(parseCallbackData("tarefas")).toEqual({ command: "tarefas" });
    expect(parseCallbackData("ok:zz")).toEqual({ command: "ignorado" }); expect(parseCallbackData(undefined)).toEqual({ command: "ignorado" });
  });
  it("short codes, keyboard shape and webhook secret", () => {
    expect(shortCode("1a2b3c4d-0000-4000-8000-000000000000")).toBe("1a2b3c4d");
    expect(FOUNDER_KEYBOARD.keyboard[0]!.map((b) => b.text)).toEqual(["📊 Status", "📋 Tarefas", "❓ Ajuda"]);
    const a = telegramWebhookSecret("123:abc"); expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(telegramWebhookSecret("123:abd")).not.toBe(a); expect(() => telegramWebhookSecret("")).toThrow();
  });
  it("ops allows tasks ask with plain text only", () => {
    expect(cliAllowed("tasks ask 1a2b3c4d Posso oferecer 15% anual para a Bosch?")).toBe(true);
    expect(cliAllowed("tasks ask 1a2b3c4d rm -rf; echo")).toBe(false);
  });
});
