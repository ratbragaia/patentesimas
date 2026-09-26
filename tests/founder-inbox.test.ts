import { describe, it, expect } from "vitest";
import { parseFounderText, shortCode } from "../src/reporting/founder-inbox.js";
import { telegramWebhookSecret } from "../src/reporting/telegram.js";

describe("founder telegram commands", () => {
  it("parses the Portuguese commands and English aliases", () => {
    expect(parseFounderText("/status")).toEqual({ command: "status" });
    expect(parseFounderText("/tarefas@patentsonar_bot")).toEqual({ command: "tarefas" });
    expect(parseFounderText("/help")).toEqual({ command: "ajuda" });
    expect(parseFounderText("/ok 1a2b3c4d pode mandar")).toEqual({ command: "ok", code: "1a2b3c4d", note: "pode mandar" });
    expect(parseFounderText("/nao 1A2B3C sem desconto")).toEqual({ command: "nao", code: "1a2b3c", note: "sem desconto" });
  });
  it("turns anything else into a task, including /ok without a code", () => {
    expect(parseFounderText("manda a amostra para a Bosch hoje")).toEqual({ command: "tarefa", text: "manda a amostra para a Bosch hoje" });
    expect(parseFounderText("/ok")).toEqual({ command: "tarefa", text: "/ok" });
    expect(parseFounderText("   ")).toEqual({ command: "ignorado" });
  });
  it("short codes are the first 8 hex chars of the task id", () => {
    expect(shortCode("1a2b3c4d-0000-4000-8000-000000000000")).toBe("1a2b3c4d");
  });
  it("derives a stable webhook secret from the bot token only", () => {
    const a = telegramWebhookSecret("123:abc"); expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(telegramWebhookSecret("123:abc")).toBe(a); expect(telegramWebhookSecret("123:abd")).not.toBe(a);
    expect(() => telegramWebhookSecret("")).toThrow();
  });
});
