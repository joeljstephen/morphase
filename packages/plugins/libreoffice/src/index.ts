import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, libreOfficeConvert, libreOfficeGeneratedPdf, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install --cask libreoffice",
  "winget install TheDocumentFoundation.LibreOffice",
  "sudo apt-get install libreoffice"
);

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
    return verifyBinary(["soffice", "libreoffice"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade --cask libreoffice" },
      windows: { manager: "winget", command: "winget upgrade TheDocumentFoundation.LibreOffice" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade libreoffice" }
    });
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
