import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install trafilatura",
  "winget install Python.Python.3 && pip install trafilatura",
  "sudo apt-get install python3-pip && pip install trafilatura",
  ["Trafilatura is commonly installed via pip when OS packages are unavailable."]
);

export const trafilaturaPlugin: MuxoryPlugin = definePlugin({
  id: "trafilatura",
  name: "Trafilatura",
  priority: 90,
  minimumVersion: "1.9.0",
  optional: false,
  commonProblems: [
    "Some sites block scraping or require browser automation beyond Trafilatura.",
    "Website extraction quality varies outside article-like pages."
  ],
  capabilities() {
    return [
      {
        kind: "fetch",
        from: "url",
        to: "markdown",
        quality: "high",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["This backend fetches the target URL over the network."]
      },
      {
        kind: "fetch",
        from: "url",
        to: "txt",
        quality: "high",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["This backend fetches the target URL over the network."]
      }
    ];
  },
  detect() {
    return detectBinary(["trafilatura"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["trafilatura"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade trafilatura" },
      windows: { manager: "manual", command: "pip install --upgrade trafilatura" },
      linux: { manager: "manual", command: "pip install --upgrade trafilatura" }
    });
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || typeof request.input !== "string" || !request.output) {
      return null;
    }

    if (request.route.from !== "url" || (request.route.to !== "markdown" && request.route.to !== "txt")) {
      return null;
    }

    return {
      command: "trafilatura",
      args: ["--URL", request.input, "--output-format", request.route.to === "markdown" ? "markdown" : "txt"],
      stdoutFile: request.output,
      expectedOutputs: [request.output]
    };
  },
  async explain(request: PlanRequest) {
    return `Trafilatura is the preferred local-first extractor for ${request.from} to ${request.to}.`;
  }
});

