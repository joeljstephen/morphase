import type { BackendDoctorReport, MuxoryPlugin, Platform } from "@muxory/shared";

export class Doctor {
  async inspectBackend(plugin: MuxoryPlugin, platform: Platform): Promise<BackendDoctorReport> {
    const detection = await plugin.detect(platform);
    const verification = detection.installed
      ? await plugin.verify(platform)
      : { ok: false, issues: [detection.reason ?? `${plugin.name} is not installed.`], warnings: [] };

    return {
      id: plugin.id,
      name: plugin.name,
      installed: detection.installed,
      version: detection.version,
      minimumVersion: plugin.minimumVersion,
      command: detection.command,
      verified: verification.ok,
      issues: verification.issues ?? [],
      warnings: verification.warnings ?? [],
      installHints: plugin.getInstallHints(platform),
      updateHints: plugin.getUpdateHints?.(platform) ?? plugin.getInstallHints(platform),
      commonProblems: plugin.commonProblems ?? []
    };
  }

  async inspectAll(plugins: MuxoryPlugin[], platform: Platform): Promise<BackendDoctorReport[]> {
    return Promise.all(plugins.map((plugin) => this.inspectBackend(plugin, platform)));
  }
}

