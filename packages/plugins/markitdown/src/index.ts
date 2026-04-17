import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, ResourceKind } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const sharedNotes = ["MarkItDown is a Python package and is commonly installed via pip or pipx."];

const installStrategies = buildInstallStrategies(
  { pipx: "markitdown[all]", pip: "markitdown[all]" },
  { label: "Install Python 3 and MarkItDown manually", notes: ["Ensure the markitdown executable is on PATH after installation."] },
  sharedNotes
);

const updateStrategies = buildUpdateStrategies(
  { pipx: "markitdown[all]", pip: "markitdown[all]" },
  { label: "Update MarkItDown manually", notes: ["Use your Python package manager to update MarkItDown and keep it on PATH."] }
);

export const markitdownPlugin: MorphasePlugin = definePlugin({
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
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
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
