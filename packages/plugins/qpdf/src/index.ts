import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform } from "@morphase/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install qpdf",
  "winget install QPDF.QPDF",
  "sudo apt-get install qpdf"
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
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade qpdf" },
      windows: { manager: "winget", command: "winget upgrade QPDF.QPDF" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade qpdf" }
    });
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

