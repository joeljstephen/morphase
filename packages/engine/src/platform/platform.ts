import fs from "node:fs/promises";
import os from "node:os";

import { runCommandCapture, type LinuxDistro, type PackageManager, type RuntimeEnvironment, type SupportedOS } from "@morphase/shared";

type CommandRunner = typeof runCommandCapture;

type CommandProbe = {
  command: string;
  args?: string[];
};

const managerProbes: Record<PackageManager, CommandProbe[]> = {
  brew: [{ command: "brew", args: ["--version"] }],
  winget: [{ command: "winget", args: ["--version"] }],
  choco: [{ command: "choco", args: ["--version"] }],
  scoop: [{ command: "scoop", args: ["--version"] }],
  apt: [
    { command: "apt-get", args: ["--version"] },
    { command: "apt", args: ["--version"] }
  ],
  dnf: [{ command: "dnf", args: ["--version"] }],
  yum: [{ command: "yum", args: ["--version"] }],
  pacman: [{ command: "pacman", args: ["--version"] }],
  zypper: [{ command: "zypper", args: ["--version"] }],
  apk: [{ command: "apk", args: ["--version"] }],
  pip: [
    { command: "pip", args: ["--version"] },
    { command: "python3", args: ["-m", "pip", "--version"] },
    { command: "python", args: ["-m", "pip", "--version"] },
    { command: "py", args: ["-m", "pip", "--version"] }
  ],
  pipx: [
    { command: "pipx", args: ["--version"] },
    { command: "python3", args: ["-m", "pipx", "--version"] },
    { command: "python", args: ["-m", "pipx", "--version"] },
    { command: "py", args: ["-m", "pipx", "--version"] }
  ],
  nix: [
    { command: "nix", args: ["--version"] },
    { command: "nix-env", args: ["--version"] }
  ],
  npm: [{ command: "npm", args: ["--version"] }]
};

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

function parseOsRelease(content: string): Record<string, string> {
  const entries = content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator === -1) {
        return null;
      }

      const key = line.slice(0, separator);
      const value = stripQuotes(line.slice(separator + 1));
      return [key, value] as const;
    })
    .filter((entry): entry is readonly [string, string] => entry !== null);

  return Object.fromEntries(entries);
}

function normalizeLinuxDistro(id?: string, idLike?: string): LinuxDistro {
  const direct = (id ?? "").toLowerCase();
  const related = (idLike ?? "").toLowerCase().split(/\s+/).filter(Boolean);
  const candidates = [direct, ...related];

  if (direct === "manjaro") return "manjaro";
  if (direct === "ubuntu") return "ubuntu";
  if (direct === "debian") return "debian";
  if (direct === "fedora") return "fedora";
  if (direct === "alpine") return "alpine";
  if (direct === "nixos") return "nixos";

  if (candidates.some((value) => value === "opensuse" || value === "suse" || value === "opensuse-tumbleweed" || value === "opensuse-leap")) {
    return "opensuse";
  }

  if (candidates.some((value) => value === "rhel" || value === "centos" || value === "rocky" || value === "almalinux")) {
    return "rhel";
  }

  if (candidates.some((value) => value === "arch")) {
    return "arch";
  }

  if (candidates.some((value) => value === "ubuntu")) {
    return "ubuntu";
  }

  if (candidates.some((value) => value === "debian")) {
    return "debian";
  }

  if (candidates.some((value) => value === "fedora")) {
    return "fedora";
  }

  if (candidates.some((value) => value === "rhel")) {
    return "rhel";
  }

  if (candidates.some((value) => value === "alpine")) {
    return "alpine";
  }

  if (candidates.some((value) => value === "nixos")) {
    return "nixos";
  }

  return "unknown";
}

function packageManagerPriority(osName: SupportedOS, distro?: LinuxDistro): PackageManager[] {
  if (osName === "macos") {
    return ["brew", "pipx", "pip", "npm"];
  }

  if (osName === "windows") {
    return ["winget", "choco", "scoop", "pipx", "pip", "npm"];
  }

  switch (distro) {
    case "ubuntu":
    case "debian":
      return ["apt", "brew", "pipx", "pip", "npm", "dnf", "yum", "pacman", "zypper", "apk"];
    case "fedora":
      return ["dnf", "yum", "brew", "pipx", "pip", "npm", "apt", "pacman", "zypper", "apk"];
    case "rhel":
      return ["dnf", "yum", "brew", "pipx", "pip", "npm", "apt", "pacman", "zypper", "apk"];
    case "arch":
    case "manjaro":
      return ["pacman", "brew", "pipx", "pip", "npm", "apt", "dnf", "yum", "zypper", "apk"];
    case "opensuse":
      return ["zypper", "brew", "pipx", "pip", "npm", "apt", "dnf", "yum", "pacman", "apk"];
    case "alpine":
      return ["apk", "brew", "pipx", "pip", "npm", "apt", "dnf", "yum", "pacman", "zypper"];
    case "nixos":
      return ["nix", "brew", "pipx", "pip", "npm", "apt", "dnf", "yum", "pacman", "zypper", "apk"];
    default:
      return ["apt", "dnf", "yum", "pacman", "zypper", "apk", "nix", "brew", "pipx", "pip", "npm"];
  }
}

async function commandProbeSucceeded(
  probe: CommandProbe,
  commandRunner: CommandRunner
): Promise<boolean> {
  const result = await commandRunner(probe.command, probe.args ?? []);
  return result.ok;
}

export function detectPlatform(): SupportedOS {
  switch (process.platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

export async function detectLinuxDistro(options: {
  osReleasePath?: string;
} = {}): Promise<LinuxDistro> {
  try {
    const content = await fs.readFile(options.osReleasePath ?? "/etc/os-release", "utf8");
    const parsed = parseOsRelease(content);
    return normalizeLinuxDistro(parsed.ID, parsed.ID_LIKE);
  } catch {
    return "unknown";
  }
}

export async function detectPackageManagers(options: {
  os?: SupportedOS;
  distro?: LinuxDistro;
  commandRunner?: CommandRunner;
} = {}): Promise<PackageManager[]> {
  const osName = options.os ?? detectPlatform();
  const distro = osName === "linux" ? options.distro ?? await detectLinuxDistro() : undefined;
  const commandRunner = options.commandRunner ?? runCommandCapture;
  const managers = packageManagerPriority(osName, distro);
  const detected: PackageManager[] = [];

  for (const manager of managers) {
    const probes = managerProbes[manager] ?? [];
    for (const probe of probes) {
      if (await commandProbeSucceeded(probe, commandRunner)) {
        detected.push(manager);
        break;
      }
    }
  }

  return detected;
}

export async function detectRuntimeEnvironment(options: {
  os?: SupportedOS;
  osReleasePath?: string;
  commandRunner?: CommandRunner;
} = {}): Promise<RuntimeEnvironment> {
  const osName = options.os ?? detectPlatform();
  const distro = osName === "linux" ? await detectLinuxDistro({ osReleasePath: options.osReleasePath }) : undefined;
  const packageManagers = await detectPackageManagers({
    os: osName,
    distro,
    commandRunner: options.commandRunner
  });

  return {
    os: osName,
    distro,
    packageManagers
  };
}

export async function detectPackageManager(
  platform: SupportedOS = detectPlatform()
): Promise<PackageManager | "manual"> {
  const environment = await detectRuntimeEnvironment({ os: platform });
  return environment.packageManagers[0] ?? "manual";
}

export function homeDirectory(): string {
  return os.homedir();
}
