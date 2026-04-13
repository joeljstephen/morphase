import fs from "node:fs";
import path from "node:path";

import type { BackendDoctorReport, JobResult, MorphaseError } from "@morphase/shared";

const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function labeled(label: string, value: string): string {
  return `    ${dim}${label.padEnd(8)}${reset} ${value}`;
}

export function formatCliError(error: unknown): string {
  if (error instanceof Error && "details" in error) {
    const details = (error as { details: MorphaseError }).details;
    const lines: string[] = [
      "",
      `  ${red}✗${reset}  ${bold}${details.message}${reset}`
    ];
    if (details.likelyCause) {
      lines.push(labeled("Cause", details.likelyCause));
    }
    if (details.suggestedFixes?.length) {
      for (const fix of details.suggestedFixes) {
        lines.push(labeled("Try", fix));
      }
    }
    lines.push("");
    return lines.join("\n");
  }

  const message = error instanceof Error ? error.message : String(error);
  return `${red}✗${reset} ${message}`;
}

export function formatDoctorReport(report: BackendDoctorReport): string {
  const status = report.installed
    ? `${green}✓${reset} installed`
    : `${red}✗${reset} not installed`;

  const version = report.version ? `  ${dim}v${report.version}${reset}` : "";
  const lines: string[] = [`${bold}${report.name}${reset}  ${status}${version}`];

  if (report.installed && !report.versionSupported && report.minimumVersion) {
    lines.push(`  ${red}✗${reset} version ${report.version} is below minimum ${report.minimumVersion}`);
    const updateCmd = report.updateHints[0]?.command;
    if (updateCmd) {
      lines.push(`  ${dim}Update:${reset} ${updateCmd}`);
    }
  }

  if (!report.installed && report.installHints.length) {
    const cmd = report.installHints[0]?.command;
    if (cmd) {
      lines.push(`  ${dim}Install:${reset} ${cmd}`);
    }
  }

  if (report.issues.length) {
    lines.push(`  ${yellow}⚠${reset} ${report.issues.join(" · ")}`);
  }

  return lines.join("\n");
}

export function formatJobResult(result: JobResult): string {
  if (result.status === "success") {
    const lines: string[] = [
      "",
      `  ${green}✓${reset}  ${bold}Saved successfully${reset}`
    ];

    for (const p of result.outputPaths) {
      const name = path.basename(p);
      let sizeInfo = "";
      try {
        sizeInfo = ` ${dim}(${humanSize(fs.statSync(p).size)})${reset}`;
      } catch {}
      lines.push(labeled("File", `${name}${sizeInfo}`));
      lines.push(labeled("Path", `${dim}${p}${reset}`));
    }

    if (result.backendId) {
      lines.push(labeled("Via", result.backendId));
    }

    if (result.warnings?.length) {
      lines.push("");
      for (const w of result.warnings) {
        lines.push(`  ${yellow}⚠${reset}  ${w}`);
      }
    }

    lines.push("");
    return lines.join("\n");
  }

  const lines: string[] = [
    "",
    `  ${red}✗${reset}  ${bold}Failed${reset}`
  ];

  if (result.backendId) {
    lines.push(labeled("Via", result.backendId));
  }

  if (result.error) {
    lines.push(labeled("Error", result.error.message));
    if (result.error.likelyCause) {
      lines.push(labeled("Cause", result.error.likelyCause));
    }
    if (result.error.suggestedFixes?.length) {
      for (const fix of result.error.suggestedFixes) {
        lines.push(labeled("Try", fix));
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}
