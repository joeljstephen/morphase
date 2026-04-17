import path from "node:path";

import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  { brew: "poppler", winget: "oschwartz10612.Poppler", choco: "poppler", scoop: "poppler", apt: "poppler-utils", dnf: "poppler-utils", yum: "poppler-utils", pacman: "poppler", zypper: "poppler-tools", nix: "poppler_utils" },
  { label: "Install Poppler manually", notes: ["Install Poppler utilities and ensure pdftocairo and pdfimages are available on PATH."] }
);

const updateStrategies = buildUpdateStrategies(
  { brew: "poppler", winget: "oschwartz10612.Poppler", choco: "poppler", scoop: "poppler", apt: "poppler-utils", dnf: "poppler-utils", yum: "poppler-utils", pacman: "poppler", zypper: "poppler-tools" },
  { label: "Update Poppler manually", notes: ["Use your installation method to update Poppler and keep pdftocairo/pdfimages on PATH."] }
);

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
    "pdftocairo renders only the first PDF page for the direct pdf->png/jpg routes.",
    "For extracting embedded images, use pdfimages (also part of Poppler).",
    "Extracted image file names are derived from the requested output prefix."
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
        notes: ["Renders the first PDF page as a PNG image at 150 DPI."]
      },
      {
        kind: "convert" as const,
        from: "pdf" as ResourceKind,
        to: "jpg" as ResourceKind,
        quality: "high" as const,
        offline: true,
        platforms,
        notes: ["Renders the first PDF page as a JPEG image at 150 DPI."]
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
    return detectBinary(["pdftocairo", "pdfimages"], ["-v"]);
  },
  async verify() {
    const pdftocairo = await detectBinary(["pdftocairo"], ["-v"]);
    const pdfimages = await detectBinary(["pdfimages"], ["-v"]);

    if (!pdftocairo.installed && !pdfimages.installed) {
      return {
        ok: false,
        warnings: [],
        issues: ["Neither pdftocairo nor pdfimages was found on PATH."]
      };
    }

    const warnings: string[] = [];
    if (!pdftocairo.installed) {
      warnings.push("pdftocairo was not found. PDF-to-image rendering routes will not work.");
    }
    if (!pdfimages.installed) {
      warnings.push("pdfimages was not found. PDF image extraction routes will not work.");
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
        if (!(await detectBinary(["pdftocairo"], ["-v"])).installed) {
          return null;
        }
        return {
          command: "pdftocairo",
          args: ["-png", "-r", "150", "-singlefile", request.input, prefix],
          expectedOutputs: [request.output],
          collectFromDir: dir
        };
      }

      if (to === "jpg") {
        if (!(await detectBinary(["pdftocairo"], ["-v"])).installed) {
          return null;
        }
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
      if (!(await detectBinary(["pdfimages"], ["-v"])).installed) {
        return null;
      }
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
      return `Poppler pdftocairo renders the first PDF page as a ${request.route.to === "png" ? "PNG" : "JPEG"} image.`;
    }
    return "Poppler pdfimages extracts embedded images from a PDF. This is different from rendering pages — it recovers the original images stored inside the document.";
  }
});
