import { afterAll, describe, expect, it } from "vitest";

import { createMorphaseServer, validateServerHost } from "../apps/server/src/index.js";
import type { MorphaseEngine } from "../packages/engine/src/index.js";

function createStubEngine(overrides: Partial<MorphaseEngine> = {}): MorphaseEngine {
  return {
    submit: async () => ({
      jobId: "job-1",
      status: "success",
      outputPaths: [],
      logs: []
    }),
    capabilities: async () => [],
    doctorAll: async () => [],
    doctorBackend: async () => ({
      id: "pandoc",
      name: "Pandoc",
      installed: true,
      versionSupported: true,
      verified: true,
      issues: [],
      warnings: [],
      installHints: [],
      updateHints: [],
      commonProblems: []
    }),
    getJob: () => undefined,
    ...overrides
  } as unknown as MorphaseEngine;
}

describe("server safety", () => {
  const apps: Array<Awaited<ReturnType<typeof createMorphaseServer>>["app"]> = [];

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it("rejects invalid job payloads with a 400 response", async () => {
    const { app } = await createMorphaseServer(createStubEngine());
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: { input: 123, to: "pdf" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("INVALID_INPUT");
  });

  it("maps structured morphase errors to client responses", async () => {
    const error = Object.assign(new Error("bad input"), {
      details: {
        code: "INVALID_INPUT",
        message: "bad input"
      }
    });
    const { app } = await createMorphaseServer(
      createStubEngine({
        submit: async () => {
          throw error;
        }
      })
    );
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/jobs",
      payload: { input: "notes.md", to: "pdf" }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toBe("bad input");
  });

  it("refuses non-loopback hosts unless explicitly allowed", () => {
    expect(() => validateServerHost("0.0.0.0")).toThrow(/Refusing to bind morphase/);
    expect(validateServerHost("0.0.0.0", true)).toBe("0.0.0.0");
    expect(validateServerHost("127.0.0.1")).toBe("127.0.0.1");
  });
});
