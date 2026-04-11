import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { DetectionResult, MuxoryPlugin, PlanRequest, Platform, ResourceKind } from "@muxory/shared";

import { packageHints } from "../../src/helpers.js";

const pythonCommands = ["python3", "python"];

async function detectDocling(): Promise<DetectionResult> {
  for (const command of pythonCommands) {
    try {
      const { runCommandCapture } = await import("@muxory/shared");
      const result = await runCommandCapture(command, [
        "-c",
        "import docling, sys; print(getattr(docling, '__version__', 'installed'))"
      ]);
      if (result.ok) {
        return {
          installed: true,
          version: result.stdout.trim() || "installed",
          command
        };
      }
    } catch {
      // Ignore and try the next command.
    }
  }

  return {
    installed: false,
    reason: "Docling was not detected in python3 or python."
  };
}

const installHints = packageHints(
  "pip install docling",
  "py -m pip install docling",
  "pip install docling",
  ["Docling is distributed as a Python package."]
);

export const doclingPlugin: MuxoryPlugin = definePlugin({
  id: "docling",
  name: "Docling",
  priority: 75,
  optional: true,
  commonProblems: [
    "Docling is heavier than MarkItDown and may need more Python dependencies.",
    "OCR-backed extraction depends on local optional components."
  ],
  capabilities() {
    const supported: ResourceKind[] = [
      "pdf",
      "docx",
      "pptx",
      "html"
    ];

    return supported.map((from) => ({
      kind: "extract" as const,
      from,
      to: "markdown" as const,
      quality: "high" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const
    }));
  },
  detect() {
    return detectDocling();
  },
  async verify() {
    const detection = await detectDocling();
    return {
      ok: detection.installed,
      issues: detection.installed ? [] : [detection.reason ?? "Docling is not installed."],
      warnings: detection.installed ? [] : []
    };
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "manual", command: "pip install --upgrade docling" },
      windows: { manager: "manual", command: "py -m pip install --upgrade docling" },
      linux: { manager: "manual", command: "pip install --upgrade docling" }
    });
  },
  async plan(request: PlanRequest) {
    if (
      request.route.kind !== "conversion" ||
      typeof request.input !== "string" ||
      request.route.to !== "markdown" ||
      !request.output
    ) {
      return null;
    }

    const detection = await detectDocling();
    if (!detection.command) {
      return null;
    }

    return {
      command: detection.command,
      args: [
        "-c",
        "from docling.document_converter import DocumentConverter; import pathlib, sys; conv = DocumentConverter().convert(sys.argv[1]); pathlib.Path(sys.argv[2]).write_text(conv.document.export_to_markdown(), encoding='utf-8')",
        request.input,
        request.output
      ],
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    return `Docling is the higher-quality Markdown extraction backend for ${request.from} to ${request.to}.`;
  }
});
