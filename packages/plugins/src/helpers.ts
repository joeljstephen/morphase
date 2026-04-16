import path from "node:path";

import { detectFirstAvailableCommand, manualInstallStrategy, packageManagerStrategy } from "@morphase/plugin-sdk";
import { compareSemver, parseFirstSemver, runCommandCapture, type DetectionResult, type ExecutionPlan, type InstallStrategy, type PackageManager } from "@morphase/shared";

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

export function strategyForManager(
  manager: PackageManager,
  command: string,
  options: Omit<Extract<InstallStrategy, { kind: "package-manager" }>, "kind" | "manager" | "command"> = {}
): InstallStrategy {
  return packageManagerStrategy(manager, command, options);
}

export function manualStrategy(
  label: string,
  options: Omit<Extract<InstallStrategy, { kind: "manual" }>, "kind" | "label"> = {}
): InstallStrategy {
  return manualInstallStrategy(label, options);
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
  const args = ["--headless"];

  // PDF import requires an explicit filter before LibreOffice can export to DOCX.
  if (path.extname(inputPath).toLowerCase() === ".pdf" && format === "docx") {
    args.push("--infilter=writer_pdf_import", "--convert-to", "docx:MS Word 2007 XML");
  } else {
    args.push("--convert-to", format);
  }

  args.push("--outdir", outputDir, inputPath);

  return {
    command: "soffice",
    args,
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
