import { describe, it, expect } from "vitest";
import { resolveJob, cliAllowed } from "../src/ops/jobs.js";

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
    expect(resolveJob("caddy-sync")!.argv.join(" ")).toContain("caddy validate");
    expect(resolveJob("site-check")).not.toBeNull();
  });
  it("allows only the catalogued CLI shapes", () => {
    for (const ok of ["samples list", "ingest bigquery", "ingest bigquery dry-run", "ingest bigquery backfill dry-run", "report monthly", "report monthly 2026-08", "report monthly 2026-08 print", "newsletter send 202608"]) expect(cliAllowed(ok), ok).toBe(true);
    for (const bad of ["ingest bigquery /etc/passwd", "report monthly; rm -rf /", "newsletter send 1 2", "report monthly 2026-8", "ingest bigquery backfill dry-run extra"]) expect(cliAllowed(bad), bad).toBe(false);
  });
});
