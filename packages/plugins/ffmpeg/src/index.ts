import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, manualStrategy, strategyForManager, verifyBinary } from "../../src/helpers.js";

const MINIMUM_VERSION = "6.0.0";

const installStrategies = [
  strategyForManager("brew", "brew install ffmpeg"),
  strategyForManager("winget", "winget install Gyan.FFmpeg"),
  strategyForManager("apt", "sudo apt-get install ffmpeg"),
  strategyForManager("dnf", "sudo dnf install ffmpeg"),
  strategyForManager("yum", "sudo yum install ffmpeg"),
  strategyForManager("pacman", "sudo pacman -S ffmpeg"),
  strategyForManager("zypper", "sudo zypper install ffmpeg"),
  manualStrategy("Install FFmpeg manually", {
    notes: ["Ensure the ffmpeg executable is available on PATH after installation."],
    url: "https://www.ffmpeg.org/download.html"
  })
];

const updateStrategies = [
  strategyForManager("brew", "brew upgrade ffmpeg"),
  strategyForManager("winget", "winget upgrade --id Gyan.FFmpeg"),
  strategyForManager("apt", "sudo apt-get install --only-upgrade ffmpeg"),
  strategyForManager("dnf", "sudo dnf upgrade ffmpeg"),
  strategyForManager("yum", "sudo yum update ffmpeg"),
  strategyForManager("pacman", "sudo pacman -Syu ffmpeg"),
  strategyForManager("zypper", "sudo zypper update ffmpeg"),
  manualStrategy("Update FFmpeg manually", {
    url: "https://www.ffmpeg.org/download.html"
  })
];

const videoKinds: ResourceKind[] = ["mp4", "mov", "mkv"];

export const ffmpegPlugin: MorphasePlugin = definePlugin({
  id: "ffmpeg",
  name: "FFmpeg",
  priority: 100,
  minimumVersion: MINIMUM_VERSION,
  commonProblems: [
    "Some codecs may be unavailable in minimal FFmpeg builds.",
    "Lossy transcoding routes reduce fidelity."
  ],
  capabilities() {
    const caps: ReturnType<MorphasePlugin["capabilities"]> = [
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
    return verifyBinary(["ffmpeg"], ["-version"], MINIMUM_VERSION);
  },
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
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
