import { spawnSync } from "node:child_process";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const cliEntry = path.join(repoRoot, "apps/cli/dist/index.js");

beforeAll(() => {
  const build = spawnSync("pnpm", ["build"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout || "Failed to build workspace before CLI tests.");
  }
});

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
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
