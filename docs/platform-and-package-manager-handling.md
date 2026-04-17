# Platform And Package Manager Handling

Morphase does not bundle backend binaries. When a backend is missing, it detects the current runtime environment, matches that environment against the plugin's declared install or update strategies, and prints the most accurate guidance it can support.

The guiding rule is simple: Morphase should never guess a package-manager command for the wrong machine.

## Runtime Environment Detection

### Operating system

`packages/engine/src/platform/platform.ts` maps `process.platform` to one of:

- `macos`
- `windows`
- `linux`
- `bsd`

`freebsd`, `openbsd`, and `netbsd` are reported as `bsd`, with a separate `bsdFlavor` field for more specific reporting.

### Linux distro

On Linux, Morphase reads `/etc/os-release` and normalizes `ID` plus `ID_LIKE` into:

- `ubuntu`
- `debian`
- `fedora`
- `rhel`
- `arch`
- `manjaro`
- `opensuse`
- `alpine`
- `nixos`
- `unknown`

Direct `ID` matches win first. If there is no direct match, `ID_LIKE` is used to recognize families such as:

- `rhel`, `centos`, `rocky`, `almalinux` -> `rhel`
- `suse`, `opensuse`, `opensuse-tumbleweed`, `opensuse-leap` -> `opensuse`
- `arch` -> `arch`

If `/etc/os-release` is unavailable or unrecognized, Morphase falls back to `unknown`.

### Package-manager probing

Morphase probes supported package managers by running version commands. Some managers have multiple probes so common real-world setups still resolve cleanly:

- `apt`: tries `apt-get` and `apt`
- `pip`: tries `pip`, `python3 -m pip`, `python -m pip`, and `py -m pip`
- `pipx`: tries `pipx`, `python3 -m pipx`, `python -m pipx`, and `py -m pipx`
- `nix`: tries `nix` and `nix-env`

Supported managers today are:

- `brew`
- `winget`
- `choco`
- `scoop`
- `apt`
- `dnf`
- `yum`
- `pacman`
- `zypper`
- `apk`
- `nix`
- `pkg`
- `pip`
- `pipx`
- `npm`

Detection order matters because the first detected compatible manager becomes the preferred install path.

| Environment | Priority order |
| --- | --- |
| macOS | `brew`, `nix`, `pipx`, `pip`, `npm` |
| Windows | `winget`, `choco`, `scoop`, `pipx`, `pip`, `npm` |
| Ubuntu / Debian | `apt`, `brew`, `pipx`, `pip`, `npm`, `dnf`, `yum`, `pacman`, `zypper`, `apk` |
| Fedora / RHEL | `dnf`, `yum`, `brew`, `pipx`, `pip`, `npm`, `apt`, `pacman`, `zypper`, `apk` |
| Arch / Manjaro | `pacman`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `zypper`, `apk` |
| openSUSE | `zypper`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `apk` |
| Alpine | `apk`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `zypper` |
| NixOS | `nix`, `brew`, `pipx`, `pip`, `npm`, `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk` |
| BSD | `pkg`, `brew`, `pipx`, `pip`, `npm` |
| Unknown Linux | `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk`, `nix`, `brew`, `pipx`, `pip`, `npm` |

## Install And Update Strategies

Plugins declare install guidance as structured `InstallStrategy` objects instead of hardcoded CLI strings.

There are two strategy kinds:

- `package-manager`
- `manual`

Package-manager strategies use `StructuredCommand`:

```ts
type StructuredCommand = {
  file: string;
  args: string[];
};
```

That matters for two reasons:

- the CLI can render the exact command for the user
- delegated `backend install --run` and `backend update --run` can execute the command without shell interpolation

Most plugins use the shared helpers in `packages/plugins/src/helpers.ts`:

- `buildInstallStrategies(...)`
- `buildUpdateStrategies(...)`

Those helpers centralize command shapes such as:

- `winget install -e --id <id>`
- `sudo apt-get install <pkg>`
- `sudo apt-get install --only-upgrade <pkg>`
- `nix profile install nixpkgs#<pkg>`
- `npm i -g <pkg>`

They also apply default OS scoping automatically:

- `winget`, `choco`, `scoop` -> Windows only
- `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk` -> Linux only
- `pkg` -> BSD only
- `nix` -> macOS and Linux

`pip` is handled specially:

- macOS and Linux use `pip install ...`
- Windows uses `py -m pip install ...`

Every built-in plugin is expected to include a manual fallback. That fallback is part of the supported UX, not an error case.

## Strategy Resolution

Install hint resolution lives in `packages/shared/src/utils/install.ts`.

The flow is:

1. Filter strategies to the current OS and distro.
2. Keep only package-manager strategies whose `manager` appears in the detected environment.
3. Pick the first matching manager according to the detected manager order.
4. If nothing matches, pick the most specific manual strategy.

`resolveInstallHints(...)` then formats that into user-facing hints:

- when a package-manager strategy matches, Morphase returns the command plus the best manual fallback
- when no compatible package-manager strategy matches, Morphase returns manual guidance with an explanation of why
- when no supported package manager was detected at all, Morphase says so directly instead of inventing a command

This is how Morphase avoids showing `winget` on Linux, `apt` on macOS, or a guessed fallback on unsupported environments.

## CLI Delegation Rules

`morphase backend install <id> --run` and `morphase backend update <id> --run` are intentionally gated.

Morphase will only delegate when all of these are true:

1. the selected hint is a package-manager hint
2. the hint includes a structured command
3. `allowPackageManagerDelegation` is enabled in `~/.morphase/config.json`
4. the terminal is interactive

Manual fallbacks are never auto-run.

If delegation is disabled or impossible, the CLI prints the command or manual guidance instead.

## Support Model

Morphase can work broadly if the required backends are installed. What varies by environment is the quality of install guidance.

- Best supported: environments with common package managers and explicit plugin strategies
- Partial coverage: environments Morphase can identify, but where a given backend only has manual guidance
- Manual fallback: environments with no detected supported package manager or no compatible declared strategy

That support model is deliberate. Plugin authors should prefer accurate partial coverage over guessed commands.

## Edge Cases Worth Knowing

- WSL is treated as Linux and gets Linux package-manager hints.
- Unknown Linux distros still get a deterministic package-manager priority list.
- BSD systems prefer `pkg`, but can still use `brew`, `pipx`, `pip`, or `npm` if those are installed and a plugin declares them.
- Update strategies intentionally skip `nix` in the shared helper because `nix profile upgrade` is not a package-name drop-in replacement for the install model used here.

## Relevant Files

| Concern | File |
| --- | --- |
| Platform, distro, and manager detection | `packages/engine/src/platform/platform.ts` |
| Install hint selection and formatting | `packages/shared/src/utils/install.ts` |
| Install strategy and runtime types | `packages/shared/src/types/index.ts` |
| Shared strategy builders | `packages/plugins/src/helpers.ts` |
| Plugin SDK helpers | `packages/plugin-sdk/src/index.ts` |
| CLI install/update UX | `apps/cli/src/index.ts` |
| CLI doctor formatting | `apps/cli/src/format.ts` |
