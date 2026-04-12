import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform } from "@morphase/shared";

import { detectBinary, verifyBinary } from "../../src/helpers.js";

const installHints = {
  macos: { manager: "brew" as const, command: "brew install optipng" },
  windows: { manager: "manual" as const, notes: ["Install optipng manually or via WSL."] },
  linux: { manager: "apt-get" as const, command: "sudo apt-get install optipng" }
};

export const optipngPlugin: MorphasePlugin = definePlugin({
  id: "optipng",
  name: "optipng",
  priority: 95,
  commonProblems: [
    "optipng only works with PNG files.",
    "Maximum optimization (-o7) can be slow for large files."
  ],
  capabilities() {
    return [
      {
        kind: "transform",
        from: "png",
        to: null,
        operation: "compress",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"] as const,
        notes: ["Losslessly optimizes PNG files. No quality loss."]
      }
    ];
  },
  detect() {
    return detectBinary(["optipng"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["optipng"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade optipng" },
      windows: { manager: "manual", notes: ["Install optipng manually or via WSL."] },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade optipng" }
    });
  },
  async plan(request: PlanRequest) {
    if (
      request.route.kind !== "operation" ||
      request.route.action !== "compress" ||
      typeof request.input !== "string" ||
      !request.output
    ) {
      return null;
    }

    return {
      command: "optipng",
      args: ["-o5", "-strip", "all", "-out", request.output, request.input],
      expectedOutputs: [request.output]
    };
  },
  async explain() {
    return "optipng performs lossless PNG optimization with no quality reduction.";
  }
});
