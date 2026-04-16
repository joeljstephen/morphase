import path from "node:path";

import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install poppler"),
  strategyForManager("winget", "winget install poppler"),
  strategyForManager("apt", "sudo apt-get install poppler-utils"),
  strategyForManager("dnf", "sudo dnf install poppler-utils"),
  strategyForManager("yum", "sudo yum install poppler-utils"),
  strategyForManager("pacman", "sudo pacman -S poppler"),
  manualStrategy("Install Poppler manually", {
    notes: ["Install Poppler utilities and ensure pdftocairo and pdfimages are available on PATH."]
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade poppler"),
  strategyForManager("winget", "winget upgrade poppler"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade poppler-utils"),
  strategyForManager("dnf", "sudo dnf upgrade poppler-utils"),
  strategyForManager("yum", "sudo yum update poppler-utils"),
  strategyForManager("pacman", "sudo pacman -Syu poppler"),
  manualStrategy("Update Poppler manually", {
    notes: ["Use your installation method to update Poppler and keep pdftocairo/pdfimages on PATH."]
  })
];

function outputPrefixAndDir(outputPath: string): { prefix: string; dir: string } {
  const ext = path.extname(outputPath);
  if (ext) {
    const prefix = outputPath.slice(0, -ext.length);
    return { prefix, dir: path.dirname(outputPath) };
  }
  return { prefix: outputPath, dir: path.dirname(outputPath) };
}

export const popplerPlugin: MorphasePlugin = definePlugin({
  id: "poppler",
  name: "Poppler",
  priority: 100,
  commonProblems: [
    "pdftocairo renders PDF pages as images. It does not extract embedded images.",
    "For extracting embedded images, use pdfimages (also part of Poppler).",
    "Output file naming follows the pattern: prefix-1.png, prefix-2.png, etc."
  ],
  capabilities() {
    const platforms: Platform[] = ["macos", "windows", "linux"];
    return [
      {
        kind: "convert" as const,
        from: "pdf" as ResourceKind,
        to: "png" as ResourceKind,
        quality: "high" as const,
        offline: true,
        platforms,
        notes: ["Renders each PDF page as a separate PNG image at 150 DPI."]
      },
      {
        kind: "convert" as const,
        from: "pdf" as ResourceKind,
        to: "jpg" as ResourceKind,
        quality: "high" as const,
        offline: true,
        platforms,
        notes: ["Renders each PDF page as a separate JPEG image at 150 DPI."]
      },
      {
        kind: "extract" as const,
        from: "pdf" as ResourceKind,
        to: null,
        operation: "extract-images",
        quality: "medium" as const,
        offline: true,
        platforms,
        notes: ["Extracts embedded images from a PDF using pdfimages. This is different from rendering pages as images."]
      }
    ];
  },
  detect() {
    return detectBinary(["pdftocairo"], ["-v"]);
  },
  async verify() {
    return verifyBinary(["pdftocairo"], ["-v"]);
  },
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
  },
  async plan(request: PlanRequest) {
    if (typeof request.input !== "string" || !request.output) {
      return null;
    }

    if (request.route.kind === "conversion") {
      const { from, to } = request.route;
      if (from !== "pdf") {
        return null;
      }

      const { prefix, dir } = outputPrefixAndDir(request.output);

      if (to === "png") {
        return {
          command: "pdftocairo",
          args: ["-png", "-r", "150", "-singlefile", request.input, prefix],
          expectedOutputs: [request.output],
          collectFromDir: dir
        };
      }

      if (to === "jpg") {
        return {
          command: "pdftocairo",
          args: ["-jpeg", "-r", "150", "-singlefile", request.input, prefix],
          expectedOutputs: [request.output],
          collectFromDir: dir
        };
      }

      return null;
    }

    if (request.route.kind === "operation" && request.route.action === "extract-images") {
      const { prefix, dir } = outputPrefixAndDir(request.output);
      return {
        command: "pdfimages",
        args: ["-png", request.input, prefix],
        collectFromDir: dir
      };
    }

    return null;
  },
  async explain(request: PlanRequest) {
    if (request.route.kind === "conversion") {
      return `Poppler pdftocairo is the preferred backend for rendering PDF pages as ${request.route.to === "png" ? "PNG" : "JPEG"} images. It produces one image file per page.`;
    }
    return "Poppler pdfimages extracts embedded images from a PDF. This is different from rendering pages — it recovers the original images stored inside the document.";
  }
});
