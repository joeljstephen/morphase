import path from "node:path";

import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const imageKinds: ResourceKind[] = ["jpg", "png"];

const installHints = packageHints(
  "pip install img2pdf",
  "py -m pip install img2pdf",
  "pip install img2pdf"
);

function isImageKind(kind: ResourceKind | undefined): boolean {
  return kind !== undefined && imageKinds.includes(kind);
}

export const img2pdfPlugin: MorphasePlugin = definePlugin({
  id: "img2pdf",
  name: "img2pdf",
  priority: 100,
  commonProblems: [
    "img2pdf is a Python tool specialized for lossless image-to-PDF conversion.",
    "It does not support WebP. Convert WebP images to PNG or JPEG first.",
    "It preserves the original image quality without re-encoding."
  ],
  capabilities() {
    const platforms: Platform[] = ["macos", "windows", "linux"];
    return imageKinds.map((from) => ({
      kind: "convert" as const,
      from,
      to: "pdf" as const,
      quality: "high" as const,
      offline: true,
      platforms,
      notes: ["Lossless image-to-PDF conversion. Supports mixed JPG and PNG inputs in a single command."]
    }));
  },
  detect() {
    return detectBinary(["img2pdf"]);
  },
  async verify() {
    return verifyBinary(["img2pdf"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "manual", command: "pip install --upgrade img2pdf" },
      windows: { manager: "manual", command: "py -m pip install --upgrade img2pdf" },
      linux: { manager: "manual", command: "pip install --upgrade img2pdf" }
    });
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || !request.output) {
      return null;
    }

    if (request.route.to !== "pdf") {
      return null;
    }

    const inputs = Array.isArray(request.input) ? request.input : [request.input];

    if (inputs.length === 0) {
      return null;
    }

    for (const item of inputs) {
      const ext = path.extname(item).toLowerCase();
      if (ext !== ".jpg" && ext !== ".jpeg" && ext !== ".png") {
        return null;
      }
    }

    return {
      command: "img2pdf",
      args: [...inputs, "-o", request.output],
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    const count = Array.isArray(request.input) ? request.input.length : 1;
    if (count > 1) {
      return `img2pdf is the preferred backend for combining ${count} images into a single PDF. It performs lossless conversion, preserving the original image quality.`;
    }
    return `img2pdf is the preferred backend for converting ${request.from} to PDF. It performs lossless conversion without re-encoding the image.`;
  }
});
