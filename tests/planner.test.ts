import { describe, expect, it } from "vitest";

import { Planner } from "../packages/engine/src/planner/planner.js";
import { PluginRegistry } from "../packages/engine/src/registry/plugin-registry.js";
import type { MuxoryConfig, MuxoryPlugin, PlanRequest } from "../packages/shared/src/index.js";

const baseConfig: MuxoryConfig = {
  offlineOnly: false,
  preferredBackends: {},
  debug: false,
  allowPackageManagerDelegation: false,
  server: {
    host: "127.0.0.1",
    port: 3210
  }
};

function createPlugin(plugin: Partial<MuxoryPlugin> & Pick<MuxoryPlugin, "id" | "name" | "priority">): MuxoryPlugin {
  return {
    id: plugin.id,
    name: plugin.name,
    priority: plugin.priority,
    capabilities: plugin.capabilities ?? (() => []),
    detect: plugin.detect ?? (async () => ({ installed: true, command: plugin.id })),
    verify: plugin.verify ?? (async () => ({ ok: true, issues: [], warnings: [] })),
    getInstallHints: plugin.getInstallHints ?? (() => []),
    plan:
      plugin.plan ??
      (async () => ({
        command: plugin.id,
        args: [],
        expectedOutputs: ["/tmp/out.pdf"]
      })),
    explain: plugin.explain ?? (async () => `${plugin.name}`)
  };
}

describe("Planner", () => {
  it("prefers the route recommendation when multiple plugins match", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "fallback",
        name: "Fallback",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "docx",
            to: "pdf",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ]
      }),
      createPlugin({
        id: "libreoffice",
        name: "LibreOffice",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "docx",
            to: "pdf",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ]
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "demo.docx",
      from: "docx",
      to: "pdf",
      output: "demo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "docx",
        to: "pdf"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("libreoffice");
  });

  it("can use a curated pipeline when no direct candidate exists", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "pandoc",
        name: "Pandoc",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "markdown",
            to: "txt",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "pandoc",
          args: [String(request.input), "-o", request.output ?? "out.txt"],
          expectedOutputs: [request.output ?? "out.txt"]
        })
      }),
      createPlugin({
        id: "markitdown",
        name: "MarkItDown",
        priority: 10,
        capabilities: () => [
          {
            kind: "extract",
            from: "pdf",
            to: "markdown",
            quality: "medium",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "markitdown",
          args: [String(request.input), "-o", request.output ?? "out.md"],
          expectedOutputs: [request.output ?? "out.md"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "demo.pdf",
      from: "pdf",
      to: "txt",
      output: "demo.txt",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "pdf",
        to: "txt"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("pipeline:pdf-to-txt-via-markdown");
    expect(plan.steps).toHaveLength(2);
  });
});
