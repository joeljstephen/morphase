import { describe, expect, it } from "vitest";

import { renderCommand, resolveInstallHints, selectInstallStrategy, canAutoInstall, type BackendDoctorReport, type InstallStrategy, type RuntimeEnvironment } from "../packages/shared/src/index.js";
import { buildInstallStrategies, buildUpdateStrategies } from "../packages/plugins/src/helpers.js";

const testStrategies: InstallStrategy[] = [
  { kind: "package-manager", manager: "brew", command: { file: "brew", args: ["install", "pandoc"] } },
  { kind: "package-manager", manager: "apt", command: { file: "sudo", args: ["apt-get", "install", "pandoc"] } },
  { kind: "package-manager", manager: "dnf", command: { file: "sudo", args: ["dnf", "install", "pandoc"] } },
  { kind: "package-manager", manager: "pacman", command: { file: "sudo", args: ["pacman", "-S", "pandoc"] } },
  { kind: "package-manager", manager: "zypper", command: { file: "sudo", args: ["zypper", "install", "pandoc"] } },
  { kind: "package-manager", manager: "nix", command: { file: "nix", args: ["profile", "install", "nixpkgs#pandoc"] } },
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
    installHints: resolveInstallHints(testStrategies, environment),
    updateHints: resolveInstallHints(testStrategies, environment),
    commonProblems: []
  };
}

describe("renderCommand", () => {
  it("joins file and args with spaces", () => {
    expect(renderCommand({ file: "sudo", args: ["apt-get", "install", "pandoc"] })).toBe(
      "sudo apt-get install pandoc"
    );
  });

  it("handles a command with no args", () => {
    expect(renderCommand({ file: "brew", args: [] })).toBe("brew");
  });

  it("renders nix profile install", () => {
    expect(renderCommand({ file: "nix", args: ["profile", "install", "nixpkgs#pandoc"] })).toBe(
      "nix profile install nixpkgs#pandoc"
    );
  });
});

describe("install strategy selection", () => {
  it("selects dnf on Fedora", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "fedora",
      packageManagers: ["dnf", "pip"]
    };

    const strategy = selectInstallStrategy(testStrategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "dnf" });
  });

  it("selects pacman on Arch", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "arch",
      packageManagers: ["pacman", "brew"]
    };

    const strategy = selectInstallStrategy(testStrategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "pacman" });
  });

  it("selects zypper on openSUSE", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "opensuse",
      packageManagers: ["zypper"]
    };

    const strategy = selectInstallStrategy(testStrategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "zypper" });
  });

  it("selects nix on NixOS", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "nixos",
      packageManagers: ["nix", "pip"]
    };

    const strategy = selectInstallStrategy(testStrategies, environment);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "nix" });
  });

  it("falls back to manual guidance on macOS without brew", () => {
    const environment: RuntimeEnvironment = {
      os: "macos",
      packageManagers: ["pip", "npm"]
    };

    const hints = resolveInstallHints(testStrategies, environment);
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

    const hints = resolveInstallHints(testStrategies, environment);
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
    const hint = resolveInstallHints(testStrategies, environment)[0];

    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(true);
    expect(canAutoInstall(hint, { delegationEnabled: false, interactive: true })).toBe(false);
    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: false })).toBe(false);
  });

  it("never allows auto-install for manual fallbacks", () => {
    const environment: RuntimeEnvironment = {
      os: "macos",
      packageManagers: []
    };
    const hint = resolveInstallHints(testStrategies, environment)[0];

    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(false);
  });

  it("provides structuredCommand on package-manager hints", () => {
    const environment: RuntimeEnvironment = {
      os: "linux",
      distro: "ubuntu",
      packageManagers: ["apt"]
    };
    const hint = resolveInstallHints(testStrategies, environment)[0];

    expect(hint?.structuredCommand).toEqual({
      file: "sudo",
      args: ["apt-get", "install", "pandoc"]
    });
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

function formatDoctorReport(report: BackendDoctorReport): string {
  const green = "\x1b[32m";
  const red = "\x1b[31m";
  const yellow = "\x1b[33m";
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";

  const status = report.installed
    ? `${green}✓${reset} installed`
    : `${red}✗${reset} not installed`;

  const version = report.version ? `  ${dim}v${report.version}${reset}` : "";
  const lines: string[] = [`${bold}${report.name}${reset}  ${status}${version}`];

  if (!report.installed && report.installHints.length) {
    const hint = report.installHints[0];
    if (hint) {
      const label = hint.kind === "package-manager" && hint.command
        ? hint.command
        : hint.url
          ? `${hint.label} (${hint.url})`
          : hint.label;
      lines.push(`    ${dim}Install ${reset} ${label}`);
    }
  }

  if (report.issues.length) {
    lines.push(`  ${yellow}⚠${reset} ${report.issues.join(" · ")}`);
  }

  return lines.join("\n");
}

describe("buildInstallStrategies", () => {
  it("generates strategies from a package name map", () => {
    const strategies = buildInstallStrategies(
      { brew: "pandoc", apt: "pandoc", nix: "pandoc" },
      { label: "Install manually" }
    );

    const brew = strategies.find((s) => s.kind === "package-manager" && s.manager === "brew");
    expect(brew).toMatchObject({
      kind: "package-manager",
      manager: "brew",
      command: { file: "brew", args: ["install", "pandoc"] }
    });

    const apt = strategies.find((s) => s.kind === "package-manager" && s.manager === "apt");
    expect(apt).toMatchObject({
      kind: "package-manager",
      manager: "apt",
      command: { file: "sudo", args: ["apt-get", "install", "pandoc"] }
    });

    const nix = strategies.find((s) => s.kind === "package-manager" && s.manager === "nix");
    expect(nix).toMatchObject({
      kind: "package-manager",
      manager: "nix",
      command: { file: "nix", args: ["profile", "install", "nixpkgs#pandoc"] }
    });

    const manual = strategies.find((s) => s.kind === "manual");
    expect(manual).toMatchObject({ kind: "manual", label: "Install manually" });
  });

  it("generates pip strategies for both macOS/Linux and Windows", () => {
    const strategies = buildInstallStrategies(
      { pip: "trafilatura" },
      { label: "Install manually" }
    );

    const pipStrategies = strategies.filter(
      (s) => s.kind === "package-manager" && s.manager === "pip"
    );
    expect(pipStrategies).toHaveLength(2);

    const unix = pipStrategies.find((s) => s.os?.includes("macos"));
    expect(unix).toMatchObject({
      command: { file: "pip", args: ["install", "trafilatura"] }
    });

    const win = pipStrategies.find((s) => s.os?.includes("windows"));
    expect(win).toMatchObject({
      command: { file: "py", args: ["-m", "pip", "install", "trafilatura"] }
    });
  });

  it("generates winget strategy", () => {
    const strategies = buildInstallStrategies(
      { winget: "JohnMacFarlane.Pandoc" },
      { label: "Install manually" }
    );

    const winget = strategies.find((s) => s.kind === "package-manager" && s.manager === "winget");
    expect(winget).toMatchObject({
      command: { file: "winget", args: ["install", "JohnMacFarlane.Pandoc"] }
    });
  });

  it("generates choco and scoop strategies", () => {
    const strategies = buildInstallStrategies(
      { choco: "ffmpeg", scoop: "ffmpeg" },
      { label: "Install manually" }
    );

    const choco = strategies.find((s) => s.kind === "package-manager" && s.manager === "choco");
    expect(choco).toMatchObject({
      command: { file: "choco", args: ["install", "ffmpeg"] }
    });

    const scoop = strategies.find((s) => s.kind === "package-manager" && s.manager === "scoop");
    expect(scoop).toMatchObject({
      command: { file: "scoop", args: ["install", "ffmpeg"] }
    });
  });

  it("attaches shared notes to all strategies", () => {
    const notes = ["Note A"];
    const strategies = buildInstallStrategies(
      { brew: "pkg" },
      { label: "Install manually" },
      notes
    );

    const brew = strategies.find((s) => s.kind === "package-manager");
    expect(brew?.notes).toEqual(notes);
  });

  it("always includes a manual fallback", () => {
    const strategies = buildInstallStrategies(
      { brew: "pkg" },
      { label: "Install manually", url: "https://example.com" }
    );

    const manual = strategies.find((s) => s.kind === "manual");
    expect(manual).toBeDefined();
    expect(manual?.label).toBe("Install manually");
    expect(manual?.url).toBe("https://example.com");
  });
});

describe("buildUpdateStrategies", () => {
  it("excludes nix from update strategies", () => {
    const strategies = buildUpdateStrategies(
      { brew: "pandoc", nix: "pandoc" },
      { label: "Update manually" }
    );

    const nix = strategies.find((s) => s.kind === "package-manager" && s.manager === "nix");
    expect(nix).toBeUndefined();

    const brew = strategies.find((s) => s.kind === "package-manager" && s.manager === "brew");
    expect(brew).toMatchObject({
      command: { file: "brew", args: ["upgrade", "pandoc"] }
    });
  });

  it("generates apt update with --only-upgrade", () => {
    const strategies = buildUpdateStrategies(
      { apt: "pandoc" },
      { label: "Update manually" }
    );

    const apt = strategies.find((s) => s.kind === "package-manager" && s.manager === "apt");
    expect(apt).toMatchObject({
      command: { file: "sudo", args: ["apt-get", "install", "--only-upgrade", "pandoc"] }
    });
  });
});
