import path from "node:path";

import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install jpegoptim"),
  strategyForManager("apt", "sudo apt-get install jpegoptim"),
  strategyForManager("dnf", "sudo dnf install jpegoptim"),
  strategyForManager("yum", "sudo yum install jpegoptim"),
  strategyForManager("pacman", "sudo pacman -S jpegoptim"),
  strategyForManager("zypper", "sudo zypper install jpegoptim"),
  manualStrategy("Install jpegoptim manually", {
    notes: ["jpegoptim is not bundled with Morphase on Windows. Install it manually or use WSL."]
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade jpegoptim"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade jpegoptim"),
  strategyForManager("dnf", "sudo dnf upgrade jpegoptim"),
  strategyForManager("yum", "sudo yum update jpegoptim"),
  strategyForManager("pacman", "sudo pacman -Syu jpegoptim"),
  strategyForManager("zypper", "sudo zypper update jpegoptim"),
  manualStrategy("Update jpegoptim manually", {
    notes: ["On Windows, update the manual or WSL installation you use for jpegoptim."]
  })
];

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
