import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { img2pdfPlugin, popplerPlugin } from "../packages/plugins/src/index.js";
import { Planner } from "../packages/engine/src/planner/planner.js";
import { PluginRegistry } from "../packages/engine/src/registry/plugin-registry.js";
import { normalizeRequest } from "../packages/engine/src/planner/normalize-request.js";
import { enrichError } from "../packages/engine/src/executor/executor.js";
import { resolveInstallHints, type MorphaseConfig, type MorphasePlugin, type PlanRequest, type RuntimeEnvironment } from "../packages/shared/src/index.js";

const baseConfig: MorphaseConfig = {
  offlineOnly: false,
  preferredBackends: {},
  debug: false,
  allowPackageManagerDelegation: false
};

const macosEnvironment: RuntimeEnvironment = {
  os: "macos",
  packageManagers: ["brew", "pipx", "pip", "npm"]
};

const linuxEnvironment: RuntimeEnvironment = {
  os: "linux",
  distro: "ubuntu",
  packageManagers: ["apt", "pipx", "pip", "npm"]
};

function createPlugin(plugin: Partial<MorphasePlugin> & Pick<MorphasePlugin, "id" | "name" | "priority">): MorphasePlugin {
  return {
    id: plugin.id,
    name: plugin.name,
    priority: plugin.priority,
    minimumVersion: plugin.minimumVersion,
    capabilities: plugin.capabilities ?? (() => []),
    detect: plugin.detect ?? (async () => ({ installed: true, command: plugin.id })),
    verify: plugin.verify ?? (async () => ({ ok: true, issues: [], warnings: [] })),
    getInstallStrategies: plugin.getInstallStrategies ?? (() => []),
    getUpdateStrategies: plugin.getUpdateStrategies,
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

describe("img2pdf plugin", () => {
  it("declares jpg->pdf capability", () => {
    const caps = img2pdfPlugin.capabilities();
    const cap = caps.find((c) => c.from === "jpg" && c.to === "pdf");
    expect(cap).toBeDefined();
    expect(cap?.kind).toBe("convert");
    expect(cap?.quality).toBe("high");
    expect(cap?.offline).toBe(true);
  });

  it("declares png->pdf capability", () => {
    const caps = img2pdfPlugin.capabilities();
    const cap = caps.find((c) => c.from === "png" && c.to === "pdf");
    expect(cap).toBeDefined();
    expect(cap?.quality).toBe("high");
  });

  it("does not declare webp->pdf capability", () => {
    const caps = img2pdfPlugin.capabilities();
    const cap = caps.find((c) => c.from === "webp" && c.to === "pdf");
    expect(cap).toBeUndefined();
  });

  it("builds a plan for a single jpg->pdf", async () => {
    const plan = await img2pdfPlugin.plan({
      input: "photo.jpg",
      from: "jpg",
      to: "pdf",
      output: "photo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("img2pdf");
    expect(plan?.args).toContain("photo.jpg");
    expect(plan?.args).toContain("-o");
    expect(plan?.args).toContain("photo.pdf");
    expect(plan?.expectedOutputs).toContain("photo.pdf");
  });

  it("builds a plan for multiple images -> pdf", async () => {
    const plan = await img2pdfPlugin.plan({
      input: ["img1.jpg", "img2.png", "img3.jpg"],
      from: "jpg",
      to: "pdf",
      output: "combined.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("img2pdf");
    expect(plan?.args).toContain("img1.jpg");
    expect(plan?.args).toContain("img2.png");
    expect(plan?.args).toContain("img3.jpg");
    expect(plan?.args).toContain("-o");
    expect(plan?.args).toContain("combined.pdf");
    expect(plan?.expectedOutputs).toEqual(["combined.pdf"]);
  });

  it("returns null for unsupported input types (webp)", async () => {
    const plan = await img2pdfPlugin.plan({
      input: "photo.webp",
      from: "webp",
      to: "pdf",
      output: "photo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "webp", to: "pdf" }
    });

    expect(plan).toBeNull();
  });

  it("returns null for unsupported output formats", async () => {
    const plan = await img2pdfPlugin.plan({
      input: "photo.jpg",
      from: "jpg",
      to: "png",
      output: "photo.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "png" }
    });

    expect(plan).toBeNull();
  });

  it("returns null when output is missing", async () => {
    const plan = await img2pdfPlugin.plan({
      input: "photo.jpg",
      from: "jpg",
      to: "pdf",
      output: undefined as unknown as string,
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan).toBeNull();
  });

  it("returns install hints for macOS", () => {
    const hints = resolveInstallHints(img2pdfPlugin.getInstallStrategies(), macosEnvironment);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.command).toContain("pip");
  });

  it("returns install hints for Linux", () => {
    const hints = resolveInstallHints(img2pdfPlugin.getInstallStrategies(), linuxEnvironment);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.command).toContain("pip");
  });

  it("explain mentions lossless conversion for single input", async () => {
    const explanation = await img2pdfPlugin.explain({
      input: "photo.jpg",
      from: "jpg",
      to: "pdf",
      output: "photo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(explanation).toContain("lossless");
  });

  it("explain mentions multiple images for multi-input", async () => {
    const explanation = await img2pdfPlugin.explain({
      input: ["a.jpg", "b.png"],
      from: "jpg",
      to: "pdf",
      output: "out.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(explanation).toContain("2");
    expect(explanation).toContain("images");
  });
});

describe("poppler plugin", () => {
  it("declares pdf->png capability", () => {
    const caps = popplerPlugin.capabilities();
    const cap = caps.find((c) => c.from === "pdf" && c.to === "png");
    expect(cap).toBeDefined();
    expect(cap?.kind).toBe("convert");
    expect(cap?.quality).toBe("high");
    expect(cap?.offline).toBe(true);
  });

  it("declares pdf->jpg capability", () => {
    const caps = popplerPlugin.capabilities();
    const cap = caps.find((c) => c.from === "pdf" && c.to === "jpg");
    expect(cap).toBeDefined();
    expect(cap?.quality).toBe("high");
  });

  it("declares pdf extract-images capability", () => {
    const caps = popplerPlugin.capabilities();
    const cap = caps.find((c) => c.operation === "extract-images");
    expect(cap).toBeDefined();
    expect(cap?.kind).toBe("extract");
    expect(cap?.quality).toBe("medium");
  });

  it("builds a plan for pdf->png", async () => {
    const plan = await popplerPlugin.plan({
      input: "document.pdf",
      from: "pdf",
      to: "png",
      output: "/tmp/document.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("pdftocairo");
    expect(plan?.args).toContain("-png");
    expect(plan?.args).toContain("-r");
    expect(plan?.args).toContain("150");
    expect(plan?.collectFromDir).toBe("/tmp");
  });

  it("builds a plan for pdf->jpg", async () => {
    const plan = await popplerPlugin.plan({
      input: "document.pdf",
      from: "pdf",
      to: "jpg",
      output: "/tmp/document.jpg",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "jpg" }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("pdftocairo");
    expect(plan?.args).toContain("-jpeg");
    expect(plan?.args).toContain("-r");
    expect(plan?.args).toContain("150");
    expect(plan?.collectFromDir).toBe("/tmp");
  });

  it("uses output path without extension as prefix for pdftocairo", async () => {
    const plan = await popplerPlugin.plan({
      input: "document.pdf",
      from: "pdf",
      to: "png",
      output: "/tmp/output.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan?.args).toContain("/tmp/output");
  });

  it("builds a plan for pdf extract-images", async () => {
    const plan = await popplerPlugin.plan({
      input: "document.pdf",
      from: "pdf",
      operation: "extract-images",
      output: "/tmp/doc-images",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "operation", resource: "pdf", action: "extract-images" }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("pdfimages");
    expect(plan?.args).toContain("-png");
    expect(plan?.args).toContain("document.pdf");
    expect(plan?.args).toContain("/tmp/doc-images");
    expect(plan?.collectFromDir).toBe("/tmp");
  });

  it("returns null for unsupported conversions", async () => {
    const plan = await popplerPlugin.plan({
      input: "document.pdf",
      from: "pdf",
      to: "docx",
      output: "document.docx",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "docx" }
    });

    expect(plan).toBeNull();
  });

  it("returns null for multi-input", async () => {
    const plan = await popplerPlugin.plan({
      input: ["a.pdf", "b.pdf"],
      from: "pdf",
      to: "png",
      output: "/tmp/out.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan).toBeNull();
  });

  it("returns install hints for macOS", () => {
    const hints = resolveInstallHints(popplerPlugin.getInstallStrategies(), macosEnvironment);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.command).toContain("poppler");
  });

  it("returns install hints for Linux", () => {
    const hints = resolveInstallHints(popplerPlugin.getInstallStrategies(), linuxEnvironment);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.command).toContain("poppler-utils");
  });

  it("explain mentions rendering for pdf->png", async () => {
    const explanation = await popplerPlugin.explain({
      input: "doc.pdf",
      from: "pdf",
      to: "png",
      output: "/tmp/doc.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(explanation).toContain("PNG");
    expect(explanation).toContain("pdftocairo");
  });

  it("explain mentions extraction for extract-images", async () => {
    const explanation = await popplerPlugin.explain({
      input: "doc.pdf",
      from: "pdf",
      operation: "extract-images",
      output: "/tmp/doc-images",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "operation", resource: "pdf", action: "extract-images" }
    });

    expect(explanation).toContain("pdfimages");
    expect(explanation).toContain("embedded");
  });
});

describe("planner selection for image/pdf routes", () => {
  it("selects img2pdf for jpg->pdf", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "img2pdf",
        name: "img2pdf",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "jpg", to: "pdf", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] }
        ],
        plan: async (req) => ({
          command: "img2pdf",
          args: [String(req.input), "-o", req.output ?? "out.pdf"],
          expectedOutputs: [req.output ?? "out.pdf"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "photo.jpg",
      from: "jpg",
      to: "pdf",
      output: "photo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan.selectedPluginId).toBe("img2pdf");
    expect(plan.explanation).toContain("preferred");
  });

  it("selects poppler for pdf->png", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "poppler",
        name: "Poppler",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "pdf", to: "png", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] }
        ],
        plan: async (req) => ({
          command: "pdftocairo",
          args: ["-png", "-r", "150", String(req.input), req.output ?? "out"],
          collectFromDir: "/tmp"
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "doc.pdf",
      from: "pdf",
      to: "png",
      output: "/tmp/doc.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan.selectedPluginId).toBe("poppler");
  });

  it("selects poppler for pdf->jpg", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "poppler",
        name: "Poppler",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "pdf", to: "jpg", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] }
        ],
        plan: async (req) => ({
          command: "pdftocairo",
          args: ["-jpeg", "-r", "150", String(req.input), req.output ?? "out"],
          collectFromDir: "/tmp"
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "doc.pdf",
      from: "pdf",
      to: "jpg",
      output: "/tmp/doc.jpg",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "jpg" }
    });

    expect(plan.selectedPluginId).toBe("poppler");
  });

  it("reports installNeeded when img2pdf is missing", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "img2pdf",
        name: "img2pdf",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "jpg", to: "pdf", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] }
        ],
        detect: async () => ({ installed: false, reason: "img2pdf not found" }),
        verify: async () => ({ ok: false, issues: ["not installed"], warnings: [] }),
        getInstallStrategies: () => [{ kind: "manual", label: "Install img2pdf manually" }],
        plan: async () => null
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "photo.jpg",
      from: "jpg",
      to: "pdf",
      output: "photo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan.installNeeded).toBe(true);
    expect(plan.selectedPluginId).toBe("img2pdf");
  });

  it("reports installNeeded when poppler is missing for pdf->png", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "poppler",
        name: "Poppler",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "pdf", to: "png", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] }
        ],
        detect: async () => ({ installed: false, reason: "pdftocairo not found" }),
        verify: async () => ({ ok: false, issues: ["not installed"], warnings: [] }),
        getInstallStrategies: () => [{ kind: "package-manager", manager: "brew", command: { file: "brew", args: ["install", "poppler"] } }],
        plan: async () => null
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "doc.pdf",
      from: "pdf",
      to: "png",
      output: "/tmp/doc.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan.installNeeded).toBe(true);
    expect(plan.selectedPluginId).toBe("poppler");
  });
});

describe("normalize-request multi-image validation", () => {
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "morphase-img-test-"));
  const originalCwd = process.env.MORPHASE_CWD;

  beforeAll(() => {
    process.env.MORPHASE_CWD = fixtureDir;
    fs.writeFileSync(path.join(fixtureDir, "a.jpg"), "");
    fs.writeFileSync(path.join(fixtureDir, "b.png"), "");
    fs.writeFileSync(path.join(fixtureDir, "c.webp"), "");
    fs.writeFileSync(path.join(fixtureDir, "d.pdf"), "");
  });

  afterAll(() => {
    if (originalCwd === undefined) {
      delete process.env.MORPHASE_CWD;
    } else {
      process.env.MORPHASE_CWD = originalCwd;
    }
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("accepts multiple jpg/png inputs for pdf output", () => {
    const normalized = normalizeRequest(
      { input: ["a.jpg", "b.png"], to: "pdf", output: "combined.pdf" },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "jpg",
      to: "pdf"
    });
    expect(normalized.planRequest.input).toEqual([
      path.join(fixtureDir, "a.jpg"),
      path.join(fixtureDir, "b.png")
    ]);
  });

  it("accepts mixed jpg/png/webp inputs for pdf output", () => {
    const normalized = normalizeRequest(
      { input: ["a.jpg", "b.png", "c.webp"], to: "pdf", output: "combined.pdf" },
      { offlineOnly: false }
    );

    expect(normalized.route.kind).toBe("conversion");
    if (normalized.route.kind === "conversion") {
      expect(normalized.route.to).toBe("pdf");
    }
  });

  it("rejects non-image inputs when converting multiple files to pdf", () => {
    expect(() =>
      normalizeRequest(
        { input: ["a.jpg", "d.pdf"], to: "pdf", output: "combined.pdf" },
        { offlineOnly: false }
      )
    ).toThrow(/not images/);
  });

  it("allows single non-image input for pdf conversion (no multi-image validation)", () => {
    const normalized = normalizeRequest(
      { input: "d.pdf", from: "pdf", to: "docx", output: "d.docx" },
      { offlineOnly: false }
    );

    expect(normalized.route.kind).toBe("conversion");
  });
});

describe("error enrichment for img2pdf and poppler", () => {
  const baseError = {
    code: "BACKEND_EXECUTION_FAILED",
    message: "Command failed",
    backendId: "img2pdf"
  };

  it("enriches img2pdf unsupported image errors", () => {
    const enriched = enrichError(
      "img2pdf",
      baseError,
      "unsupported image format: cannot process this file"
    );

    expect(enriched.likelyCause).toContain("img2pdf cannot process");
    expect(enriched.suggestedFixes?.length).toBeGreaterThan(0);
  });

  it("enriches img2pdf file not found errors", () => {
    const enriched = enrichError(
      "img2pdf",
      baseError,
      "No such file or directory: missing.jpg"
    );

    expect(enriched.likelyCause).toContain("could not find");
  });

  it("enriches poppler not-a-PDF errors", () => {
    const enriched = enrichError(
      "poppler",
      { ...baseError, backendId: "poppler" },
      "Syntax Error: Couldn't read xref table"
    );

    expect(enriched.likelyCause).toContain("not a valid PDF");
  });

  it("enriches poppler encrypted PDF errors", () => {
    const enriched = enrichError(
      "poppler",
      { ...baseError, backendId: "poppler" },
      "Error: This document is encrypted"
    );

    expect(enriched.likelyCause).toContain("encrypted");
  });

  it("enriches poppler file not found errors", () => {
    const enriched = enrichError(
      "poppler",
      { ...baseError, backendId: "poppler" },
      "Error: unable to open file"
    );

    expect(enriched.likelyCause).toContain("could not find");
  });
});

describe("equivalent commands for image/pdf routes", () => {
  it("generates convert command for multi-image -> pdf", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "img2pdf",
        name: "img2pdf",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "jpg", to: "pdf", quality: "high", offline: true, platforms: ["macos"] }
        ],
        plan: async (req) => ({
          command: "img2pdf",
          args: [...(Array.isArray(req.input) ? req.input : [req.input]), "-o", req.output ?? "out.pdf"],
          expectedOutputs: [req.output ?? "out.pdf"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: ["img1.jpg", "img2.png"],
      from: "jpg",
      to: "pdf",
      output: "combined.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "jpg", to: "pdf" }
    });

    expect(plan.equivalentCommand).toContain("morphase convert");
    expect(plan.equivalentCommand).toContain("combined.pdf");
  });

  it("generates convert command for pdf->png", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "poppler",
        name: "Poppler",
        priority: 100,
        capabilities: () => [
          { kind: "convert", from: "pdf", to: "png", quality: "high", offline: true, platforms: ["macos"] }
        ],
        plan: async (req) => ({
          command: "pdftocairo",
          args: ["-png", String(req.input), req.output ?? "out"],
          collectFromDir: "/tmp"
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "doc.pdf",
      from: "pdf",
      to: "png",
      output: "doc.png",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "conversion", from: "pdf", to: "png" }
    });

    expect(plan.equivalentCommand).toContain("morphase convert");
    expect(plan.equivalentCommand).toContain("doc.pdf");
    expect(plan.equivalentCommand).toContain("doc.png");
  });

  it("generates pdf extract-images command for operation route", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "poppler",
        name: "Poppler",
        priority: 100,
        capabilities: () => [
          { kind: "extract", from: "pdf", to: null, operation: "extract-images", quality: "medium", offline: true, platforms: ["macos"] }
        ],
        plan: async (req) => ({
          command: "pdfimages",
          args: ["-png", String(req.input), req.output ?? "out"],
          collectFromDir: "/tmp"
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "doc.pdf",
      from: "pdf",
      operation: "extract-images",
      output: "doc-images",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: { kind: "operation", resource: "pdf", action: "extract-images" }
    });

    expect(plan.equivalentCommand).toContain("morphase pdf extract-images");
    expect(plan.equivalentCommand).toContain("doc.pdf");
  });
});
