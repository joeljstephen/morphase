import { definePlugin, installHintByPlatform } from "@muxory/plugin-sdk";
import type { MuxoryPlugin, PlanRequest, Platform, ResourceKind } from "@muxory/shared";

import { detectBinary, packageHints, verifyBinary } from "../../src/helpers.js";

const installHints = packageHints(
  "brew install ffmpeg",
  "winget install Gyan.FFmpeg",
  "sudo apt-get install ffmpeg"
);

const videoKinds: ResourceKind[] = ["mp4", "mov", "mkv"];

export const ffmpegPlugin: MuxoryPlugin = definePlugin({
  id: "ffmpeg",
  name: "FFmpeg",
  priority: 100,
  minimumVersion: "6.0.0",
  commonProblems: [
    "Some codecs may be unavailable in minimal FFmpeg builds.",
    "Lossy transcoding routes reduce fidelity."
  ],
  capabilities() {
    const caps: ReturnType<MuxoryPlugin["capabilities"]> = [
      {
        kind: "convert",
        from: "mp4",
        to: "mp3",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["This route strips video and creates a lossy MP3."]
      },
      {
        kind: "convert",
        from: "mov",
        to: "mp4",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["This route typically re-encodes video to H.264/AAC."]
      },
      {
        kind: "convert",
        from: "mkv",
        to: "mp4",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["This route typically re-encodes video to H.264/AAC."]
      },
      {
        kind: "convert",
        from: "wav",
        to: "mp3",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["This route is lossy."]
      },
      {
        kind: "convert",
        from: "mp3",
        to: "wav",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      }
    ];

    for (const resource of videoKinds) {
      caps.push({
        kind: "transform",
        from: resource,
        to: null,
        operation: "compress",
        quality: "medium",
        offline: true,
        platforms: ["macos", "windows", "linux"],
        notes: ["Re-encodes to H.265/HEVC with AAC audio for significantly smaller file size."]
      });
    }

    return caps;
  },
  detect() {
    return detectBinary(["ffmpeg"], ["-version"]);
  },
  async verify() {
    return verifyBinary(["ffmpeg"], ["-version"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "brew", command: "brew upgrade ffmpeg" },
      windows: { manager: "winget", command: "winget upgrade --id Gyan.FFmpeg" },
      linux: { manager: "apt-get", command: "sudo apt-get install --only-upgrade ffmpeg" }
    });
  },
  async plan(request: PlanRequest) {
    if (typeof request.input !== "string" || !request.output) {
      return null;
    }

    if (request.route.kind === "operation" && request.route.action === "compress") {
      if (videoKinds.includes(request.route.resource as ResourceKind)) {
        return {
          command: "ffmpeg",
          args: [
            "-y", "-i", request.input,
            "-c:v", "libx265", "-crf", "28", "-preset", "medium",
            "-c:a", "aac", "-b:a", "128k",
            "-movflags", "+faststart",
            request.output
          ],
          expectedOutputs: [request.output]
        };
      }
      return null;
    }

    if (request.route.kind !== "conversion") {
      return null;
    }

    const baseArgs = ["-y", "-i", request.input];

    if (request.from === "mp4" && request.to === "mp3") {
      return {
        command: "ffmpeg",
        args: [...baseArgs, "-vn", "-codec:a", "libmp3lame", request.output],
        expectedOutputs: [request.output]
      };
    }

    if ((request.from === "mov" || request.from === "mkv") && request.to === "mp4") {
      return {
        command: "ffmpeg",
        args: [...baseArgs, "-c:v", "libx264", "-c:a", "aac", request.output],
        expectedOutputs: [request.output]
      };
    }

    if (request.from === "wav" && request.to === "mp3") {
      return {
        command: "ffmpeg",
        args: [...baseArgs, "-codec:a", "libmp3lame", request.output],
        expectedOutputs: [request.output]
      };
    }

    if (request.from === "mp3" && request.to === "wav") {
      return {
        command: "ffmpeg",
        args: [...baseArgs, request.output],
        expectedOutputs: [request.output]
      };
    }

    return null;
  },
  async explain(request: PlanRequest) {
    if (request.route.kind === "operation" && request.route.action === "compress") {
      return "FFmpeg re-encodes the video to H.265/HEVC with AAC audio, which typically produces a much smaller file with good quality.";
    }
    return `FFmpeg is the default media backend for ${request.from} to ${request.to}.`;
  }
});
