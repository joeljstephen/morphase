import path from "node:path";

import { detectFirstAvailableCommand, manualInstallStrategy, packageManagerStrategy } from "@morphase/plugin-sdk";
import { compareSemver, parseFirstSemver, runCommandCapture, type DetectionResult, type ExecutionPlan, type InstallStrategy, type PackageManager, type StructuredCommand } from "@morphase/shared";

export type PackageEntry = string | StructuredCommand;
export type PackageNameMap = Partial<Record<PackageManager, PackageEntry>>;

const installTemplates: Record<PackageManager, (pkg: string) => StructuredCommand> = {
  brew: (pkg) => ({ file: "brew", args: ["install", pkg] }),
  winget: (pkg) => ({ file: "winget", args: ["install", pkg] }),
  choco: (pkg) => ({ file: "choco", args: ["install", pkg] }),
  scoop: (pkg) => ({ file: "scoop", args: ["install", pkg] }),
  apt: (pkg) => ({ file: "sudo", args: ["apt-get", "install", pkg] }),
  dnf: (pkg) => ({ file: "sudo", args: ["dnf", "install", pkg] }),
  yum: (pkg) => ({ file: "sudo", args: ["yum", "install", pkg] }),
  pacman: (pkg) => ({ file: "sudo", args: ["pacman", "-S", pkg] }),
  zypper: (pkg) => ({ file: "sudo", args: ["zypper", "install", pkg] }),
  apk: (pkg) => ({ file: "sudo", args: ["apk", "add", pkg] }),
  nix: (pkg) => ({ file: "nix", args: ["profile", "install", `nixpkgs#${pkg}`] }),
  pkg: (pkg) => ({ file: "sudo", args: ["pkg", "install", pkg] }),
  pip: (pkg) => ({ file: "pip", args: ["install", pkg] }),
  pipx: (pkg) => ({ file: "pipx", args: ["install", pkg] }),
  npm: (pkg) => ({ file: "npm", args: ["i", "-g", pkg] }),
};

const updateTemplates: Record<PackageManager, (pkg: string) => StructuredCommand> = {
  brew: (pkg) => ({ file: "brew", args: ["upgrade", pkg] }),
  winget: (pkg) => ({ file: "winget", args: ["upgrade", pkg] }),
  choco: (pkg) => ({ file: "choco", args: ["upgrade", pkg] }),
  scoop: (pkg) => ({ file: "scoop", args: ["update", pkg] }),
  apt: (pkg) => ({ file: "sudo", args: ["apt-get", "install", "--only-upgrade", pkg] }),
  dnf: (pkg) => ({ file: "sudo", args: ["dnf", "upgrade", pkg] }),
  yum: (pkg) => ({ file: "sudo", args: ["yum", "update", pkg] }),
  pacman: (pkg) => ({ file: "sudo", args: ["pacman", "-S", pkg] }),
  zypper: (pkg) => ({ file: "sudo", args: ["zypper", "update", pkg] }),
  apk: (pkg) => ({ file: "sudo", args: ["apk", "upgrade", pkg] }),
  nix: (pkg) => ({ file: "nix", args: ["profile", "install", `nixpkgs#${pkg}`] }),
  pkg: (pkg) => ({ file: "sudo", args: ["pkg", "upgrade", pkg] }),
  pip: (pkg) => ({ file: "pip", args: ["install", "--upgrade", pkg] }),
  pipx: (pkg) => ({ file: "pipx", args: ["upgrade", pkg] }),
  npm: (pkg) => ({ file: "npm", args: ["update", "-g", pkg] }),
};

function resolveCommand(
  manager: PackageManager,
  entry: PackageEntry,
  templates: Record<PackageManager, (pkg: string) => StructuredCommand>
): StructuredCommand {
  if (typeof entry === "string") {
    return templates[manager](entry);
  }
  return entry;
}

export function buildInstallStrategies(
  packages: PackageNameMap,
  manual: { label: string; url?: string; notes?: string[] },
  sharedNotes?: string[]
): InstallStrategy[] {
  const strategies: InstallStrategy[] = [];

  for (const manager of Object.keys(packages) as PackageManager[]) {
    const entry = packages[manager];
    if (entry == null) continue;

    if (manager === "pip" && typeof entry === "string") {
      strategies.push({
        kind: "package-manager",
        manager: "pip",
        command: { file: "pip", args: ["install", entry] },
        os: ["macos", "linux"],
        notes: sharedNotes
      });
      strategies.push({
        kind: "package-manager",
        manager: "pip",
        command: { file: "py", args: ["-m", "pip", "install", entry] },
        os: ["windows"],
        notes: sharedNotes
      });
      continue;
    }

    strategies.push({
      kind: "package-manager",
      manager,
      command: resolveCommand(manager, entry, installTemplates),
      notes: sharedNotes
    });
  }

  strategies.push(manualInstallStrategy(manual.label, {
    notes: manual.notes,
    url: manual.url
  }));

  return strategies;
}

export function buildUpdateStrategies(
  packages: PackageNameMap,
  manual: { label: string; url?: string; notes?: string[] },
  sharedNotes?: string[]
): InstallStrategy[] {
  const strategies: InstallStrategy[] = [];

  for (const manager of Object.keys(packages) as PackageManager[]) {
    const entry = packages[manager];
    if (entry == null) continue;

    if (manager === "nix") continue;

    if (manager === "pip" && typeof entry === "string") {
      strategies.push({
        kind: "package-manager",
        manager: "pip",
        command: { file: "pip", args: ["install", "--upgrade", entry] },
        os: ["macos", "linux"],
        notes: sharedNotes
      });
      strategies.push({
        kind: "package-manager",
        manager: "pip",
        command: { file: "py", args: ["-m", "pip", "install", "--upgrade", entry] },
        os: ["windows"],
        notes: sharedNotes
      });
      continue;
    }

    strategies.push({
      kind: "package-manager",
      manager,
      command: resolveCommand(manager, entry, updateTemplates),
      notes: sharedNotes
    });
  }

  strategies.push(manualInstallStrategy(manual.label, {
    notes: manual.notes,
    url: manual.url
  }));

  return strategies;
}

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
  command: StructuredCommand,
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
