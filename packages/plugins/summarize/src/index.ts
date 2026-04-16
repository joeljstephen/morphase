import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const installStrategies = [
  strategyForManager("npm", "npm i -g @steipete/summarize", {
    notes: ["Requires Node 22+."]
  }),
  strategyForManager("brew", "brew install summarize", {
    notes: ["Requires Node 22+."]
  }),
  manualStrategy("Install Node.js 22+ and summarize manually", {
    notes: ["Install Node.js with npm, then install summarize and ensure the global npm bin directory is on PATH."]
  })
];

const updateStrategies = [
  strategyForManager("npm", "npm update -g @steipete/summarize"),
  strategyForManager("brew", "brew upgrade summarize"),
  manualStrategy("Update summarize manually", {
    notes: ["Use your npm or Homebrew installation path to update summarize."]
  })
];

export const summarizePlugin: MorphasePlugin = definePlugin({
  id: "summarize",
  name: "summarize",
  priority: 70,
  optional: true,
  commonProblems: [
    "summarize requires Node 22 or later.",
    "npm global bin may not be on PATH after install."
  ],
  capabilities() {
    return [
      {
        kind: "extract",
        from: "youtube-url",
        to: "transcript",
        quality: "high",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["Preferred backend for YouTube transcript extraction."]
      },
      {
        kind: "extract",
        from: "url",
        to: "markdown",
        quality: "high",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["Can extract article/content from URLs."]
      }
    ];
  },
  detect() {
    return detectBinary(["summarize"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["summarize"], ["--version"]);
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

    const { from, to } = request.route;

    if (from === "youtube-url" && to === "transcript") {
      const format = request.options.format === "markdown" ? "md" : null;
      const args = ["--extract", "--plain"];
      if (format) {
        args.push("--format", format);
      }
      args.push(request.input);
      return {
        command: "summarize",
        args,
        expectedOutputs: [request.output],
        stdoutFile: request.output,
        notes: [
          format
            ? "Uses summarize --extract --format md for markdown transcript."
            : "Uses summarize --extract to get plain text transcript."
        ]
      };
    }

    if (from === "url" && to === "markdown") {
      return {
        command: "summarize",
        args: ["--extract", "--format", "md", "--plain", request.input],
        expectedOutputs: [request.output],
        stdoutFile: request.output,
        notes: ["Uses summarize --extract --format md to get markdown content."]
      };
    }

    return null;
  },
  async explain(request: PlanRequest) {
    if (request.route.kind === "conversion" && request.route.from === "youtube-url" && request.route.to === "transcript") {
      return "summarize is the preferred backend for YouTube transcript extraction. It provides high-quality transcript output with timestamps and metadata.";
    }
    return "summarize is an optional extraction backend for URLs and media content.";
  }
});
