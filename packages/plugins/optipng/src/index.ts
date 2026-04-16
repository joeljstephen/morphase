import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install optipng"),
  strategyForManager("apt", "sudo apt-get install optipng"),
  strategyForManager("dnf", "sudo dnf install optipng"),
  strategyForManager("yum", "sudo yum install optipng"),
  strategyForManager("pacman", "sudo pacman -S optipng"),
  strategyForManager("zypper", "sudo zypper install optipng"),
  manualStrategy("Install optipng manually", {
    notes: ["optipng is not bundled with Morphase on Windows. Install it manually or use WSL."]
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade optipng"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade optipng"),
  strategyForManager("dnf", "sudo dnf upgrade optipng"),
  strategyForManager("yum", "sudo yum update optipng"),
  strategyForManager("pacman", "sudo pacman -Syu optipng"),
  strategyForManager("zypper", "sudo zypper update optipng"),
  manualStrategy("Update optipng manually", {
    notes: ["On Windows, update the manual or WSL installation you use for optipng."]
  })
];

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
