import type { BackendDoctorReport, JobResult, MuxoryError } from "@muxory/shared";

const green = "\x1b[32m";
const red = "\x1b[31m";
const yellow = "\x1b[33m";
const cyan = "\x1b[36m";
const dim = "\x1b[2m";
const bold = "\x1b[1m";
const reset = "\x1b[0m";

export function formatCliError(error: unknown): string {
  if (error instanceof Error && "details" in error) {
    const details = (error as { details: MuxoryError }).details;
    const lines: string[] = [`${red}✗${reset} ${details.message}`];
    if (details.likelyCause) {
      lines.push(`  ${dim}Cause:${reset} ${details.likelyCause}`);
    }
    if (details.suggestedFixes?.length) {
      lines.push(`  ${dim}Try:${reset} ${details.suggestedFixes.join(" · ")}`);
    }
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
    const lines: string[] = [`${green}✓ Done${reset}`];
    if (result.outputPaths.length) {
      for (const p of result.outputPaths) {
        lines.push(`  ${cyan}→${reset} ${p}`);
      }
    }
    if (result.warnings?.length) {
      for (const w of result.warnings) {
        lines.push(`  ${yellow}⚠${reset} ${w}`);
      }
    }
    return lines.join("\n");
  }

  const lines: string[] = [`${red}✗ Failed${reset}`];
  if (result.error) {
    lines.push(`  ${dim}Error:${reset} ${result.error.message}`);
    if (result.error.likelyCause) {
      lines.push(`  ${dim}Cause:${reset} ${result.error.likelyCause}`);
    }
    if (result.error.suggestedFixes?.length) {
      lines.push(`  ${dim}Try:${reset} ${result.error.suggestedFixes.join(" · ")}`);
    }
  }
  return lines.join("\n");
}
