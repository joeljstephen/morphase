import type { InstallHint, InstallStrategy, LinuxDistro, PackageManager, RuntimeEnvironment, SupportedOS } from "../types/index.js";

const packageManagerLabels: Record<PackageManager, string> = {
  brew: "Homebrew",
  winget: "WinGet",
  choco: "Chocolatey",
  scoop: "Scoop",
  apt: "apt",
  dnf: "dnf",
  yum: "yum",
  pacman: "pacman",
  zypper: "zypper",
  apk: "apk",
  pip: "pip",
  pipx: "pipx",
  npm: "npm"
};

function matchesEnvironment(
  strategy: InstallStrategy,
  environment: RuntimeEnvironment
): boolean {
  if (strategy.os && !strategy.os.includes(environment.os)) {
    return false;
  }

  if (strategy.distros?.length) {
    if (environment.os !== "linux") {
      return false;
    }

    const distro = environment.distro ?? "unknown";
    if (!strategy.distros.includes(distro)) {
      return false;
    }
  }

  return true;
}

function specificity(
  strategy: InstallStrategy,
  environment: RuntimeEnvironment
): number {
  let score = 0;

  if (strategy.os?.includes(environment.os)) {
    score += 2;
  }

  if (environment.os === "linux" && strategy.distros?.includes(environment.distro ?? "unknown")) {
    score += 3;
  }

  return score;
}

function manualFallbackNotes(environment: RuntimeEnvironment): string[] {
  if (environment.packageManagers.length === 0) {
    return [
      "No supported package manager was detected for automatic install hints. Install this backend manually."
    ];
  }

  return [
    `No compatible package-manager install strategy matched the detected environment (${environment.packageManagers.join(", ")}). Install this backend manually.`
  ];
}

function toHint(strategy: InstallStrategy, autoInstallable = false): InstallHint {
  if (strategy.kind === "package-manager") {
    return {
      kind: "package-manager",
      label: `Install with ${packageManagerLabel(strategy.manager)}`,
      manager: strategy.manager,
      command: strategy.command,
      notes: strategy.notes,
      autoInstallable
    };
  }

  return {
    kind: "manual",
    label: strategy.label,
    notes: strategy.notes,
    url: strategy.url,
    autoInstallable: false
  };
}

export function packageManagerLabel(manager: PackageManager): string {
  return packageManagerLabels[manager];
}

export function selectInstallStrategy(
  strategies: InstallStrategy[],
  environment: RuntimeEnvironment
): InstallStrategy | null {
  const applicable = strategies.filter((strategy) => matchesEnvironment(strategy, environment));
  const packageStrategies = applicable
    .filter((strategy): strategy is Extract<InstallStrategy, { kind: "package-manager" }> => strategy.kind === "package-manager")
    .filter((strategy) => environment.packageManagers.includes(strategy.manager))
    .sort(
      (left, right) =>
        environment.packageManagers.indexOf(left.manager) - environment.packageManagers.indexOf(right.manager)
    );

  if (packageStrategies.length > 0) {
    return packageStrategies[0] ?? null;
  }

  const manualStrategies = applicable
    .filter((strategy): strategy is Extract<InstallStrategy, { kind: "manual" }> => strategy.kind === "manual")
    .sort((left, right) => specificity(right, environment) - specificity(left, environment));

  return manualStrategies[0] ?? null;
}

export function resolveInstallHints(
  strategies: InstallStrategy[],
  environment: RuntimeEnvironment
): InstallHint[] {
  const selected = selectInstallStrategy(strategies, environment);
  if (!selected) {
    return [
      {
        kind: "manual",
        label: "Install manually",
        notes: manualFallbackNotes(environment),
        autoInstallable: false
      }
    ];
  }

  if (selected.kind === "package-manager") {
    const applicableManual = strategies
      .filter((strategy): strategy is Extract<InstallStrategy, { kind: "manual" }> => strategy.kind === "manual")
      .filter((strategy) => matchesEnvironment(strategy, environment))
      .sort((left, right) => specificity(right, environment) - specificity(left, environment));

    const hints = [toHint(selected, true)];
    if (applicableManual[0]) {
      hints.push(toHint(applicableManual[0]));
    }
    return hints;
  }

  return [
    {
      ...toHint(selected),
      notes: [...manualFallbackNotes(environment), ...(selected.notes ?? [])]
    }
  ];
}

export function canAutoInstall(
  hint: InstallHint | undefined,
  options: {
    delegationEnabled: boolean;
    interactive: boolean;
  }
): boolean {
  return Boolean(
    hint &&
      hint.kind === "package-manager" &&
      hint.command &&
      hint.autoInstallable &&
      options.delegationEnabled &&
      options.interactive
  );
}

export function installHintSummary(hint: InstallHint): string {
  if (hint.kind === "package-manager" && hint.command) {
    return hint.command;
  }

  return hint.url ? `${hint.label} (${hint.url})` : hint.label;
}

export function runtimeEnvironmentLabel(environment: RuntimeEnvironment): string {
  if (environment.os !== "linux") {
    return environment.os;
  }

  return environment.distro && environment.distro !== "unknown"
    ? `linux (${environment.distro})`
    : "linux";
}

export function strategyAppliesToLinuxDistro(
  strategy: InstallStrategy,
  distro: LinuxDistro
): boolean {
  return strategy.distros ? strategy.distros.includes(distro) : true;
}

export function strategyAppliesToOS(
  strategy: InstallStrategy,
  os: SupportedOS
): boolean {
  return strategy.os ? strategy.os.includes(os) : true;
}
