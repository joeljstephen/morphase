import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  { brew: "qpdf", winget: "QPDF.QPDF", choco: "qpdf", scoop: "qpdf", apt: "qpdf", dnf: "qpdf", yum: "qpdf", pacman: "qpdf", zypper: "qpdf", nix: "qpdf" },
  { label: "Install qpdf manually", url: "https://qpdf.readthedocs.io/en/stable/download.html" }
);

const updateStrategies = buildUpdateStrategies(
  { brew: "qpdf", winget: "QPDF.QPDF", choco: "qpdf", scoop: "qpdf", apt: "qpdf", dnf: "qpdf", yum: "qpdf", pacman: "qpdf", zypper: "qpdf" },
  { label: "Update qpdf manually", url: "https://qpdf.readthedocs.io/en/stable/download.html" }
);

export const qpdfPlugin: MorphasePlugin = definePlugin({
  id: "qpdf",
  name: "qpdf",
  priority: 100,
  minimumVersion: "11.0.0",
  commonProblems: [
    "qpdf handles structural PDF operations, not text extraction.",
    "Split in morphase uses explicit page-range extraction for deterministic output paths."
  ],
  capabilities() {
    return [
      {
        kind: "transform",
        from: "pdf",
        to: null,
        operation: "merge",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      },
      {
        kind: "transform",
        from: "pdf",
        to: null,
        operation: "split",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["morphase's split command extracts the requested page range to a new PDF."]
      },
      {
        kind: "transform",
        from: "pdf",
        to: null,
        operation: "optimize",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      }
    ];
  },
  detect() {
    return detectBinary(["qpdf"]);
  },
  async verify() {
    return verifyBinary(["qpdf"], ["--version"], "11.0.0");
  },
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "operation" || !request.output) {
      return null;
    }

    if (request.route.action === "merge" && Array.isArray(request.input) && request.input.length >= 2) {
      return {
        command: "qpdf",
        args: ["--empty", "--pages", ...request.input, "--", request.output],
        expectedOutputs: [request.output]
      };
    }

    if (
      request.route.action === "split" &&
      typeof request.input === "string" &&
      typeof request.options.pages === "string"
    ) {
      return {
        command: "qpdf",
        args: [request.input, "--pages", request.input, String(request.options.pages), "--", request.output],
        expectedOutputs: [request.output]
      };
    }

    if (request.route.action === "optimize" && typeof request.input === "string") {
      return {
        command: "qpdf",
        args: ["--linearize", request.input, request.output],
        expectedOutputs: [request.output]
      };
    }

    return null;
  },
  async explain(request: PlanRequest) {
    return `qpdf is the preferred PDF-native backend for ${request.operation}.`;
  }
});
