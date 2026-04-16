import { compareSemver, resolveInstallHints, type BackendDoctorReport, type MorphasePlugin, type Platform, type RuntimeEnvironment } from "@morphase/shared";

export class Doctor {
  async inspectBackend(
    plugin: MorphasePlugin,
    platform: Platform,
    runtimeEnvironment: RuntimeEnvironment
  ): Promise<BackendDoctorReport> {
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
      runtimeEnvironment,
      installed: detection.installed,
      version: detection.version,
      minimumVersion: plugin.minimumVersion,
      versionSupported,
      command: detection.command,
      verified: verification.ok,
      issues: verification.issues ?? [],
      warnings: verification.warnings ?? [],
      installHints: resolveInstallHints(plugin.getInstallStrategies(), runtimeEnvironment),
      updateHints: resolveInstallHints(plugin.getUpdateStrategies?.() ?? plugin.getInstallStrategies(), runtimeEnvironment),
      commonProblems: plugin.commonProblems ?? []
    };
  }

  async inspectAll(
    plugins: MorphasePlugin[],
    platform: Platform,
    runtimeEnvironment: RuntimeEnvironment
  ): Promise<BackendDoctorReport[]> {
    return Promise.all(plugins.map((plugin) => this.inspectBackend(plugin, platform, runtimeEnvironment)));
  }
}
