import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import { runCommandCapture } from "@morphase/shared";
import type { MorphasePlugin, PlanRequest, Platform } from "@morphase/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install pandoc",
  "winget install JohnMacFarlane.Pandoc",
  "sudo apt-get install pandoc",
  ["PDF output may also require a PDF engine available to Pandoc."]
);

export const pandocPlugin: MorphasePlugin = definePlugin({
  id: "pandoc",
  name: "Pandoc",
  priority: 95,
  minimumVersion: "3.0.0",
  commonProblems: [
    "PDF generation can fail when a PDF engine such as LaTeX is missing.",
    "Complex office-layout fidelity is outside Pandoc's strengths."
  ],
  capabilities() {
    return [
      {
        kind: "convert",
        from: "markdown",
        to: "pdf",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["Pandoc may require an external PDF engine for PDF output."]
      },
      {
        kind: "convert",
        from: "markdown",
        to: "docx",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      },
      {
        kind: "convert",
        from: "markdown",
        to: "txt",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      },
      {
        kind: "convert",
        from: "html",
        to: "pdf",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      },
      {
        kind: "convert",
        from: "html",
        to: "markdown",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      },
      {
        kind: "convert",
        from: "html",
        to: "docx",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      }
    ];
  },
  detect() {
    return detectBinary(["pandoc"]);
  },
  async verify() {
    return verifyBinary(["pandoc"], ["--version"], "3.0.0");
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade pandoc" },
      windows: { manager: "winget", command: "winget upgrade JohnMacFarlane.Pandoc" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade pandoc" }
    });
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || typeof request.input !== "string" || !request.output) {
      return null;
    }

    const args = [request.input];

    if (request.from === "markdown") {
      args.push("-f", "gfm");
    }

    if (request.to === "markdown") {
      args.push("-t", "gfm");
    }

    if (request.to === "txt") {
      args.push("-t", "plain");
    }

    if (request.to === "pdf") {
      const pdfEngine = (await detectPdfEngines())[0];
      if (!pdfEngine) {
        return null;
      }

      args.push("--pdf-engine", pdfEngine);
    }

    args.push("-o", request.output);

    return {
      command: "pandoc",
      args,
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    return `Pandoc is a strong fit for ${request.route.kind === "conversion" ? `${request.from} to ${request.to}` : request.operation} because it handles structured document conversion well.`;
  }
});

async function detectPdfEngines(): Promise<string[]> {
  const engines = ["typst", "wkhtmltopdf", "weasyprint", "pdflatex", "xelatex", "lualatex"];
  const available: string[] = [];

  for (const engine of engines) {
    const result = await runCommandCapture(engine, ["--version"]);
    if (result.ok) {
      available.push(engine);
    }
  }

  return available;
}
