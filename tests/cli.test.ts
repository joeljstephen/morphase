import { spawnSync } from "node:child_process";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const cliEntry = path.join(repoRoot, "apps/cli/src/index.ts");

function runCli(args: string[]) {
  return spawnSync(process.execPath, ["--import", "tsx", cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

describe("CLI exit codes", () => {
  it("returns a non-zero exit code for preflight validation errors", () => {
    const result = runCli(["convert", "notes.md"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Missing output path");
  });

  it("returns a non-zero exit code for backend lookup errors", () => {
    const result = runCli(["backend", "verify", "does-not-exist"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown backend");
  });
});
