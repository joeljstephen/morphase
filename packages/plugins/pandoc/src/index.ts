import { definePlugin } from "@morphase/plugin-sdk";
import { runCommandCapture } from "@morphase/shared";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("winget", "winget install JohnMacFarlane.Pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("apt", "sudo apt-get install pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("dnf", "sudo dnf install pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("yum", "sudo yum install pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("pacman", "sudo pacman -S pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  strategyForManager("zypper", "sudo zypper install pandoc", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."]
  }),
  manualStrategy("Install Pandoc manually", {
    notes: ["PDF output may also require a PDF engine available to Pandoc."],
    url: "https://pandoc.org/installing.html"
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade pandoc"),
  strategyForManager("winget", "winget upgrade JohnMacFarlane.Pandoc"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade pandoc"),
  strategyForManager("dnf", "sudo dnf upgrade pandoc"),
  strategyForManager("yum", "sudo yum update pandoc"),
  strategyForManager("pacman", "sudo pacman -S pandoc"),
  strategyForManager("zypper", "sudo zypper update pandoc"),
  manualStrategy("Update Pandoc manually", {
    url: "https://pandoc.org/installing.html"
  })
];

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
