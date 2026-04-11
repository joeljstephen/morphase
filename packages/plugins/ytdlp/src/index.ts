import path from "node:path";

import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import { runCommandCapture } from "@muxory/shared";
import type { MuxoryPlugin, PlanRequest, Platform } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install yt-dlp",
  "winget install yt-dlp.yt-dlp",
  "sudo apt-get install yt-dlp"
);

async function isFfmpegAvailable(): Promise<boolean> {
  const result = await runCommandCapture("ffmpeg", ["-version"]);
  return result.ok;
}

export const ytdlpPlugin: MuxoryPlugin = definePlugin({
  id: "ytdlp",
  name: "yt-dlp",
  priority: 60,
  optional: true,
  commonProblems: [
    "Users are responsible for rights and terms compliance.",
    "Platform or site changes can break download behavior.",
    "MP3 extraction requires ffmpeg to be installed separately."
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
        notes: [
          "Use responsibly and ensure you have rights to fetch the media.",
          "Requires ffmpeg for audio extraction."
        ]
      },
      {
        kind: "fetch",
        from: "youtube-url",
        to: "transcript",
        quality: "medium",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: [
          "Downloads auto-generated subtitles as a transcript approximation.",
          "For higher quality transcripts, install the summarize plugin."
        ]
      },
      {
        kind: "fetch",
        from: "youtube-url",
        to: "subtitle",
        quality: "medium",
        offline: false,
        platforms: ["macos", "windows", "linux"],
        notes: ["Downloads available subtitles."]
      }
    ];
  },
  detect() {
    return detectBinary(["yt-dlp"], ["--version"]);
  },
  async verify() {
    const ytResult = await verifyBinary(["yt-dlp"], ["--version"]);
    if (!ytResult.ok) {
      return ytResult;
    }
    const ffmpegOk = await isFfmpegAvailable();
    if (!ffmpegOk) {
      return {
        ok: true,
        warnings: ["FFmpeg is not installed. MP3 extraction will not work. Install ffmpeg for MP3 support."],
        issues: []
      };
    }
    return ytResult;
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

    const { to } = request.route;
    const directory = path.dirname(request.output);
    const basename = path.parse(request.output).name;
    const template = path.join(directory, `${basename}.%(ext)s`);

    if (to === "mp4") {
      return {
        command: "yt-dlp",
        args: ["--remux-video", "mp4", "-o", template, request.input],
        expectedOutputs: [request.output]
      };
    }

    if (to === "mp3") {
      const ffmpegOk = await isFfmpegAvailable();
      if (!ffmpegOk) {
        return null;
      }
      return {
        command: "yt-dlp",
        args: ["-x", "--audio-format", "mp3", "-o", template, request.input],
        expectedOutputs: [request.output]
      };
    }

    if (to === "transcript") {
      const generatedVtt = path.join(directory, `${basename}.en.vtt`);
      return {
        command: "yt-dlp",
        args: [
          "--write-auto-subs",
          "--sub-lang", "en",
          "--sub-format", "vtt",
          "--skip-download",
          "-o", template,
          request.input
        ],
        expectedOutputs: [request.output],
        outputMapping: [
          { source: generatedVtt, target: request.output }
        ],
        notes: ["Downloads auto-generated subtitles. For higher quality, install the summarize plugin."]
      };
    }

    if (to === "subtitle") {
      const generatedSub = path.join(directory, `${basename}.en.vtt`);
      return {
        command: "yt-dlp",
        args: [
          "--write-subs",
          "--write-auto-subs",
          "--sub-lang", "en",
          "--sub-format", "vtt",
          "--skip-download",
          "-o", template,
          request.input
        ],
        expectedOutputs: [request.output],
        outputMapping: [
          { source: generatedSub, target: request.output }
        ]
      };
    }

    return null;
  },
  async explain(request: PlanRequest) {
    if (request.route.kind === "conversion" && request.route.to === "transcript") {
      return "yt-dlp can extract YouTube auto-generated subtitles as a transcript approximation. For higher quality transcripts, install the summarize plugin (npm i -g @steipete/summarize).";
    }
    if (request.route.kind === "conversion" && request.route.to === "mp3") {
      return "yt-dlp is the media download backend for YouTube MP3 extraction. This route requires ffmpeg for audio conversion.";
    }
    return "yt-dlp is the optional media acquisition backend for YouTube URLs.";
  }
});
