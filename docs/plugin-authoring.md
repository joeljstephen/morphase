# Plugin Authoring

Morphase plugins isolate backend-specific behavior. A plugin describes what one external tool can do, how to detect it, and how to build a command line for a given request. The engine owns routing and execution; plugins just declare capabilities and produce plans.

Builtin plugins live in `packages/plugins/<plugin>/src/index.ts`.

## Official vs community plugins

Not every plugin belongs in the main repo. As a rough guide:

**A plugin is a good fit for this repo if it:**

- Wraps a widely available, stable, open-source tool (FFmpeg, Pandoc, ImageMagick, etc.).
- Is installable through at least one of the officially supported package managers (Homebrew, WinGet, apt-get).
- Covers a route the core Morphase audience will actually use.
- Has predictable output and does not require service accounts, API keys, or network configuration to function.
- Is reasonably behaved across macOS, Windows, and Linux, or clearly scopes itself to a subset.

**A plugin is usually better as a community or out-of-tree plugin if it:**

- Talks to a paid or proprietary service.
- Requires user credentials, API keys, or OAuth.
- Targets a niche format or workflow most users won't need.
- Has heavy or platform-specific install requirements that can't be documented with a one-line install hint.
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
  getInstallHints(platform: Platform): InstallHint[];
  getUpdateHints?(platform: Platform): InstallHint[];
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
  platform?: Platform[];       // restrict to specific OSes
}
```

The planner uses these to match a route to candidate plugins via `Registry.findCandidates()`.

#### `detect(platform)`

Checks whether the external tool is installed.

```ts
{ detected: true; version?: string; command: string }
| { detected: false }
```

Use `detectBinary()` from `packages/plugins/src/helpers.ts`, or `detectFirstAvailableCommand()` from `@morphase/plugin-sdk`, to probe for binaries.

#### `verify(platform)`

A deeper health check beyond detection:

```ts
{ ok: boolean; issues?: string[]; warnings?: string[] }
```

Good uses: checking delegate support (e.g. ImageMagick's HEIC/WebP delegates), dependency availability (e.g. yt-dlp needing ffmpeg for MP3), or version-specific bugs.

#### `getInstallHints(platform)` / `getUpdateHints(platform)`

Per-platform install instructions. Use `packageHints()`:

```ts
getInstallHints(platform) {
  return packageHints(
    platform,
    { command: "brew install ffmpeg" },
    { command: "winget install Gyan.FFmpeg" },
    { command: "sudo apt-get install ffmpeg" },
  );
}
```

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
}
```

Key fields:

- **`command`** / **`args`** — Passed directly to `execa`. Never shell-concatenate.
- **`outputMapping`** — For tools that generate output under their own filenames (e.g. LibreOffice). The executor renames those files to the user's expected path.
- **`stdoutFile`** — Write stdout to a file instead of discarding it (used by `trafilatura`, `summarize`).
- **`tempDirs`** — Temp directories the executor will clean up after execution.

#### `explain(request)`

Returns a human-readable explanation of why this plugin was chosen and what it will do. Shown by `morphase explain`.

## Plugin SDK

`@morphase/plugin-sdk` provides the minimum helpers to author a plugin:

- **`definePlugin(plugin)`** — Identity function that enforces the `MorphasePlugin` type at compile time.
- **`detectFirstAvailableCommand(commands, versionArgs)`** — Tries multiple command names and returns the first that responds.
- **`installHintByPlatform(platform, hints)`** — Selects the correct hint record for the current OS.

## Shared plugin helpers

`packages/plugins/src/helpers.ts` adds conveniences used by most builtin plugins:

- **`detectBinary(commands, versionArgs)`** — `detectFirstAvailableCommand` plus semver parsing.
- **`packageHints(macos, windows, linux, notes?)`** — Per-platform install hint record.
- **`verifyBinary(commands, args)`** — Simple binary verification.
- **`libreOfficeConvert(input, output, format)`** — Builds a LibreOffice execution plan with output mapping.
- **`whisperGeneratedTranscript(input, output)`** — Builds a Whisper execution plan with output mapping.

## Plugin rules

- Keep routing decisions out of the CLI.
- Keep global routing decisions out of plugins — plugins declare capabilities; the planner decides.
- Don't mutate system state without explicit user intent.
- Keep backend-specific quirks, warnings, and install metadata inside the plugin.
- Always pass commands and args as separate arrays — never shell-concatenate, to prevent injection.
- Return `null` from `plan()` for requests this plugin can't handle; don't throw.

## Example skeleton

```ts
import {
  definePlugin,
  detectFirstAvailableCommand,
  installHintByPlatform,
} from "@morphase/plugin-sdk";
import type {
  MorphasePlugin,
  Capability,
  PlanRequest,
  ExecutionPlan,
  Platform,
  DetectionResult,
  VerificationResult,
  InstallHint,
} from "@morphase/shared";

export const myPlugin = definePlugin({
  id: "mytool",
  name: "MyTool",
  priority: 80,
  minimumVersion: "1.0.0",
  commonProblems: ["Some known issue"],

  capabilities(): Capability[] {
    return [
      { kind: "conversion", from: "csv", to: "json", quality: "high", offline: true },
    ];
  },

  async detect(platform: Platform): Promise<DetectionResult> {
    return detectFirstAvailableCommand(["mytool"], ["--version"]);
  },

  async verify(platform: Platform): Promise<VerificationResult> {
    return { ok: true };
  },

  getInstallHints(platform: Platform): InstallHint[] {
    return installHintByPlatform(platform, {
      macos: { command: "brew install mytool" },
      windows: { command: "winget install MyTool" },
      linux: { command: "sudo apt-get install mytool" },
    });
  },

  async plan(request: PlanRequest): Promise<ExecutionPlan | null> {
    if (request.route.kind !== "conversion") return null;
    return {
      command: "mytool",
      args: ["convert", request.input, "-o", request.output!],
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
3. Export the plugin from `packages/plugins/src/index.ts` and add it to the `builtinPlugins` array.
4. Add tests in `tests/plugins.test.ts` that verify metadata and capabilities.
5. Run `pnpm build && pnpm typecheck && pnpm test`.
6. Open a PR. Include a brief note on which route(s) it adds and why the plugin belongs in the main repo (see the [Official vs community](#official-vs-community-plugins) section above).
