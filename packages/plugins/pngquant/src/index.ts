import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install pngquant",
  "sudo apt-get install pngquant",
  "sudo apt-get install pngquant"
);

export const pngquantPlugin: MuxoryPlugin = definePlugin({
  id: "pngquant",
  name: "pngquant",
  priority: 90,
  commonProblems: [
    "pngquant only works with PNG files.",
    "Lossy compression reduces color depth, which may affect quality."
  ],
  capabilities() {
    return [
      {
        kind: "transform",
        from: "png",
        to: null,
        operation: "compress",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"] as const,
        notes: ["Lossy PNG compression via intelligent color quantization. 60-80% size reduction."]
      }
    ];
  },
  detect() {
    return detectBinary(["pngquant"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["pngquant"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade pngquant" },
      windows: { manager: "manual", notes: ["Install pngquant manually or via WSL."] },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade pngquant" }
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
      command: "pngquant",
      args: ["--quality=65-85", "--strip", "--skip-if-larger", "--output", request.output, request.input],
      expectedOutputs: [request.output]
    };
  },
  async explain() {
    return "pngquant applies lossy PNG compression via color quantization, typically achieving 60-80% size reduction.";
  }
});
