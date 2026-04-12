import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, Quality, ResourceKind } from "@morphase/shared";

import { detectBinary, packageHints, supportsImageMagickFormat, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install imagemagick",
  "winget install ImageMagick.ImageMagick",
  "sudo apt-get install imagemagick"
);

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
    const basic = await verifyBinary(["magick", "convert"], ["-version"]);
    if (!basic.ok) {
      return basic;
    }

    const warnings: string[] = [];
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
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade imagemagick" },
      windows: { manager: "winget", command: "winget upgrade ImageMagick.ImageMagick" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade imagemagick" }
    });
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
