import path from "node:path";

import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform } from "@morphase/shared";

import { detectBinary, verifyBinary } from "../../src/helpers.js";

const installHints = {
  macos: { manager: "brew" as const, command: "brew install jpegoptim" },
  windows: { manager: "manual" as const, notes: ["Install jpegoptim manually or via WSL."] },
  linux: { manager: "apt-get" as const, command: "sudo apt-get install jpegoptim" }
};

export const jpegoptimPlugin: MorphasePlugin = definePlugin({
  id: "jpegoptim",
  name: "jpegoptim",
  priority: 100,
  commonProblems: [
    "jpegoptim only works with JPEG files.",
    "Quality values too low may produce visible artifacts."
  ],
  capabilities() {
    return [
      {
        kind: "transform",
        from: "jpg",
        to: null,
        operation: "compress",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"] as const,
        notes: ["Optimizes JPEG files by stripping metadata and applying lossy compression (quality 85)."]
      }
    ];
  },
  detect() {
    return detectBinary(["jpegoptim"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["jpegoptim"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade jpegoptim" },
      windows: { manager: "manual", notes: ["Install jpegoptim manually or via WSL."] },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade jpegoptim" }
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

    const outputDir = path.dirname(request.output);
    const inputName = path.parse(request.input).name;
    const ext = path.parse(request.input).ext || ".jpg";
    const generated = path.join(outputDir, `${inputName}${ext}`);

    return {
      command: "jpegoptim",
      args: ["--max=85", "--strip-all", "--all-progressive", "--dest", outputDir, request.input],
      expectedOutputs: [request.output],
      outputMapping:
        path.resolve(generated) === path.resolve(request.output)
          ? undefined
          : [{ source: generated, target: request.output }]
    };
  },
  async explain() {
    return "jpegoptim optimizes JPEG files by stripping metadata and applying quality 85 lossy compression.";
  }
});
