import { compareSemver, type BackendDoctorReport, type MorphasePlugin, type Platform } from "@morphase/shared";

export class Doctor {
  async inspectBackend(plugin: MorphasePlugin, platform: Platform): Promise<BackendDoctorReport> {
    const detection = await plugin.detect(platform);
    const verification = detection.installed
      ? await plugin.verify(platform)
      : { ok: false, issues: [detection.reason ?? `${plugin.name} is not installed.`], warnings: [] };

    let versionSupported = true;
    if (detection.installed && detection.version && plugin.minimumVersion) {
      versionSupported = compareSemver(detection.version, plugin.minimumVersion) >= 0;
    }

    return {
      id: plugin.id,
      name: plugin.name,
      installed: detection.installed,
      version: detection.version,
      minimumVersion: plugin.minimumVersion,
      versionSupported,
      command: detection.command,
      verified: verification.ok,
      issues: verification.issues ?? [],
      warnings: verification.warnings ?? [],
      installHints: plugin.getInstallHints(platform),
      updateHints: plugin.getUpdateHints?.(platform) ?? plugin.getInstallHints(platform),
      commonProblems: plugin.commonProblems ?? []
    };
  }

  async inspectAll(plugins: MorphasePlugin[], platform: Platform): Promise<BackendDoctorReport[]> {
    return Promise.all(plugins.map((plugin) => this.inspectBackend(plugin, platform)));
  }
}

