import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, libreOfficeConvert, libreOfficeGeneratedPdf, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("brew", "brew install --cask libreoffice"),
  strategyForManager("winget", "winget install TheDocumentFoundation.LibreOffice"),
  strategyForManager("apt", "sudo apt-get install libreoffice"),
  strategyForManager("dnf", "sudo dnf install libreoffice"),
  strategyForManager("yum", "sudo yum install libreoffice"),
  strategyForManager("pacman", "sudo pacman -S libreoffice-fresh"),
  strategyForManager("zypper", "sudo zypper install libreoffice"),
  manualStrategy("Install LibreOffice manually", {
    url: "https://www.libreoffice.org/download/download-libreoffice/"
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade --cask libreoffice"),
  strategyForManager("winget", "winget upgrade TheDocumentFoundation.LibreOffice"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade libreoffice"),
  strategyForManager("dnf", "sudo dnf upgrade libreoffice"),
  strategyForManager("yum", "sudo yum update libreoffice"),
  strategyForManager("pacman", "sudo pacman -Syu libreoffice-fresh"),
  strategyForManager("zypper", "sudo zypper update libreoffice"),
  manualStrategy("Update LibreOffice manually", {
    url: "https://www.libreoffice.org/download/download-libreoffice/"
  })
];

export const libreOfficePlugin: MorphasePlugin = definePlugin({
  id: "libreoffice",
  name: "LibreOffice",
  priority: 100,
  minimumVersion: "7.0.0",
  commonProblems: [
    "Headless export may fail if LibreOffice is partially installed.",
    "Office rendering fidelity is still best effort for some documents."
  ],
  capabilities() {
    const toPdf: ResourceKind[] = [
      "docx",
      "pptx",
      "xlsx",
      "odt",
      "ods",
      "odp"
    ];

    const caps: Array<{
      kind: "convert";
      from: ResourceKind;
      to: ResourceKind;
      quality: "high" | "medium";
      offline: boolean;
      platforms: Platform[];
      notes?: string[];
    }> = toPdf.map((from) => ({
      kind: "convert" as const,
      from,
      to: "pdf" as ResourceKind,
      quality: "high" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as Platform[]
    }));

    caps.push({
      kind: "convert" as const,
      from: "pdf" as const,
      to: "docx" as const,
      quality: "medium" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const,
      notes: ["PDF to DOCX conversion extracts text and layout. Complex formatting may differ from the original."]
    });

    return caps;
  },
  detect() {
    return detectBinary(["soffice", "libreoffice"]);
  },
  async verify() {
    return verifyBinary(["soffice", "libreoffice"], ["--version"], "7.0.0");
  },
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
  },
  async plan(request: PlanRequest) {
    if (
      request.route.kind !== "conversion" ||
      typeof request.input !== "string" ||
      !request.output
    ) {
      return null;
    }

    if (request.route.to === "pdf") {
      return libreOfficeGeneratedPdf(request.input, request.output);
    }

    if (request.route.from === "pdf" && request.route.to === "docx") {
      return libreOfficeConvert(request.input, request.output, "docx");
    }

    return null;
  },
  async explain(request: PlanRequest) {
    if (request.route.kind === "conversion" && request.route.from === "pdf" && request.route.to === "docx") {
      return "LibreOffice can extract text and layout from PDF and produce a DOCX file. Complex formatting may not be perfectly preserved.";
    }
    return `LibreOffice is the preferred office-document renderer for ${request.from} to ${request.to}.`;
  }
});
