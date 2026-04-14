import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { Executor } from "../packages/engine/src/executor/executor.js";
import { Logger } from "../packages/engine/src/logging/logger.js";
import type { JobRequest, PlannedExecution } from "../packages/shared/src/index.js";

describe("Executor", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    for (const directory of tempRoots.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  it("does not persist stdoutFile output when the backend exits non-zero", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "morphase-executor-"));
    const stdoutFile = path.join(tempDir, "failed.txt");
    tempRoots.push(tempDir);

    const execution: PlannedExecution = {
      selectedPluginId: "fake",
      explanation: "test",
      warnings: [],
      installNeeded: false,
      fallbacks: [],
      steps: [
        {
          pluginId: "fake",
          route: {
            kind: "conversion",
            from: "url",
            to: "txt"
          },
          plan: {
            command: "sh",
            args: ["-c", "printf 'partial output'; exit 7"],
            stdoutFile,
            expectedOutputs: [stdoutFile]
          }
        }
      ]
    };

    const request: JobRequest = {
      input: "https://example.com",
      from: "url",
      to: "txt"
    };

    const result = await new Executor(new Logger(false)).run("job-1", execution, request);

    expect(result.status).toBe("failed");
    expect(fs.existsSync(stdoutFile)).toBe(false);
  });
});
