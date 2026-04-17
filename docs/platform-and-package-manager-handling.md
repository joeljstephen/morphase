# Platform and Package Manager Handling

This document describes how Morphase detects the user's operating system, Linux distribution, and available package managers — and how it uses that information to provide correct install/update hints for missing backends.

---

## Overview

Morphase does not ship its own conversion tools. It routes work to external backends like FFmpeg, Pandoc, LibreOffice, and ImageMagick. When a backend is not installed, Morphase must tell the user how to install it, using the right command for their specific environment.

The system has three layers:

1. **Runtime detection** — discover the OS, Linux distro, and available package managers
2. **Install strategy declaration** — each plugin lists strategies for every package manager it supports
3. **Strategy resolution** — at runtime, the engine picks the best strategy for the current environment

---

## 1. Runtime Detection

### 1.1 Operating System Detection

**File:** `packages/engine/src/platform/platform.ts`

```typescript
export function detectPlatform(): SupportedOS {
  switch (process.platform) {
    case "darwin":  return "macos";
    case "win32":   return "windows";
    default:        return "linux";
  }
}
```

Three values: `"macos"`, `"windows"`, `"linux"`, `"bsd"`. All non-Darwin, non-Windows, non-BSD systems (AIX, SunOS, etc.) collapse to `"linux"`. FreeBSD, OpenBSD, and NetBSD are detected as `"bsd"`.

### 1.2 Linux Distribution Detection

On Linux, Morphase reads `/etc/os-release` to identify the distribution via `ID` and `ID_LIKE` fields.

Detected distros:

| `ID` value    | Result       |
|---------------|--------------|
| `manjaro`     | `"manjaro"`  |
| `ubuntu`      | `"ubuntu"`   |
| `debian`      | `"debian"`   |
| `fedora`      | `"fedora"`   |
| `alpine`      | `"alpine"`   |
| `nixos`       | `"nixos"`    |

Fallback via `ID_LIKE`:

| Family match                                        | Result       |
|-----------------------------------------------------|--------------|
| `opensuse`, `suse`, `opensuse-tumbleweed`, `opensuse-leap` | `"opensuse"` |
| `rhel`, `centos`, `rocky`, `almalinux`              | `"rhel"`     |
| `arch`                                              | `"arch"`     |
| `nixos`                                             | `"nixos"`    |

Then broader `ID_LIKE` fallbacks: `ubuntu` → `debian` → `fedora` → `rhel` → `alpine` → `nixos`. If nothing matches: `"unknown"`.

### 1.3 Package Manager Detection

Morphase probes for available package managers by running `--version` commands.

**Supported managers:**

`brew`, `winget`, `choco`, `scoop`, `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk`, `nix`, `pkg`, `pip`, `pipx`, `npm`

Some managers have multiple probes (e.g., `pip` tries `pip --version`, then `python3 -m pip --version`, then `python -m pip --version`, then `py -m pip --version`). `nix` tries `nix --version` then `nix-env --version`.

**Detection priority (first detected = primary):**

| OS / Distro     | Priority order                                                        |
|-----------------|-----------------------------------------------------------------------|
| **macOS**       | `brew`, `pipx`, `pip`, `npm`                                          |
| **Windows**     | `winget`, `choco`, `scoop`, `pipx`, `pip`, `npm`                     |
| **Ubuntu/Debian** | `apt`, `brew`, `pipx`, `pip`, `npm`, `dnf`, `yum`, `pacman`, `zypper`, `apk` |
| **Fedora/RHEL** | `dnf`, `yum`, `brew`, `pipx`, `pip`, `npm`, `apt`, `pacman`, `zypper`, `apk` |
| **Arch/Manjaro** | `pacman`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `zypper`, `apk` |
| **openSUSE**    | `zypper`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `apk` |
| **Alpine**      | `apk`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `zypper` |
| **NixOS**       | `nix`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk` |
| **FreeBSD/OpenBSD/NetBSD** | `pkg`, `brew`, `pipx`, `pip`, `npm` |
| **Unknown Linux** | `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk`, `nix`, `brew`, `pipx`, `pip`, `npm` |

The native package manager for each distro is always first.

---

## 2. Install Strategy Declaration

### 2.1 Strategy Types

Every strategy uses `StructuredCommand = { file: string; args: string[] }` instead of raw strings. This prevents shell injection and enables direct `execa(file, args)` execution.

```typescript
type PackageManagerInstallStrategy = {
  kind: "package-manager";
  manager: PackageManager;
  command: StructuredCommand;
  os?: SupportedOS[];       // scope to specific OSes
  distros?: LinuxDistro[];  // scope to specific distros
  notes?: string[];
};

type ManualInstallStrategy = {
  kind: "manual";
  label: string;
  os?: SupportedOS[];
  distros?: LinuxDistro[];
  notes?: string[];
  url?: string;
};
```

### 2.2 Centralized Strategy Generation

Most plugins use `buildInstallStrategies()` from `packages/plugins/src/helpers.ts` to generate strategies from a package-name map:

```typescript
const installStrategies = buildInstallStrategies(
  { brew: "pandoc", winget: "JohnMacFarlane.Pandoc", apt: "pandoc", nix: "pandoc" },
  { label: "Install Pandoc manually", url: "https://pandoc.org/installing.html" }
);
```

This generates a `PackageManagerInstallStrategy` for each key with the correct template command (e.g., `{ file: "sudo", args: ["apt-get", "install", "pandoc"] }` for apt) and appends the manual fallback. For `pip`, it automatically generates two OS-scoped strategies: `pip install X` for macOS/Linux and `py -m pip install X` for Windows.

`buildUpdateStrategies()` works similarly but excludes `nix` (since `nix profile upgrade` uses indices, not package names) and uses update-specific templates (e.g., `brew upgrade`, `apt-get install --only-upgrade`).

### 2.3 Plugin Strategy Coverage

| Plugin | brew | winget | choco | scoop | apt | dnf | yum | pacman | zypper | apk | nix | pkg | pipx | pip | npm | manual |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| pandoc | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| libreoffice | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| ffmpeg | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| imagemagick | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| qpdf | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| poppler | Y | Y | Y | Y | Y | Y | Y | Y | — | — | Y | — | — | — | — | Y |
| yt-dlp | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | Y | — | Y |
| jpegoptim | Y | — | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| optipng | Y | Y | Y | Y | Y | Y | Y | Y | Y | — | Y | — | — | — | — | Y |
| trafilatura | Y | — | — | — | — | — | — | — | — | — | — | — | Y | Y | — | Y |
| markitdown | — | — | — | — | — | — | — | — | — | — | — | — | Y | Y | — | Y |
| whisper | — | — | — | — | — | — | — | — | — | — | — | — | Y | Y | — | Y |
| img2pdf | — | — | — | — | — | — | — | — | — | — | — | — | Y | Y | — | Y |
| summarize | Y | — | — | — | — | — | — | — | — | — | — | — | — | — | Y | Y |

Every plugin includes a manual fallback.

---

## 3. Strategy Resolution

### 3.1 Selection Algorithm (`selectInstallStrategy`)

**Phase 1: Find the best package-manager strategy**

1. Filter strategies that match the current environment (OS and distro scoping)
2. From those, filter to `package-manager` strategies whose `manager` is in the detected `RuntimeEnvironment.packageManagers`
3. Sort by position in the detected package managers list (first detected = highest priority)
4. Pick the first one

**Phase 2: Fall back to manual strategies**

If no package-manager strategy matched:

1. Filter to `manual` strategies matching the environment
2. Sort by specificity (+2 for OS match, +3 for distro match)
3. Pick the first one

### 3.2 Hint Resolution (`resolveInstallHints`)

Wraps `selectInstallStrategy` and converts to `InstallHint[]`:

- **Package-manager match**: Returns the command (marked `autoInstallable: true`) plus the best manual strategy as a secondary option
- **Manual-only match**: Returns one manual hint with context about why no package-manager match was found
- **No match**: Returns a single manual hint explaining no package manager was detected

---

## 4. Auto-Install Flow

Auto-install requires all of:
1. `hint.kind === "package-manager"` and `hint.autoInstallable === true`
2. `hint.structuredCommand` is present
3. `allowPackageManagerDelegation` is enabled in config
4. Terminal is interactive (`process.stdin.isTTY`)

When all conditions are met, the CLI prompts the user and runs the command via `execa(cmd.file, cmd.args, { stdio: "inherit" })`.

---

## 5. Support Tiers

Morphase takes an honest approach to install guidance:

**Well-supported** — Morphase detects the package manager and generates an accurate install command:
- macOS with Homebrew
- Ubuntu/Debian with apt
- Fedora/RHEL with dnf/yum
- Arch/Manjaro with pacman
- openSUSE with zypper
- Windows with winget/choco/scoop (where the plugin has a strategy)
- NixOS with nix profile (where the plugin has a strategy)

**Best effort** — Morphase detects the environment but the plugin may not have a strategy for the detected manager. Users get a clear manual fallback instead of a wrong command. Examples:
- Alpine with apk (only yt-dlp has an apk strategy)
- Windows for tools without native Windows packages (jpegoptim, optipng)
- Linux distros with unusual package managers

**Manual fallback only** — No package manager detected or no matching strategy. Users get a clear manual install message. This is preferable to printing a wrong command.

---

## 6. Edge Cases

- **No `/etc/os-release`**: Returns `"unknown"` distro; falls back to generic Linux priority order
- **WSL**: Detected as Linux (not Windows); uses Linux commands
- **No package managers**: Empty `packageManagers` array; always resolves to manual fallback
- **FreeBSD/OpenBSD/NetBSD**: Detected as `"bsd"` with `bsdFlavor` (e.g., `"freebsd"`). Primary package manager is `pkg`. Homebrew is probed as a fallback. Install strategies without `os` or `platforms` scoping still apply.
- **Pip on Windows**: Uses `py -m pip install X` instead of `pip install X` (OS-scoped strategies)
- **Nix update**: Excluded from update strategies; users fall back to manual

---

## 7. File Reference

| Concern | File |
|---------|------|
| OS/distro/package-manager detection | `packages/engine/src/platform/platform.ts` |
| Strategy resolution and hint formatting | `packages/shared/src/utils/install.ts` |
| Install hint and strategy types | `packages/shared/src/types/index.ts` |
| Centralized strategy generation helpers | `packages/plugins/src/helpers.ts` |
| Plugin SDK helpers | `packages/plugin-sdk/src/index.ts` |
| CLI install prompt and delegation | `apps/cli/src/index.ts` |
| CLI output formatting | `apps/cli/src/format.ts` |
