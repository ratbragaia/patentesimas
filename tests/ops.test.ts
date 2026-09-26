import { describe, it, expect } from "vitest";
import { resolveJob } from "../src/ops/jobs.js";

describe("ops job catalogue", () => {
  it("rejects unknown jobs and free-form commands", () => {
    expect(resolveJob("bash")).toBeNull(); expect(resolveJob("cli", ["rm -rf /"])).toBeNull();
    expect(resolveJob("logs", ["sshd"])).toBeNull(); expect(resolveJob("restart", ["ssh"])).toBeNull();
  });
  it("accepts catalogued jobs", () => {
    expect(resolveJob("status")).not.toBeNull();
    expect(resolveJob("logs", ["patentsonar-ingest", "50"])!.argv).toContain("patentsonar-ingest");
    expect(resolveJob("restart", ["caddy"])!.argv).toEqual(["sudo", "systemctl", "restart", "caddy"]);
    expect(resolveJob("cli", ["tasks", "list"])).not.toBeNull();
  });
});
