import { describe, expect, it } from "vitest";

import { formatDoctorReport } from "../apps/cli/src/format.js";
import { canAutoInstall, resolveInstallHints, selectInstallStrategy, type BackendDoctorReport, type InstallStrategy, type RuntimeEnvironment } from "../packages/shared/src/index.js";

const strategies: InstallStrategy[] = [
  { kind: "package-manager", manager: "brew", command: "brew install pandoc" },
  { kind: "package-manager", manager: "apt", command: "sudo apt-get install pandoc" },
  { kind: "package-manager", manager: "dnf", command: "sudo dnf install pandoc" },
  { kind: "package-manager", manager: "pacman", command: "sudo pacman -S pandoc" },
  { kind: "package-manager", manager: "zypper", command: "sudo zypper install pandoc" },
  { kind: "manual", label: "Install Pandoc manually", url: "https://pandoc.org/installing.html" }
];

function makeReport(environment: RuntimeEnvironment): BackendDoctorReport {
  return {
    id: "pandoc",
    name: "Pandoc",
    runtimeEnvironment: environment,
    installed: false,
    versionSupported: true,
    verified: false,
    issues: ["pandoc not found"],
    warnings: [],
    installHints: resolveInstallHints(strategies, environment),
    updateHints: resolveInstallHints(strategies, environment),
    commonProblems: []
  };
}

describe("install strategy selection", () => {
  it("selects dnf on Fedora", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "fedora",
      packageManagers: ["dnf", "pip"]
    };

    const strategy = selectInstallStrategy(strategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "dnf" });
  });

  it("selects pacman on Arch", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "arch",
      packageManagers: ["pacman", "brew"]
    };

    const strategy = selectInstallStrategy(strategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "pacman" });
  });

  it("selects zypper on openSUSE", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "opensuse",
      packageManagers: ["zypper"]
    };

    const strategy = selectInstallStrategy(strategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "zypper" });
  });

  it("falls back to manual guidance on macOS without brew", () => {
    const environment: RuntimeEnvironment = {
      os: "macos",
      packageManagers: ["pip", "npm"]
    };

    const hints = resolveInstallHints(strategies, environment);
    expect(hints[0]).toMatchObject({
      kind: "manual",
      label: "Install Pandoc manually"
    });
    expect(hints[0]?.command).toBeUndefined();
  });

  it("falls back to manual guidance when no supported manager is detected", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "unknown",
      packageManagers: []
    };

    const hints = resolveInstallHints(strategies, environment);
    expect(hints[0]?.kind).toBe("manual");
    expect(hints[0]?.notes?.[0]).toContain("No supported package manager was detected");
  });
});

describe("auto-install delegation guards", () => {
  it("allows auto-install only for package-manager hints in interactive delegated sessions", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "ubuntu",
      packageManagers: ["apt"]
    };
    const hint = resolveInstallHints(strategies, environment)[0];

    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(true);
    expect(canAutoInstall(hint, { delegationEnabled: false, interactive: true })).toBe(false);
    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: false })).toBe(false);
  });

  it("never allows auto-install for manual fallbacks", () => {
    const environment: RuntimeEnvironment = {
      os: "macos",
      packageManagers: []
    };
    const hint = resolveInstallHints(strategies, environment)[0];

    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(false);
  });
});

describe("CLI-facing formatting", () => {
  it("does not print a wrong brew command when macOS lacks Homebrew", () => {
    const output = formatDoctorReport(
      makeReport({
        os: "macos",
        packageManagers: []
      })
    );

    expect(output).toContain("Install Pandoc manually");
    expect(output).not.toContain("brew install pandoc");
  });

  it("prints a Fedora dnf command when dnf is available", () => {
    const output = formatDoctorReport(
      makeReport({
        os: "linux",
        distro: "fedora",
        packageManagers: ["dnf"]
      })
    );

    expect(output).toContain("sudo dnf install pandoc");
  });
});
