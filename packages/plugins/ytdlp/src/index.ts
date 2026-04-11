import path from "node:path";

import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install yt-dlp",
  "winget install yt-dlp.yt-dlp",
  "sudo apt-get install yt-dlp"
);

export const ytdlpPlugin: MuxoryPlugin = definePlugin({
  id: "ytdlp",
  name: "yt-dlp",
  priority: 60,
  optional: true,
  commonProblems: [
    "Users are responsible for rights and terms compliance.",
    "Platform or site changes can break download behavior."
  ],
  capabilities() {
    return [
      {
        kind: "fetch",
        from: "youtube-url",
        to: "mp4",
        quality: "medium",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["Use responsibly and ensure you have rights to fetch the media."]
      },
      {
        kind: "fetch",
        from: "youtube-url",
        to: "mp3",
        quality: "medium",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["Use responsibly and ensure you have rights to fetch the media."]
      }
    ];
  },
  detect() {
    return detectBinary(["yt-dlp"], ["--version"]);
  },
  async verify() {
    return verifyBinary(["yt-dlp"], ["--version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade yt-dlp" },
      windows: { manager: "winget", command: "winget upgrade yt-dlp.yt-dlp" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade yt-dlp" }
    });
  },
  async plan(request: PlanRequest) {
    if (request.route.kind !== "conversion" || typeof request.input !== "string" || !request.output) {
      return null;
    }

    const directory = path.dirname(request.output);
    const basename = path.parse(request.output).name;
    const template = path.join(directory, `${basename}.%(ext)s`);

    if (request.route.to === "mp4") {
      return {
        command: "yt-dlp",
        args: ["--remux-video", "mp4", "-o", template, request.input],
        expectedOutputs: [request.output]
      };
    }

    if (request.route.to === "mp3") {
      return {
        command: "yt-dlp",
        args: ["-x", "--audio-format", "mp3", "-o", template, request.input],
        expectedOutputs: [request.output]
      };
    }

    return null;
  },
  async explain() {
    return "yt-dlp is the optional media acquisition backend for YouTube URLs.";
  }
});

