import type { BackendDoctorReport, JobResult, MuxoryError } from "@muxory/shared";

export function formatCliError(error: unknown): string {
  const lines: string[] = ["status: failed"];

  if (error instanceof Error && "details" in error) {
    const details = (error as { details: MuxoryError }).details;
    lines.push(`error: ${details.message}`);
    if (details.likelyCause) {
      lines.push(`likely cause: ${details.likelyCause}`);
    }
    if (details.suggestedFixes?.length) {
      lines.push(`suggestions: ${details.suggestedFixes.join(" | ")}`);
    }
    return lines.join("\n");
  }

  lines.push(`error: ${error instanceof Error ? error.message : String(error)}`);
  return lines.join("\n");
}

export function formatDoctorReport(report: BackendDoctorReport): string {
  const lines = [
    `${report.name} (${report.id})`,
    `  installed: ${report.installed ? "yes" : "no"}`,
    `  version: ${report.version ?? "unknown"}`,
    `  minimum: ${report.minimumVersion ?? "n/a"}`,
    `  command: ${report.command ?? "n/a"}`,
    `  verified: ${report.verified ? "yes" : "no"}`
  ];

  if (report.warnings.length) {
    lines.push(`  warnings: ${report.warnings.join(" | ")}`);
  }

  if (report.issues.length) {
    lines.push(`  issues: ${report.issues.join(" | ")}`);
  }

  if (report.installHints.length) {
    lines.push(
      `  install: ${report.installHints
        .map((hint) => hint.command ?? hint.manager)
        .join(" | ")}`
    );
  }

  return lines.join("\n");
}

export function formatJobResult(result: JobResult): string {
  const lines = [
    `job: ${result.jobId}`,
    `status: ${result.status}`,
    `backend: ${result.backendId ?? "n/a"}`
  ];

  if (result.outputPaths.length) {
    lines.push(`outputs: ${result.outputPaths.join(", ")}`);
  }

  if (result.warnings?.length) {
    lines.push(`warnings: ${result.warnings.join(" | ")}`);
  }

  if (result.equivalentCommand) {
    lines.push(`direct command: ${result.equivalentCommand}`);
  }

  if (result.error) {
    lines.push(`error: ${result.error.message}`);
    if (result.error.likelyCause) {
      lines.push(`likely cause: ${result.error.likelyCause}`);
    }
    if (result.error.suggestedFixes?.length) {
      lines.push(`suggestions: ${result.error.suggestedFixes.join(" | ")}`);
    }
  }

  return lines.join("\n");
}
