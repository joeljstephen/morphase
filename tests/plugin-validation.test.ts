import { describe, expect, it } from "vitest";

import { resolveInstallHints, selectInstallStrategy, type InstallStrategy, type PackageManager, type RuntimeEnvironment } from "../packages/shared/src/index.js";
import { builtinPlugins } from "../packages/plugins/src/index.js";

const validManagers: PackageManager[] = [
  "brew", "winget", "choco", "scoop", "apt", "dnf", "yum",
  "pacman", "zypper", "apk", "nix", "pkg", "pip", "pipx", "npm"
];

const environments: Record<string, RuntimeEnvironment> = {
  macos: { os: "macos", packageManagers: ["brew", "pipx", "pip", "npm"] },
  macosNoBrew: { os: "macos", packageManagers: ["pipx", "pip", "npm"] },
  windows: { os: "windows", packageManagers: ["winget", "choco", "scoop", "pipx", "pip", "npm"] },
  ubuntu: { os: "linux", distro: "ubuntu", packageManagers: ["apt", "brew", "pipx", "pip", "npm"] },
  fedora: { os: "linux", distro: "fedora", packageManagers: ["dnf", "yum", "pipx", "pip", "npm"] },
  arch: { os: "linux", distro: "arch", packageManagers: ["pacman", "brew", "pipx", "pip", "npm"] },
  opensuse: { os: "linux", distro: "opensuse", packageManagers: ["zypper", "pipx", "pip", "npm"] },
  alpine: { os: "linux", distro: "alpine", packageManagers: ["apk", "pipx", "pip", "npm"] },
  nixos: { os: "linux", distro: "nixos", packageManagers: ["nix", "pipx", "pip", "npm"] },
  freebsd: { os: "bsd", bsdFlavor: "freebsd", packageManagers: ["pkg", "pipx", "pip", "npm"] },
  unknownLinux: { os: "linux", distro: "unknown", packageManagers: ["pip", "npm"] },
  empty: { os: "linux", distro: "unknown", packageManagers: [] }
};

describe("plugin strategy validation", () => {
  for (const plugin of builtinPlugins) {
    describe(`${plugin.id}`, () => {
      it("has at least one install strategy", () => {
        const strategies = plugin.getInstallStrategies();
        expect(strategies.length).toBeGreaterThan(0);
      });

      it("includes a manual fallback", () => {
        const strategies = plugin.getInstallStrategies();
        const manual = strategies.find((s) => s.kind === "manual");
        expect(manual).toBeDefined();
        if (manual && manual.kind === "manual") {
          expect(manual.label.length).toBeGreaterThan(0);
        }
      });

      it("uses only valid package-manager enums", () => {
        const strategies = plugin.getInstallStrategies();
        for (const strategy of strategies) {
          if (strategy.kind === "package-manager") {
            expect(validManagers).toContain(strategy.manager);
          }
        }
      });

      it("has valid structured commands on all package-manager strategies", () => {
        const strategies = plugin.getInstallStrategies();
        for (const strategy of strategies) {
          if (strategy.kind === "package-manager") {
            expect(strategy.command).toBeDefined();
            expect(typeof strategy.command.file).toBe("string");
            expect(strategy.command.file.length).toBeGreaterThan(0);
            expect(Array.isArray(strategy.command.args)).toBe(true);
          }
        }
      });

      it("resolves to a hint on every common environment", () => {
        const strategies = plugin.getInstallStrategies();
        for (const [name, env] of Object.entries(environments)) {
          const hints = resolveInstallHints(strategies, env);
          expect(hints.length, `no hint for ${plugin.id} on ${name}`).toBeGreaterThan(0);
          expect(hints[0]?.label.length, `empty label for ${plugin.id} on ${name}`).toBeGreaterThan(0);
        }
      });

      it("never shows a wrong-OS command (macOS env does not get winget/choco/scoop)", () => {
        const strategies = plugin.getInstallStrategies();
        const strategy = selectInstallStrategy(strategies, environments.macos);
        if (strategy && strategy.kind === "package-manager") {
          expect(["winget", "choco", "scoop"]).not.toContain(strategy.manager);
        }
      });

      it("never shows a wrong-OS command (Linux env does not get winget/choco/scoop)", () => {
        const strategies = plugin.getInstallStrategies();
        const strategy = selectInstallStrategy(strategies, environments.ubuntu);
        if (strategy && strategy.kind === "package-manager") {
          expect(["winget", "choco", "scoop"]).not.toContain(strategy.manager);
        }
      });

      it("never shows a wrong-OS command (Windows env does not get brew/apt/dnf/pacman/zypper/apk)", () => {
        const strategies = plugin.getInstallStrategies();
        const strategy = selectInstallStrategy(strategies, environments.windows);
        if (strategy && strategy.kind === "package-manager") {
          expect(["brew", "apt", "dnf", "yum", "pacman", "zypper", "apk"]).not.toContain(strategy.manager);
        }
      });

      it("never shows a wrong-OS command (BSD env does not get winget/choco/scoop/apt/dnf/pacman)", () => {
        const strategies = plugin.getInstallStrategies();
        const strategy = selectInstallStrategy(strategies, environments.freebsd);
        if (strategy && strategy.kind === "package-manager") {
          expect(["winget", "choco", "scoop", "apt", "dnf", "yum", "pacman", "zypper"]).not.toContain(strategy.manager);
        }
      });

      if (plugin.getUpdateStrategies) {
        it("has update strategies that include a manual fallback", () => {
          const strategies = plugin.getUpdateStrategies!();
          const manual = strategies.find((s) => s.kind === "manual");
          expect(manual).toBeDefined();
        });

        it("has valid structured commands on update strategies", () => {
          const strategies = plugin.getUpdateStrategies!();
          for (const strategy of strategies) {
            if (strategy.kind === "package-manager") {
              expect(strategy.command).toBeDefined();
              expect(typeof strategy.command.file).toBe("string");
              expect(strategy.command.file.length).toBeGreaterThan(0);
              expect(Array.isArray(strategy.command.args)).toBe(true);
            }
          }
        });
      }
    });
  }
});

describe("environment-specific strategy resolution", () => {
  it("every plugin resolves to manual when no package manager is detected", () => {
    for (const plugin of builtinPlugins) {
      const hints = resolveInstallHints(plugin.getInstallStrategies(), environments.empty);
      expect(hints[0]?.kind, `${plugin.id} should give manual on empty env`).toBe("manual");
    }
  });

  it("every plugin resolves to manual on unknown Linux with no matching managers", () => {
    for (const plugin of builtinPlugins) {
      const hints = resolveInstallHints(plugin.getInstallStrategies(), environments.unknownLinux);
      expect(hints.length, `${plugin.id} should have a hint on unknown Linux`).toBeGreaterThan(0);
    }
  });
});

describe("OS scoping on strategies", () => {
  it("Windows-only strategies (winget/choco/scoop) do not resolve on macOS", () => {
    for (const plugin of builtinPlugins) {
      const strategies = plugin.getInstallStrategies();
      const winOnly = strategies.filter(
        (s) => s.kind === "package-manager" && ["winget", "choco", "scoop"].includes(s.manager) && s.os?.includes("windows") && !s.os?.includes("macos")
      );
      for (const s of winOnly) {
        if (s.kind === "package-manager") {
          const env: RuntimeEnvironment = { os: "macos", packageManagers: [s.manager] };
          const match = selectInstallStrategy([s], env);
          expect(match, `${plugin.id}: Windows-only ${s.manager} should not match macOS`).toBeNull();
        }
      }
    }
  });

  it("macOS/Linux-only strategies do not resolve on Windows", () => {
    for (const plugin of builtinPlugins) {
      const strategies = plugin.getInstallStrategies();
      const unixOnly = strategies.filter(
        (s) => s.kind === "package-manager" && s.os && s.os.some((o) => o === "macos" || o === "linux") && !s.os.includes("windows")
      );
      for (const s of unixOnly) {
        if (s.kind === "package-manager") {
          const env: RuntimeEnvironment = { os: "windows", packageManagers: [s.manager] };
          const match = selectInstallStrategy([s], env);
          expect(match, `${plugin.id}: Unix-only ${s.manager} should not match Windows`).toBeNull();
        }
      }
    }
  });
});
