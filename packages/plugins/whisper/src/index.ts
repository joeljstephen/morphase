import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, PlanRequest, ResourceKind } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary, whisperGeneratedTranscript } from "../../src/helpers.js";

const sharedNotes = ["Whisper CLI is a Python package and may need FFmpeg installed as well."];

const installStrategies = buildInstallStrategies(
  { pipx: "openai-whisper", pip: "openai-whisper" },
  { label: "Install Python 3 and Whisper manually", notes: ["Install openai-whisper and ensure both whisper and ffmpeg are on PATH."] },
  sharedNotes
);

const updateStrategies = buildUpdateStrategies(
  { pipx: "openai-whisper", pip: "openai-whisper" },
  { label: "Update Whisper manually", notes: ["Use your Python package manager to update openai-whisper and keep ffmpeg installed."] }
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
  getInstallStrategies() {
    return installStrategies;
  },
  getUpdateStrategies() {
    return updateStrategies;
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
