import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const sharedNotes = ["Trafilatura is commonly installed via pip or pipx."];

const installStrategies = buildInstallStrategies(
  { pipx: "trafilatura", pip: "trafilatura", brew: "trafilatura" },
  { label: "Install Python 3 and Trafilatura manually", notes: ["Ensure the trafilatura executable is on PATH after installation."] },
  sharedNotes
);

const updateStrategies = buildUpdateStrategies(
  { pipx: "trafilatura", pip: "trafilatura", brew: "trafilatura" },
  { label: "Update Trafilatura manually", notes: ["Use your Python package manager to update Trafilatura and keep it on PATH."] }
);

export const trafilaturaPlugin: MorphasePlugin = definePlugin({
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
    return verifyBinary(["trafilatura"], ["--version"], "1.9.0");
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
