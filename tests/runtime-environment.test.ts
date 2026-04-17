import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { detectLinuxDistro, detectPackageManagers, detectRuntimeEnvironment } from "../packages/engine/src/platform/platform.js";

const tempPaths: string[] = [];

async function writeOsRelease(contents: string): Promise<string> {
  const file = path.join(os.tmpdir(), `morphase-os-release-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  await fs.writeFile(file, contents, "utf8");
  tempPaths.push(file);
  return file;
}

function fakeRunner(available: string[]) {
  return async (command: string): Promise<{
    ok: boolean;
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }> => ({
    ok: available.includes(command),
    stdout: available.includes(command) ? `${command} version` : "",
    stderr: available.includes(command) ? "" : "not found",
    exitCode: available.includes(command) ? 0 : 1
  });
}

afterEach(async () => {
  await Promise.all(tempPaths.splice(0).map((file) => fs.rm(file, { force: true })));
});

describe("runtime environment detection", () => {
  it("detects Ubuntu from /etc/os-release", async () => {
    const osReleasePath = await writeOsRelease("ID=ubuntu\nID_LIKE=debian\n");
    await expect(detectLinuxDistro({ osReleasePath })).resolves.toBe("ubuntu");
  });

  it("detects Fedora from /etc/os-release", async () => {
    const osReleasePath = await writeOsRelease("ID=fedora\nID_LIKE=\"fedora rhel\"\n");
    await expect(detectLinuxDistro({ osReleasePath })).resolves.toBe("fedora");
  });

  it("detects Manjaro before the broader arch family", async () => {
    const osReleasePath = await writeOsRelease("ID=manjaro\nID_LIKE=arch\n");
    await expect(detectLinuxDistro({ osReleasePath })).resolves.toBe("manjaro");
  });

  it("returns unknown when os-release cannot be read", async () => {
    await expect(detectLinuxDistro({ osReleasePath: "/no/such/os-release" })).resolves.toBe("unknown");
  });

  it("prefers Homebrew on macOS when brew is present", async () => {
    const managers = await detectPackageManagers({
      os: "macos",
      commandRunner: fakeRunner(["brew", "pip", "npm"])
    });

    expect(managers).toEqual(["brew", "pip", "npm"]);
  });

  it("prefers apt on Debian-family Linux", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "ubuntu",
      commandRunner: fakeRunner(["apt-get", "pipx"])
    });

    expect(managers).toEqual(["apt", "pipx"]);
  });

  it("prefers dnf on Fedora", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "fedora",
      commandRunner: fakeRunner(["dnf", "yum", "pip"])
    });

    expect(managers).toEqual(["dnf", "yum", "pip"]);
  });

  it("prefers pacman on Arch", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "arch",
      commandRunner: fakeRunner(["pacman", "brew"])
    });

    expect(managers).toEqual(["pacman", "brew"]);
  });

  it("prefers zypper on openSUSE", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "opensuse",
      commandRunner: fakeRunner(["zypper", "npm"])
    });

    expect(managers).toEqual(["zypper", "npm"]);
  });

  it("detects NixOS from /etc/os-release", async () => {
    const osReleasePath = await writeOsRelease("ID=nixos\nID_LIKE=\"\"\n");
    await expect(detectLinuxDistro({ osReleasePath })).resolves.toBe("nixos");
  });

  it("detects NixOS via ID_LIKE fallback", async () => {
    const osReleasePath = await writeOsRelease("ID=custom-nix\nID_LIKE=nixos\n");
    await expect(detectLinuxDistro({ osReleasePath })).resolves.toBe("nixos");
  });

  it("prefers nix on NixOS", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "nixos",
      commandRunner: fakeRunner(["nix", "pip"])
    });

    expect(managers).toEqual(["nix", "pip"]);
  });

  it("detects nix package manager via nix command", async () => {
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "unknown",
      commandRunner: fakeRunner(["nix", "pip"])
    });

    expect(managers).toContain("nix");
  });

  it("detects nix package manager via nix-env fallback", async () => {
    const runner = async (command: string) => ({
      ok: command === "nix-env",
      stdout: command === "nix-env" ? "nix-env (Nix) 2.24" : "",
      stderr: command !== "nix-env" ? "not found" : "",
      exitCode: command === "nix-env" ? 0 : 1
    });
    const managers = await detectPackageManagers({
      os: "linux",
      distro: "unknown",
      commandRunner: runner
    });

    expect(managers).toContain("nix");
  });

  it("builds a runtime environment with NixOS distro and nix manager", async () => {
    const osReleasePath = await writeOsRelease("ID=nixos\n");
    const environment = await detectRuntimeEnvironment({
      os: "linux",
      osReleasePath,
      commandRunner: fakeRunner(["nix", "pipx"])
    });

    expect(environment).toEqual({
      os: "linux",
      distro: "nixos",
      packageManagers: ["nix", "pipx"]
    });
  });

  it("detects Windows package managers", async () => {
    const managers = await detectPackageManagers({
      os: "windows",
      commandRunner: fakeRunner(["winget", "choco", "scoop"])
    });

    expect(managers).toEqual(["winget", "choco", "scoop"]);
  });

  it("builds a runtime environment with distro and detected managers", async () => {
    const osReleasePath = await writeOsRelease("ID=fedora\nID_LIKE=\"fedora rhel\"\n");
    const environment = await detectRuntimeEnvironment({
      os: "linux",
      osReleasePath,
      commandRunner: fakeRunner(["dnf", "pipx", "npm"])
    });

    expect(environment).toEqual({
      os: "linux",
      distro: "fedora",
      packageManagers: ["dnf", "pipx", "npm"]
    });
  });
});
