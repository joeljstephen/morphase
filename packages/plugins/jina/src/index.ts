import { definePlugin } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest } from "@muxory/shared";

export const jinaPlugin: MuxoryPlugin = definePlugin({
  id: "jina",
  name: "Jina Reader",
  priority: 40,
  optional: true,
  commonProblems: [
    "This backend is network-backed and should not be used for offline-only workflows.",
    "Remote service behavior may change independently of Muxory."
  ],
  capabilities() {
    return [
      {
        kind: "fetch",
        from: "url",
        to: "markdown",
        quality: "medium",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["This backend sends the URL to a remote Jina endpoint."]
      }
    ];
  },
  async detect() {
    return {
      installed: true,
      version: process.version,
      command: process.execPath
    };
  },
  async verify() {
    return {
      ok: true,
      warnings: ["Jina is a remote fallback backend, not a local extraction tool."],
      issues: []
    };
  },
  getInstallHints() {
    return [{ manager: "manual", notes: ["No extra install step is required. This backend uses a remote service."] }];
  },
  getUpdateHints() {
    return [{ manager: "manual", notes: ["No local update step is required for this remote backend."] }];
  },
  async plan(request: PlanRequest) {
    if (
      request.route.kind !== "conversion" ||
      typeof request.input !== "string" ||
      request.route.from !== "url" ||
      request.route.to !== "markdown" ||
      !request.output
    ) {
      return null;
    }

    return {
      command: process.execPath,
      args: [
        "-e",
        "const fs = require('node:fs/promises'); const url = process.argv[1]; const out = process.argv[2]; const target = `https://r.jina.ai/http://${url.replace(/^https?:\\/\\//, '')}`; fetch(target).then((res) => { if (!res.ok) throw new Error(`Jina request failed with ${res.status}`); return res.text(); }).then((text) => fs.writeFile(out, text, 'utf8')).catch((error) => { console.error(error.message); process.exit(1); });",
        request.input,
        request.output
      ],
      expectedOutputs: [request.output]
    };
  },
  async explain() {
    return "Jina is an explicit remote fallback for URL-to-Markdown extraction when a local backend is unavailable or undesired.";
  }
});

