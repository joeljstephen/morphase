import path from "node:path";

import { detectFirstAvailableCommand } from "@muxory/plugin-sdk";
import { parseFirstSemver, runCommandCapture, type DetectionResult, type ExecutionPlan, type InstallHint, type Platform } from "@muxory/shared";

export async function detectBinary(
  commands: string[],
  versionArgs: string[] = ["--version"]
): Promise<DetectionResult> {
  const detection = await detectFirstAvailableCommand(commands, versionArgs);
  return {
    ...detection,
    version: detection.version ? parseFirstSemver(detection.version) ?? detection.version : undefined
  };
}

export function packageHints(
  macos: string,
  windows: string,
  linux: string,
  notes: string[] = []
): Record<Platform, InstallHint> {
  return {
    macos: { manager: "brew", command: macos, notes },
    windows: { manager: "winget", command: windows, notes },
    linux: { manager: "apt-get", command: linux, notes }
  };
}

export async function verifyBinary(
  commands: string[],
  args: string[] = ["--version"]
): Promise<{ ok: boolean; warnings: string[]; issues: string[] }> {
  const detection = await detectBinary(commands, args);
  if (!detection.installed) {
    return {
      ok: false,
      warnings: [],
      issues: [detection.reason ?? "Backend not installed."]
    };
  }

  return {
    ok: true,
    warnings: [],
    issues: []
  };
}

export function libreOfficeGeneratedPdf(inputPath: string, outputPath: string): ExecutionPlan {
  const outputDir = path.dirname(outputPath);
  const sourceName = `${path.parse(inputPath).name}.pdf`;
  const generatedPdf = path.join(outputDir, sourceName);

  return {
    command: "soffice",
    args: ["--headless", "--convert-to", "pdf", "--outdir", outputDir, inputPath],
    expectedOutputs: [outputPath],
    outputMapping:
      path.resolve(generatedPdf) === path.resolve(outputPath)
        ? undefined
        : [{ source: generatedPdf, target: outputPath }]
  };
}

export function whisperGeneratedTranscript(inputPath: string, outputPath: string): ExecutionPlan {
  const outputDir = path.dirname(outputPath);
  const generated = path.join(outputDir, `${path.parse(inputPath).name}.txt`);

  return {
    command: "whisper",
    args: [inputPath, "--output_format", "txt", "--output_dir", outputDir],
    expectedOutputs: [outputPath],
    outputMapping:
      path.resolve(generated) === path.resolve(outputPath)
        ? undefined
        : [{ source: generated, target: outputPath }]
  };
}

export async function supportsImageMagickFormat(format: string): Promise<boolean> {
  const commands = [
    { command: "magick", args: ["identify", "-list", "format"] },
    { command: "convert", args: ["-list", "format"] }
  ];

  for (const candidate of commands) {
    const result = await runCommandCapture(candidate.command, candidate.args);
    if (result.ok && result.stdout.toLowerCase().includes(format.toLowerCase())) {
      return true;
    }
  }

  return false;
}

