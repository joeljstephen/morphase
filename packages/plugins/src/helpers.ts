import path from "node:path";

import { detectFirstAvailableCommand } from "@morphase/plugin-sdk";
import { compareSemver, parseFirstSemver, runCommandCapture, type DetectionResult, type ExecutionPlan, type InstallHint, type Platform } from "@morphase/shared";

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
  args: string[] = ["--version"],
  minimumVersion?: string
): Promise<{ ok: boolean; warnings: string[]; issues: string[] }> {
  const detection = await detectBinary(commands, args);
  if (!detection.installed) {
    return {
      ok: false,
      warnings: [],
      issues: [detection.reason ?? "Backend not installed."]
    };
  }

  const warnings: string[] = [];
  const issues: string[] = [];

  if (minimumVersion && detection.version) {
    if (compareSemver(detection.version, minimumVersion) < 0) {
      issues.push(
        `Installed version ${detection.version} is below minimum required ${minimumVersion}.`
      );
      return { ok: false, warnings, issues };
    }
  }

  return {
    ok: true,
    warnings,
    issues
  };
}

export function libreOfficeGeneratedPdf(inputPath: string, outputPath: string): ExecutionPlan {
  return libreOfficeConvert(inputPath, outputPath, "pdf");
}

export function libreOfficeConvert(inputPath: string, outputPath: string, format: string): ExecutionPlan {
  const outputDir = path.dirname(outputPath);
  const sourceName = `${path.parse(inputPath).name}.${format}`;
  const generated = path.join(outputDir, sourceName);

  return {
    command: "soffice",
    args: ["--headless", "--convert-to", format, "--outdir", outputDir, inputPath],
    expectedOutputs: [outputPath],
    outputMapping:
      path.resolve(generated) === path.resolve(outputPath)
        ? undefined
        : [{ source: generated, target: outputPath }]
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

