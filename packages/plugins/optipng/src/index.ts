import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  { brew: "optipng", winget: "OptiPNG.OptiPNG", choco: "optipng", scoop: "optipng", apt: "optipng", dnf: "optipng", yum: "optipng", pacman: "optipng", zypper: "optipng", nix: "optipng" },
  { label: "Install optipng manually" }
);

const updateStrategies = buildUpdateStrategies(
  { brew: "optipng", winget: "OptiPNG.OptiPNG", choco: "optipng", scoop: "optipng", apt: "optipng", dnf: "optipng", yum: "optipng", pacman: "optipng", zypper: "optipng" },
  { label: "Update optipng manually" }
);

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
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
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
