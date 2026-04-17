import { spawnSync } from "node:child_process";
import path from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

const repoRoot = process.cwd();
const cliEntry = path.join(repoRoot, "apps/cli/dist/index.js");

beforeAll(() => {
  const build = spawnSync("pnpm", ["build"], {
    cwd: repoRoot,
    encoding: "utf8",
    shell: true
  });

  if (build.status !== 0) {
    throw new Error(build.stderr || build.stdout || "Failed to build workspace before CLI tests.");
  }
}, 30000);

function runCli(args: string[]) {
  return spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: repoRoot,
    encoding: "utf8"
  });
}

describe("CLI exit codes", () => {
  it("prints updated top-level help text", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("txt, markdown, transcript, or images");
    expect(result.stdout).toContain("morphase media ./podcast.mp3 --to transcript -o transcript.txt");
    expect(result.stdout).not.toContain("JSON");
  });

  it("returns a non-zero exit code for preflight validation errors", () => {
    const result = runCli(["convert", "notes.md"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Missing output path");
  });

  it("returns a clear error when image compression is used with a non-image input", () => {
    const result = runCli(["image", "compress", "README.md"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Image compression expects an image input");
  });

  it("returns a clear error when video compression is used with a non-video input", () => {
    const result = runCli(["video", "compress", "README.md"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Video compression expects a video input");
  });

  it("returns a non-zero exit code for backend lookup errors", () => {
    const result = runCli(["backend", "verify", "does-not-exist"]);

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("Unknown backend");
  });
});
