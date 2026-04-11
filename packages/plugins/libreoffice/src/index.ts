import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform, ResourceKind } from "@muxory/shared";

import { detectBinary, libreOfficeGeneratedPdf, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install --cask libreoffice",
  "winget install TheDocumentFoundation.LibreOffice",
  "sudo apt-get install libreoffice"
);

export const libreOfficePlugin: MuxoryPlugin = definePlugin({
  id: "libreoffice",
  name: "LibreOffice",
  priority: 100,
  minimumVersion: "7.0.0",
  commonProblems: [
    "Headless export may fail if LibreOffice is partially installed.",
    "Office rendering fidelity is still best effort for some documents."
  ],
  capabilities() {
    const supported: ResourceKind[] = [
      "docx",
      "pptx",
      "xlsx",
      "odt",
      "ods",
      "odp"
    ];

    return supported.map((from) => ({
      kind: "convert" as const,
      from,
      to: "pdf" as const,
      quality: "high" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const
    }));
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
      request.route.to !== "pdf" ||
      !request.output
    ) {
      return null;
    }

    return libreOfficeGeneratedPdf(request.input, request.output);
  },
  async explain(request: PlanRequest) {
    return `LibreOffice is the preferred office-document renderer for ${request.from} to ${request.to}.`;
  }
});
