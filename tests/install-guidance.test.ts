import { describe, expect, it } from "vitest";

import {
  canAutoInstall,
  installHintSummary,
  packageManagerLabel,
  renderCommand,
  resolveInstallHints,
  runtimeEnvironmentLabel,
  selectInstallStrategy,
  strategyAppliesToLinuxDistro,
  strategyAppliesToOS,
  type BackendDoctorReport,
  type InstallStrategy,
  type RuntimeEnvironment
} from "../packages/shared/src/index.js";
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

  it("renders Windows pip via py", () => {
    expect(renderCommand({ file: "py", args: ["-m", "pip", "install", "whisper"] })).toBe(
      "py -m pip install whisper"
    );
  });

  it("renders winget install", () => {
    expect(renderCommand({ file: "winget", args: ["install", "Gyan.FFmpeg"] })).toBe(
      "winget install Gyan.FFmpeg"
    );
  });
});

describe("install strategy selection", () => {
  it("selects brew on macOS with Homebrew", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: ["brew", "pip", "npm"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "brew" });
  });

  it("selects apt on Ubuntu", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt", "pip"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "apt" });
  });

  it("selects dnf on Fedora", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "fedora", packageManagers: ["dnf", "pip"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "dnf" });
  });

  it("selects pacman on Arch", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "arch", packageManagers: ["pacman", "brew"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "pacman" });
  });

  it("selects zypper on openSUSE", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "opensuse", packageManagers: ["zypper"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "zypper" });
  });

  it("selects nix on NixOS", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "nixos", packageManagers: ["nix", "pip"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "nix" });
  });

  it("prefers the first-detected manager when multiple match", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt", "brew"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "package-manager", manager: "apt" });
  });

  it("falls back to manual when no supported manager matches", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: ["pip", "npm"] };
    const strategy = selectInstallStrategy(testStrategies, env);
    expect(strategy).toMatchObject({ kind: "manual" });
  });

  it("returns null when no strategy matches at all", () => {
    const noMatchStrategies: InstallStrategy[] = [
      { kind: "package-manager", manager: "brew", command: { file: "brew", args: ["install", "x"] }, os: ["macos"] }
    ];
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt"] };
    const strategy = selectInstallStrategy(noMatchStrategies, env);
    expect(strategy).toBeNull();
  });

  it("falls back to manual guidance on macOS without brew", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: ["pip", "npm"] };
    const hints = resolveInstallHints(testStrategies, env);
    expect(hints[0]).toMatchObject({ kind: "manual", label: "Install Pandoc manually" });
    expect(hints[0]?.command).toBeUndefined();
  });

  it("falls back to manual guidance when no supported manager is detected", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "unknown", packageManagers: [] };
    const hints = resolveInstallHints(testStrategies, env);
    expect(hints[0]?.kind).toBe("manual");
    expect(hints[0]?.notes?.[0]).toContain("No supported package manager was detected");
  });

  it("falls back to manual guidance on unknown Linux with non-matching managers", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "unknown", packageManagers: ["pip", "npm"] };
    const hints = resolveInstallHints(testStrategies, env);
    expect(hints[0]?.kind).toBe("manual");
    expect(hints[0]?.notes?.[0]).toContain("No compatible package-manager install strategy matched");
  });
});

describe("CLI output for install hints", () => {
  const green = "\x1b[32m";
  const red = "\x1b[31m";
  const yellow = "\x1b[33m";
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";

  function formatDoctorReport(report: BackendDoctorReport): string {
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

  it("shows dnf command on Fedora", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "fedora", packageManagers: ["dnf"]
    }));
    expect(output).toContain("sudo dnf install pandoc");
  });

  it("shows pacman command on Arch", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "arch", packageManagers: ["pacman"]
    }));
    expect(output).toContain("sudo pacman -S pandoc");
  });

  it("shows zypper command on openSUSE", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "opensuse", packageManagers: ["zypper"]
    }));
    expect(output).toContain("sudo zypper install pandoc");
  });

  it("does not show brew command when macOS lacks Homebrew", () => {
    const output = formatDoctorReport(makeReport({
      os: "macos", packageManagers: []
    }));
    expect(output).toContain("Install Pandoc manually");
    expect(output).not.toContain("brew install pandoc");
  });

  it("shows brew command on macOS with Homebrew", () => {
    const output = formatDoctorReport(makeReport({
      os: "macos", packageManagers: ["brew"]
    }));
    expect(output).toContain("brew install pandoc");
  });

  it("gives manual fallback for unknown environment with no managers", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "unknown", packageManagers: []
    }));
    expect(output).toContain("Install Pandoc manually");
    expect(output).not.toContain("brew install");
    expect(output).not.toContain("sudo");
  });

  it("shows nix profile install on NixOS", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "nixos", packageManagers: ["nix"]
    }));
    expect(output).toContain("nix profile install nixpkgs#pandoc");
  });

  it("shows apt command on Ubuntu", () => {
    const output = formatDoctorReport(makeReport({
      os: "linux", distro: "ubuntu", packageManagers: ["apt"]
    }));
    expect(output).toContain("sudo apt-get install pandoc");
  });

  it("Windows plugin with no supported manager falls back honestly", () => {
    const winOnlyStrategies: InstallStrategy[] = [
      { kind: "package-manager", manager: "winget", command: { file: "winget", args: ["install", "jpegoptim"] } },
      { kind: "manual", label: "Install jpegoptim manually", notes: ["Not available via common Windows package managers."] }
    ];
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt"] };
    const hints = resolveInstallHints(winOnlyStrategies, env);
    expect(hints[0]?.kind).toBe("manual");
    expect(hints[0]?.label).toBe("Install jpegoptim manually");
  });
});

describe("auto-install delegation guards", () => {
  it("allows auto-install only for package-manager hints in interactive delegated sessions", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt"] };
    const hint = resolveInstallHints(testStrategies, env)[0];

    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(true);
    expect(canAutoInstall(hint, { delegationEnabled: false, interactive: true })).toBe(false);
    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: false })).toBe(false);
    expect(canAutoInstall(hint, { delegationEnabled: false, interactive: false })).toBe(false);
  });

  it("never allows auto-install for manual fallbacks", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: [] };
    const hint = resolveInstallHints(testStrategies, env)[0];
    expect(canAutoInstall(hint, { delegationEnabled: true, interactive: true })).toBe(false);
  });

  it("never allows auto-install for undefined hint", () => {
    expect(canAutoInstall(undefined, { delegationEnabled: true, interactive: true })).toBe(false);
  });

  it("provides structuredCommand on package-manager hints", () => {
    const env: RuntimeEnvironment = { os: "linux", distro: "ubuntu", packageManagers: ["apt"] };
    const hint = resolveInstallHints(testStrategies, env)[0];
    expect(hint?.structuredCommand).toEqual({
      file: "sudo",
      args: ["apt-get", "install", "pandoc"]
    });
  });
});

describe("installHintSummary", () => {
  it("returns the command string for package-manager hints", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: ["brew"] };
    const hint = resolveInstallHints(testStrategies, env)[0];
    expect(installHintSummary(hint!)).toBe("brew install pandoc");
  });

  it("returns the label with URL for manual hints with a url", () => {
    const env: RuntimeEnvironment = { os: "macos", packageManagers: [] };
    const hint = resolveInstallHints(testStrategies, env)[0];
    expect(installHintSummary(hint!)).toContain("Install Pandoc manually");
  });

  it("returns just the label for manual hints without a url", () => {
    const strategies: InstallStrategy[] = [
      { kind: "manual", label: "Install manually" }
    ];
    const env: RuntimeEnvironment = { os: "linux", distro: "unknown", packageManagers: [] };
    const hint = resolveInstallHints(strategies, env)[0];
    expect(installHintSummary(hint!)).toBe("Install manually");
  });
});

describe("packageManagerLabel", () => {
  it("returns human-readable labels for known managers", () => {
    expect(packageManagerLabel("brew")).toBe("Homebrew");
    expect(packageManagerLabel("winget")).toBe("WinGet");
    expect(packageManagerLabel("choco")).toBe("Chocolatey");
    expect(packageManagerLabel("scoop")).toBe("Scoop");
    expect(packageManagerLabel("apt")).toBe("apt");
    expect(packageManagerLabel("nix")).toBe("nix");
    expect(packageManagerLabel("pip")).toBe("pip");
    expect(packageManagerLabel("npm")).toBe("npm");
  });
});

describe("runtimeEnvironmentLabel", () => {
  it("returns os name for non-Linux", () => {
    expect(runtimeEnvironmentLabel({ os: "macos", packageManagers: [] })).toBe("macos");
    expect(runtimeEnvironmentLabel({ os: "windows", packageManagers: [] })).toBe("windows");
  });

  it("returns 'linux (distro)' for known distros", () => {
    expect(runtimeEnvironmentLabel({ os: "linux", distro: "ubuntu", packageManagers: [] })).toBe("linux (ubuntu)");
    expect(runtimeEnvironmentLabel({ os: "linux", distro: "fedora", packageManagers: [] })).toBe("linux (fedora)");
    expect(runtimeEnvironmentLabel({ os: "linux", distro: "nixos", packageManagers: [] })).toBe("linux (nixos)");
  });

  it("returns 'linux' for unknown distro", () => {
    expect(runtimeEnvironmentLabel({ os: "linux", distro: "unknown", packageManagers: [] })).toBe("linux");
    expect(runtimeEnvironmentLabel({ os: "linux", packageManagers: [] })).toBe("linux");
  });
});

describe("strategyAppliesToOS / strategyAppliesToLinuxDistro", () => {
  const strategy: InstallStrategy = {
    kind: "package-manager",
    manager: "pip",
    command: { file: "pip", args: ["install", "x"] },
    os: ["macos", "linux"]
  };

  it("matches when strategy has no os constraint", () => {
    const unconstrained: InstallStrategy = {
      kind: "package-manager",
      manager: "brew",
      command: { file: "brew", args: ["install", "x"] }
    };
    expect(strategyAppliesToOS(unconstrained, "macos")).toBe(true);
    expect(strategyAppliesToOS(unconstrained, "windows")).toBe(true);
    expect(strategyAppliesToOS(unconstrained, "linux")).toBe(true);
  });

  it("matches only specified OS", () => {
    expect(strategyAppliesToOS(strategy, "macos")).toBe(true);
    expect(strategyAppliesToOS(strategy, "linux")).toBe(true);
    expect(strategyAppliesToOS(strategy, "windows")).toBe(false);
  });

  it("matches distro when distros constraint is present", () => {
    const distroScoped: InstallStrategy = {
      kind: "package-manager",
      manager: "apt",
      command: { file: "sudo", args: ["apt-get", "install", "x"] },
      distros: ["ubuntu", "debian"]
    };
    expect(strategyAppliesToLinuxDistro(distroScoped, "ubuntu")).toBe(true);
    expect(strategyAppliesToLinuxDistro(distroScoped, "debian")).toBe(true);
    expect(strategyAppliesToLinuxDistro(distroScoped, "fedora")).toBe(false);
  });

  it("matches any distro when no distro constraint", () => {
    expect(strategyAppliesToLinuxDistro(strategy, "ubuntu")).toBe(true);
    expect(strategyAppliesToLinuxDistro(strategy, "fedora")).toBe(true);
  });
});

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

  it("generates all Linux package manager strategies", () => {
    const strategies = buildInstallStrategies(
      { apt: "pkg", dnf: "pkg", yum: "pkg", pacman: "pkg", zypper: "pkg", apk: "pkg" },
      { label: "Install manually" }
    );

    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "apt")).toMatchObject({
      command: { file: "sudo", args: ["apt-get", "install", "pkg"] }
    });
    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "dnf")).toMatchObject({
      command: { file: "sudo", args: ["dnf", "install", "pkg"] }
    });
    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "yum")).toMatchObject({
      command: { file: "sudo", args: ["yum", "install", "pkg"] }
    });
    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "pacman")).toMatchObject({
      command: { file: "sudo", args: ["pacman", "-S", "pkg"] }
    });
    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "zypper")).toMatchObject({
      command: { file: "sudo", args: ["zypper", "install", "pkg"] }
    });
    expect(strategies.find((s) => s.kind === "package-manager" && s.manager === "apk")).toMatchObject({
      command: { file: "sudo", args: ["apk", "add", "pkg"] }
    });
  });

  it("generates npm strategy", () => {
    const strategies = buildInstallStrategies(
      { npm: "@steipete/summarize" },
      { label: "Install manually" }
    );

    const npm = strategies.find((s) => s.kind === "package-manager" && s.manager === "npm");
    expect(npm).toMatchObject({
      command: { file: "npm", args: ["i", "-g", "@steipete/summarize"] }
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

  it("manual fallback includes notes", () => {
    const strategies = buildInstallStrategies(
      { brew: "pkg" },
      { label: "Install manually", notes: ["Step 1: download", "Step 2: install"] }
    );

    const manual = strategies.find((s) => s.kind === "manual");
    expect(manual?.notes).toEqual(["Step 1: download", "Step 2: install"]);
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

  it("generates pip update for both platforms", () => {
    const strategies = buildUpdateStrategies(
      { pip: "trafilatura" },
      { label: "Update manually" }
    );

    const pipStrategies = strategies.filter(
      (s) => s.kind === "package-manager" && s.manager === "pip"
    );
    expect(pipStrategies).toHaveLength(2);

    const unix = pipStrategies.find((s) => s.os?.includes("macos"));
    expect(unix).toMatchObject({
      command: { file: "pip", args: ["install", "--upgrade", "trafilatura"] }
    });

    const win = pipStrategies.find((s) => s.os?.includes("windows"));
    expect(win).toMatchObject({
      command: { file: "py", args: ["-m", "pip", "install", "--upgrade", "trafilatura"] }
    });
  });

  it("generates winget update", () => {
    const strategies = buildUpdateStrategies(
      { winget: "pandoc" },
      { label: "Update manually" }
    );

    const winget = strategies.find((s) => s.kind === "package-manager" && s.manager === "winget");
    expect(winget).toMatchObject({
      command: { file: "winget", args: ["upgrade", "pandoc"] }
    });
  });

  it("always includes a manual fallback", () => {
    const strategies = buildUpdateStrategies(
      { brew: "pkg" },
      { label: "Update manually" }
    );

    const manual = strategies.find((s) => s.kind === "manual");
    expect(manual).toBeDefined();
    expect(manual?.label).toBe("Update manually");
  });
});
