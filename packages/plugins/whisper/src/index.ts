import { definePlugin, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, Platform, ResourceKind } from "@morphase/shared";

import { detectBinary, packageHints, verifyBinary, whisperGeneratedTranscript } from "../../src/helpers.js";

const installHints = packageHints(
  "pip install openai-whisper",
  "py -m pip install openai-whisper",
  "pip install openai-whisper",
  ["Whisper CLI is a Python package and may need FFmpeg installed as well."]
);

export const whisperPlugin: MorphasePlugin = definePlugin({
  id: "whisper",
  name: "Whisper",
  priority: 65,
  optional: true,
  commonProblems: [
    "Whisper often depends on FFmpeg for media decoding.",
    "Transcription performance varies significantly with model size and hardware."
  ],
  capabilities() {
    const supported: ResourceKind[] = ["mp3", "wav", "mp4", "mov", "mkv"];

    return supported.map((from) => ({
      kind: "extract" as const,
      from,
      to: "transcript" as const,
      quality: "medium" as const,
      offline: true,
      platforms: ["macos", "windows", "linux"] as const
    }));
  },
  detect() {
    return detectBinary(["whisper"], ["--help"]);
  },
  async verify() {
    return verifyBinary(["whisper"], ["--help"]);
  },
  getInstallHints(platform: Platform) {
    return installHintByPlatform(platform, installHints);
  },
  getUpdateHints(platform: Platform) {
    return installHintByPlatform(platform, {
      macos: { manager: "manual", command: "pip install --upgrade openai-whisper" },
      windows: { manager: "manual", command: "py -m pip install --upgrade openai-whisper" },
      linux: { manager: "manual", command: "pip install --upgrade openai-whisper" }
    });
  },
  async plan(request: PlanRequest) {
    if (
      request.route.kind !== "conversion" ||
      typeof request.input !== "string" ||
      request.route.to !== "transcript" ||
      !request.output
    ) {
      return null;
    }

    return whisperGeneratedTranscript(request.input, request.output);
  },
  async explain() {
    return "Whisper is the optional local transcription backend.";
  }
});
