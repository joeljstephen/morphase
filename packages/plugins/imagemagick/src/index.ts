import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Quality, ResourceKind } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, supportsImageMagickFormat, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install imagemagick"),
  strategyForManager("winget", "winget install ImageMagick.ImageMagick"),
  strategyForManager("apt", "sudo apt-get install imagemagick"),
  strategyForManager("dnf", "sudo dnf install ImageMagick"),
  strategyForManager("yum", "sudo yum install ImageMagick"),
  strategyForManager("pacman", "sudo pacman -S imagemagick"),
  strategyForManager("zypper", "sudo zypper install ImageMagick"),
  manualStrategy("Install ImageMagick manually", {
    url: "https://imagemagick.org/script/download.php"
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade imagemagick"),
  strategyForManager("winget", "winget upgrade ImageMagick.ImageMagick"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade imagemagick"),
  strategyForManager("dnf", "sudo dnf upgrade ImageMagick"),
  strategyForManager("yum", "sudo yum update ImageMagick"),
  strategyForManager("pacman", "sudo pacman -Syu imagemagick"),
  strategyForManager("zypper", "sudo zypper update ImageMagick"),
  manualStrategy("Update ImageMagick manually", {
    url: "https://imagemagick.org/script/download.php"
  })
];

async function selectedImageCommand(): Promise<string> {
  const detection = await detectBinary(["magick", "convert"], ["-version"]);
  return detection.command ?? "magick";
}

export const imageMagickPlugin: MorphasePlugin = definePlugin({
  id: "imagemagick",
  name: "ImageMagick",
  priority: 100,
  minimumVersion: "7.0.0",
  commonProblems: [
    "Delegate support varies by installation, especially for HEIC.",
    "Some Linux distributions restrict PDF or PostScript policies by default."
  ],
  capabilities() {
    const supported: Array<{ from: ResourceKind; to: ResourceKind; quality: Quality }> = [
      { from: "jpg", to: "png", quality: "high" },
      { from: "png", to: "jpg", quality: "high" },
      { from: "webp", to: "png", quality: "high" },
      { from: "webp", to: "jpg", quality: "high" },
      { from: "heic", to: "jpg", quality: "best_effort" },
      { from: "heic", to: "png", quality: "best_effort" }
    ];

    return supported.map(({ from, to, quality }) => ({
      kind: "convert" as const,
      from,
      to,
      quality,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const,
      notes:
        from === "heic"
          ? ["HEIC support depends on optional delegates in the local ImageMagick build."]
          : undefined
    }));
  },
  detect() {
    return detectBinary(["magick", "convert"], ["-version"]);
  },
  async verify() {
    const basic = await verifyBinary(["magick", "convert"], ["-version"], "7.0.0");
    if (!basic.ok) {
      return basic;
    }

    const warnings: string[] = basic.warnings;
    if (!(await supportsImageMagickFormat("HEIC"))) {
      warnings.push("HEIC delegate support was not detected. HEIC routes are best effort.");
    }
    if (!(await supportsImageMagickFormat("WEBP"))) {
      warnings.push("WEBP support was not detected. WEBP routes may fail.");
    }

    return {
      ok: true,
      warnings,
      issues: []
    };
  },
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || typeof request.input !== "string" || !request.output) {
      return null;
    }

    const command = await selectedImageCommand();
    return {
      command,
      args: [request.input, request.output],
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    return `ImageMagick is the default image conversion backend for ${request.from} to ${request.to}.`;
  }
});
