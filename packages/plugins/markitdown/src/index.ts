import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform, ResourceKind } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "pip install 'markitdown[all]'",
  "py -m pip install markitdown[all]",
  "pip install 'markitdown[all]'",
  ["MarkItDown is a Python package and is commonly installed via pip."]
);

export const markitdownPlugin: MuxoryPlugin = definePlugin({
  id: "markitdown",
  name: "MarkItDown",
  priority: 80,
  optional: true,
  commonProblems: [
    "Optional feature groups may be required for specific file formats.",
    "Markdown output is meant for extraction workflows rather than layout fidelity."
  ],
  capabilities() {
    const supported: ResourceKind[] = [
      "pdf",
      "docx",
      "pptx",
      "html",
      "xlsx"
    ];

    return supported.map((from) => ({
      kind: "extract" as const,
      from,
      to: "markdown" as const,
      quality: "medium" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const
    }));
  },
  detect() {
    return detectBinary(["markitdown"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["markitdown"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "manual", command: "pip install --upgrade 'markitdown[all]'" },
      windows: { manager: "manual", command: "py -m pip install --upgrade markitdown[all]" },
      linux: { manager: "manual", command: "pip install --upgrade 'markitdown[all]'" }
    });
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || typeof request.input !== "string" || request.route.to !== "markdown" || !request.output) {
      return null;
    }

    return {
      command: "markitdown",
      args: [request.input, "-o", request.output],
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    return `MarkItDown is the lightweight Markdown extraction backend for ${request.from} to ${request.to}.`;
  }
});
