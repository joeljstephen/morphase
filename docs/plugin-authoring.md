# Plugin Authoring

Morphase plugins isolate backend-specific behavior. A plugin describes what one external tool can do, how to detect it, and how to build a command line for a given request. The engine owns routing and execution; plugins just declare capabilities and produce plans.

Builtin plugins live in `packages/plugins/<plugin>/src/index.ts`.

## Official vs community plugins

Not every plugin belongs in the main repo. As a rough guide:

**A plugin is a good fit for this repo if it:**

- Wraps a widely available, stable, open-source tool (FFmpeg, Pandoc, ImageMagick, etc.).
- Is installable through at least one common package manager or has a clear manual install path.
- Covers a route the core Morphase audience will actually use.
- Has predictable output and does not require service accounts, API keys, or network configuration to function.
- Is reasonably behaved across macOS, Windows, and Linux, or clearly scopes itself to a subset.

**A plugin is usually better as a community or out-of-tree plugin if it:**

- Talks to a paid or proprietary service.
- Requires user credentials, API keys, or OAuth.
- Targets a niche format or workflow most users won't need.
- Has heavy or platform-specific install requirements that can't be expressed as a few install strategies plus a clear manual fallback.
- Is experimental or changes often.

Community plugins will eventually be loadable out-of-tree via the plugin SDK. In the meantime, if you're unsure whether your plugin fits the main repo, open a discussion or draft PR and we'll figure it out together.

## Plugin contract

Every plugin implements the `MorphasePlugin` interface:

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

- **`id`** — Unique identifier used in routing, CLI flags (`--backend <id>`), and logs (e.g. `"ffmpeg"`).
- **`name`** — Human-readable display name (e.g. `"FFmpeg"`).
- **`priority`** — Default ordering hint (0–100). Higher wins when scores tie.
- **`minimumVersion`** — Semver string. Lower detected versions get a score penalty.
- **`optional`** — `true` for opt-in plugins (e.g. `ytdlp`, `whisper`, `summarize`).
- **`commonProblems`** — Known issues surfaced by `morphase doctor`.

### Required methods

#### `capabilities()`

Returns the set of routes this plugin can handle:

```ts
{
  kind: "conversion" | "transform" | "fetch" | "extract";
  from: ResourceKind;
  to?: ResourceKind;           // omitted for operations like compress / merge
  operation?: string;          // for transform / extract operations
  quality: "high" | "medium" | "best_effort";
  offline: boolean;
  platforms: Platform[];
}
```

The planner uses these to match a route to candidate plugins via `Registry.findCandidates()`.

#### `detect(platform)`

Checks whether the external tool is installed:

```ts
{ installed: true; version?: string; command: string }
| { installed: false; reason?: string }
```

Use `detectBinary()` from `packages/plugins/src/helpers.ts`, or `detectFirstAvailableCommand()` from `@morphase/plugin-sdk`, to probe for binaries.

#### `verify(platform)`

A deeper health check beyond detection:

```ts
{ ok: boolean; issues?: string[]; warnings?: string[] }
```

Good uses: checking delegate support (e.g. ImageMagick's HEIC/WebP delegates), dependency availability (e.g. yt-dlp needing ffmpeg for MP3), or version-specific bugs.

#### `getInstallStrategies()` / `getUpdateStrategies()`

Plugins declare install strategies rather than one hardcoded command per OS. Morphase resolves these against the detected runtime environment and falls back to manual guidance when no compatible package manager matches.

**Use `buildInstallStrategies` and `buildUpdateStrategies`** from `packages/plugins/src/helpers.ts`. These take a package-name map and auto-generate `StructuredCommand` objects from templates:

```ts
import { buildInstallStrategies, buildUpdateStrategies } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  {
    brew: "ffmpeg",
    winget: "Gyan.FFmpeg",
    choco: "ffmpeg",
    scoop: "ffmpeg",
    apt: "ffmpeg",
    dnf: "ffmpeg",
    yum: "ffmpeg",
    pacman: "ffmpeg",
    zypper: "ffmpeg",
    nix: "ffmpeg"
  },
  {
    label: "Install FFmpeg manually",
    url: "https://www.ffmpeg.org/download.html"
  }
);

const updateStrategies = buildUpdateStrategies(
  {
    brew: "ffmpeg",
    apt: "ffmpeg",
    /* ... same managers, nix is auto-excluded from updates */
  },
  { label: "Update FFmpeg manually" }
);
```

Key details:

- Each key in the map is a `PackageManager` enum value. The value is the package name as a string.
- Commands are generated as `StructuredCommand = { file: string; args: string[] }` — never as raw shell strings.
- For `pip`, two OS-scoped strategies are auto-generated: `pip install X` for macOS/Linux and `py -m pip install X` for Windows.
- `buildUpdateStrategies` automatically skips `nix` (since `nix profile upgrade` uses indices, not package names).
- Every call appends a manual fallback strategy at the end.
- If you need a custom `StructuredCommand` instead of a template, pass the object directly: `{ file: "custom", args: ["install", "x"] }`.

**Important:** Every plugin must include at least one manual fallback. The centralized builders handle this automatically, but if you construct strategies manually, always include a `manualInstallStrategy(...)`.

#### `plan(request)`

Builds an `ExecutionPlan` for the given request, or returns `null` if this plugin can't handle it:

```ts
{
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  tempDirs?: string[];
  expectedOutputs?: string[];
  outputMapping?: { source: string; target: string }[];
  stdoutFile?: string;
  timeoutMs?: number;
  notes?: string[];
  collectFromDir?: string;
}
```

Key fields:

- **`command`** / **`args`** — Passed directly to `execa`. Never shell-concatenate.
- **`outputMapping`** — For tools that generate output under their own filenames (e.g. LibreOffice). The executor renames those files to the user's expected path.
- **`stdoutFile`** — Write stdout to a file instead of discarding it (used by `trafilatura`, `summarize`).
- **`tempDirs`** — Temp directories the executor will clean up after execution.
- **`collectFromDir`** — Directory to scan for output files (used by `poppler` for multi-page rendering).

#### `explain(request)`

Returns a human-readable explanation of why this plugin was chosen and what it will do. Shown by `morphase explain`.

## Plugin SDK

`@morphase/plugin-sdk` provides the minimum helpers to author a plugin:

- **`definePlugin(plugin)`** — Identity function that enforces the `MorphasePlugin` type at compile time.
- **`detectFirstAvailableCommand(commands, versionArgs)`** — Tries multiple command names and returns the first that responds.
- **`packageManagerStrategy(manager, command, options?)`** — Creates a package-manager install strategy with a `StructuredCommand`.
- **`manualInstallStrategy(label, options?)`** — Creates a manual install fallback strategy.

## Shared plugin helpers

`packages/plugins/src/helpers.ts` adds conveniences used by most builtin plugins:

- **`buildInstallStrategies(packages, manual, sharedNotes?)`** — Generate install strategies from a package-name map.
- **`buildUpdateStrategies(packages, manual, sharedNotes?)`** — Generate update strategies from a package-name map.
- **`detectBinary(commands, versionArgs?)`** — `detectFirstAvailableCommand` plus semver parsing.
- **`verifyBinary(commands, args?, minimumVersion?)`** — Binary verification with optional version check.
- **`libreOfficeConvert(input, output, format)`** — Builds a LibreOffice execution plan with output mapping.
- **`whisperGeneratedTranscript(input, output)`** — Builds a Whisper execution plan with output mapping.

## Plugin rules

- Keep routing decisions out of the CLI.
- Keep global routing decisions out of plugins — plugins declare capabilities; the planner decides.
- Don't mutate system state without explicit user intent.
- Keep backend-specific quirks, warnings, and install metadata inside the plugin.
- Always pass commands and args as separate arrays — never shell-concatenate, to prevent injection.
- Return `null` from `plan()` for requests this plugin can't handle; don't throw.
- Always include a manual fallback in install strategies.
- Use `buildInstallStrategies` / `buildUpdateStrategies` instead of manual strategy construction.
- Prefer accurate partial coverage over guessed commands. If a tool isn't reliably available through a package manager, omit that manager rather than inventing a package name.

## Example skeleton

```ts
import { definePlugin } from "@morphase/plugin-sdk";
import type { MorphasePlugin, Capability, PlanRequest, ExecutionPlan, Platform, DetectionResult, VerificationResult } from "@morphase/shared";

import { buildInstallStrategies, buildUpdateStrategies, detectBinary, verifyBinary } from "../../src/helpers.js";

const installStrategies = buildInstallStrategies(
  { brew: "mytool", apt: "mytool", dnf: "mytool" },
  { label: "Install MyTool manually", url: "https://example.com/mytool" }
);

const updateStrategies = buildUpdateStrategies(
  { brew: "mytool", apt: "mytool", dnf: "mytool" },
  { label: "Update MyTool manually" }
);

export const myPlugin: MorphasePlugin = definePlugin({
  id: "mytool",
  name: "MyTool",
  priority: 80,
  minimumVersion: "1.0.0",
  commonProblems: ["Some known issue"],

  capabilities(): Capability[] {
    return [
      { kind: "conversion", from: "csv", to: "json", quality: "high", offline: true, platforms: ["macos", "windows", "linux"] },
    ];
  },

  async detect(platform: Platform): Promise<DetectionResult> {
    return detectBinary(["mytool"]);
  },

  async verify(platform: Platform): Promise<VerificationResult> {
    return verifyBinary(["mytool"]);
  },

  getInstallStrategies() {
    return installStrategies;
  },

  getUpdateStrategies() {
    return updateStrategies;
  },

  async plan(request: PlanRequest): Promise<ExecutionPlan | null> {
    if (request.route.kind !== "conversion") return null;
    return {
      command: "mytool",
      args: ["convert", String(request.input), "-o", request.output!],
      expectedOutputs: [request.output!],
    };
  },

  async explain(request: PlanRequest): Promise<string> {
    return "Uses MyTool for high-quality CSV to JSON conversion.";
  },
});
```

## Adding a new plugin

1. Create `packages/plugins/<id>/src/index.ts`.
2. Implement the `MorphasePlugin` interface using `definePlugin()`.
3. Use `buildInstallStrategies` with accurate package names for supported managers and an honest manual fallback.
4. Export the plugin from `packages/plugins/src/index.ts` and add it to the `builtinPlugins` array.
5. Add tests in `tests/plugins.test.ts` that verify metadata and capabilities.
6. Run `pnpm build && pnpm typecheck && pnpm test`.
7. Open a PR. Include a brief note on which route(s) it adds and why the plugin belongs in the main repo (see the [Official vs community](#official-vs-community-plugins) section above).
