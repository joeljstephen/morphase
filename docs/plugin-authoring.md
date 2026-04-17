# Plugin Authoring

Morphase plugins wrap one backend tool at a time. A plugin says what a tool can do, how to detect it, how to verify it, how to install it, and how to build a runnable command for a normalized request.

Builtin plugins live in `packages/plugins/<plugin>/src/index.ts`.

## What belongs in a plugin

A plugin is a good fit for Morphase when it wraps a real backend with:

- stable command-line behavior,
- useful routes for the main CLI,
- honest install guidance, and
- predictable enough output to validate.

Morphase is CLI-first and local-first. Prefer backends that work directly on the user's machine. Network-backed plugins are fine when the network requirement is explicit in the capability metadata.

## Plugin contract

Every plugin implements `MorphasePlugin`:

```ts
interface MorphasePlugin {
  id: string;
  name: string;
  priority: number;
  minimumVersion?: string;
  optional?: boolean;
  commonProblems?: string[];

  capabilities(): Capability[];
  detect(platform: Platform): Promise<DetectionResult>;
  verify(platform: Platform): Promise<VerificationResult>;
  getInstallStrategies(): InstallStrategy[];
  getUpdateStrategies?(): InstallStrategy[];
  plan(request: PlanRequest): Promise<ExecutionPlan | null>;
  explain(request: PlanRequest): Promise<string>;
}
```

### Required fields

- `id`: stable backend ID used by `--backend`, doctor output, and logs
- `name`: human-readable label
- `priority`: tie-break hint when candidates score similarly
- `minimumVersion`: optional semver floor
- `optional`: marks a backend as useful but not expected for every install
- `commonProblems`: short backend caveats shown in diagnostics

## Capabilities

Capabilities describe what the backend can do, not how the CLI spells the route.

```ts
type Capability = {
  kind: "convert" | "extract" | "fetch" | "transform";
  from: ResourceKind | null;
  to: ResourceKind | null;
  operation?: string;
  quality: "high" | "medium" | "best_effort";
  offline: boolean;
  platforms: Platform[];
  notes?: string[];
};
```

Examples:

- `pandoc` uses `kind: "convert"` for `markdown -> docx`
- `trafilatura` uses `kind: "fetch"` for `url -> markdown`
- `jpegoptim` uses `kind: "transform"` with `operation: "compress"`

Rules:

- Keep capability claims narrow and accurate.
- Use `quality` honestly.
- Use `offline: false` when the backend requires network access.
- Limit `platforms` to environments where the backend is actually supported.

## Detection and verification

### `detect(platform)`

Detection answers: "is this tool present?"

Typical result:

```ts
{ installed: true, version: "3.9.0", command: "pandoc" }
```

or

```ts
{ installed: false, reason: "None of the expected commands were found: pandoc" }
```

### `verify(platform)`

Verification answers: "is this installed tool ready for the routes it claims?"

Use it for:

- minimum-version checks
- delegate availability
- companion tool requirements
- route-specific warnings

Examples in the builtin plugins:

- `imagemagick` warns when HEIC or WebP delegate support is missing
- `ytdlp` warns when `ffmpeg` is missing for MP3 extraction
- `poppler` warns when only part of the toolchain is present

Helpers:

- `detectBinary(commands, versionArgs?)`
- `verifyBinary(commands, args?, minimumVersion?)`
- `detectFirstAvailableCommand(commands, versionArgs?)`

## Install and update strategies

Morphase resolves backend install guidance from structured strategy objects rather than hardcoded per-OS text.

### Strategy types

```ts
type PackageManagerInstallStrategy = {
  kind: "package-manager";
  manager: PackageManager;
  command: { file: string; args: string[] };
  os?: SupportedOS[];
  distros?: LinuxDistro[];
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

### Prefer the shared builders

Builtin plugins should normally use:

- `buildInstallStrategies(...)`
- `buildUpdateStrategies(...)`

Example:

```ts
const installStrategies = buildInstallStrategies(
  {
    brew: "pandoc",
    winget: "JohnMacFarlane.Pandoc",
    choco: "pandoc",
    scoop: "pandoc",
    apt: "pandoc",
    dnf: "pandoc",
    yum: "pandoc",
    pacman: "pandoc",
    zypper: "pandoc",
    nix: "pandoc"
  },
  {
    label: "Install Pandoc manually",
    url: "https://pandoc.org/installing.html"
  }
);
```

The builders provide:

- structured commands instead of shell strings
- exact WinGet command shapes such as `winget install -e --id ...`
- automatic OS scoping for manager families
- Windows-specific `py -m pip ...` handling for `pip`
- a required manual fallback appended automatically

Current default manager scoping from the shared helpers:

| Manager family | Default scope |
| --- | --- |
| `winget`, `choco`, `scoop` | Windows |
| `apt`, `dnf`, `yum`, `pacman`, `zypper`, `apk` | Linux |
| `nix` | macOS + Linux |
| `pkg` | BSD |

`brew`, `pip`, `pipx`, and `npm` are intentionally not globally OS-scoped because they can appear in more than one environment.

### Authoring guidance

- Prefer accurate partial coverage over guessed commands.
- Omit a manager entirely if you cannot verify the package name.
- Put backend-specific caveats in `notes`.
- Always keep the manual fallback honest and useful.
- Use `getUpdateStrategies()` when update behavior differs from install behavior.

## Planning

`plan(request)` receives a normalized `PlanRequest`:

```ts
type PlanRequest = {
  input: string | string[];
  from?: ResourceKind;
  to?: ResourceKind;
  operation?: string;
  output?: string;
  options: Record<string, unknown>;
  platform: Platform;
  offlineOnly: boolean;
  route: Route;
};
```

Return an `ExecutionPlan` or `null`.

Return `null` when:

- the route is not actually supported by this plugin,
- the request shape is invalid for the backend,
- a required companion binary is missing, or
- the backend cannot safely produce the requested output.

Do not throw for ordinary route mismatch.

Useful `ExecutionPlan` fields:

- `command`, `args`: passed directly to `execa`
- `expectedOutputs`: files the executor should validate
- `outputMapping`: rename backend-generated files to the user-requested path
- `stdoutFile`: persist stdout to a file
- `tempDirs`: directories the executor should clean up later
- `collectFromDir`: gather outputs from a directory when filenames are backend-generated

## `explain(request)`

`explain()` should describe what the backend will do in user-facing terms.

Good explanations:

- mention the backend's role for that route
- mention fidelity or caveats when relevant
- stay short and concrete

Avoid vague text such as "this is the default backend" without saying why that matters.

## SDK and helper functions

From `@morphase/plugin-sdk`:

- `definePlugin(plugin)`
- `detectFirstAvailableCommand(commands, versionArgs?)`
- `packageManagerStrategy(manager, command, options?)`
- `manualInstallStrategy(label, options?)`

From `packages/plugins/src/helpers.ts`:

- `buildInstallStrategies(...)`
- `buildUpdateStrategies(...)`
- `detectBinary(...)`
- `verifyBinary(...)`
- `libreOfficeConvert(...)`
- `libreOfficeGeneratedPdf(...)`
- `whisperGeneratedTranscript(...)`
- `supportsImageMagickFormat(...)`

## Authoring rules

- Keep routing policy in the planner, not in the CLI or inside ad hoc plugin branching.
- Keep commands structured as `file + args[]`; never shell-concatenate.
- Do not mutate system state unless the user explicitly invoked an install/update flow.
- Keep backend-specific warnings and install caveats inside the plugin.
- Keep capability declarations narrower than your optimism, not broader.

## Example skeleton

```ts
import { definePlugin } from "@morphase/plugin-sdk";
import type { Capability, ExecutionPlan, MorphasePlugin, PlanRequest, VerificationResult } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  { brew: "mytool", apt: "mytool", dnf: "mytool" },
  { label: "Install MyTool manually", url: "https://example.com/mytool" }
);

const updateStrategies = buildUpdateStrategies(
  { brew: "mytool", apt: "mytool", dnf: "mytool" },
  { label: "Update MyTool manually", url: "https://example.com/mytool" }
);

export const myToolPlugin: MorphasePlugin = definePlugin({
  id: "mytool",
  name: "MyTool",
  priority: 80,
  minimumVersion: "1.0.0",

  capabilities(): Capability[] {
    return [
      {
        kind: "convert",
        from: "markdown",
        to: "txt",
        quality: "high",
        offline: true,
        platforms: ["macos", "windows", "linux"]
      }
    ];
  },

  async detect() {
    return detectBinary(["mytool"]);
  },

  async verify(): Promise<VerificationResult> {
    return verifyBinary(["mytool"], ["--version"], "1.0.0");
  },

  getInstallStrategies() {
    return installStrategies;
  },

  getUpdateStrategies() {
    return updateStrategies;
  },

  async plan(request: PlanRequest): Promise<ExecutionPlan | null> {
    if (
      request.route.kind !== "conversion" ||
      request.route.from !== "markdown" ||
      request.route.to !== "txt" ||
      typeof request.input !== "string" ||
      !request.output
    ) {
      return null;
    }

    return {
      command: "mytool",
      args: ["convert", request.input, "-o", request.output],
      expectedOutputs: [request.output]
    };
  },

  async explain() {
    return "MyTool converts Markdown to plain text.";
  }
});
```

## Adding a builtin plugin

1. Create `packages/plugins/<id>/src/index.ts`.
2. Implement `MorphasePlugin` with `definePlugin(...)`.
3. Export it from `packages/plugins/src/index.ts` and add it to `builtinPlugins`.
4. Add or update tests for:
   - capabilities
   - install/update strategies
   - route planning
   - any backend-specific invariants
5. Run:

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
```

Out-of-tree plugins are not automatically loaded by the CLI today, so builtin additions should be deliberate and broadly useful.
