# Plugin Authoring

Builtin plugins live in `packages/plugins/<plugin>/src/index.ts`.

## Plugin Contract

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

## Required Fields

- **`id`** — Unique identifier used in routing, CLI flags (`--backend <id>`), and logging (e.g. `"ffmpeg"`)
- **`name`** — Human-readable display name (e.g. `"FFmpeg"`)
- **`priority`** — Default ordering hint. Higher values are preferred when scores are equal. Range: 0–100
- **`minimumVersion`** — Semver string. If the detected version is below this, the planner applies a penalty
- **`optional`** — If `true`, the plugin is treated as opt-in (e.g. yt-dlp, whisper, summarize)
- **`commonProblems`** — Array of known issues shown in `morphase doctor` output

## Required Methods

### `capabilities()`

Returns an array of `Capability` objects describing what the plugin can handle. Each capability includes:

```ts
{
  kind: "conversion" | "transform" | "fetch" | "extract";
  from: ResourceKind;
  to?: ResourceKind;           // undefined for operations like compress/merge
  operation?: string;          // for transform/extract operations (e.g. "compress", "merge")
  quality: "high" | "medium" | "best_effort";
  offline: boolean;
  platform?: Platform[];       // restrict to specific platforms
}
```

The planner uses these to match a route to candidate plugins via `Registry.findCandidates()`.

### `detect(platform)`

Checks whether the external tool is installed. Returns a `DetectionResult`:

```ts
{ detected: true; version?: string; command: string }
| { detected: false }
```

Use `detectBinary()` from `packages/plugins/src/helpers.ts` or `detectFirstAvailableCommand()` from `@morphase/plugin-sdk` to probe for binaries.

### `verify(platform)`

Runs a deeper health check beyond detection. Returns a `VerificationResult`:

```ts
{
  ok: boolean;
  issues?: string[];
  warnings?: string[];
}
```

Use this to check for delegate support (e.g. ImageMagick's HEIC/WebP delegates), dependency availability (e.g. yt-dlp needing ffmpeg for MP3), or version-specific bugs.

### `getInstallHints(platform)` / `getUpdateHints(platform)`

Returns per-platform install instructions. Use `packageHints()` from helpers:

```ts
getInstallHints(platform: Platform): InstallHint[] {
  return packageHints(
    platform,
    { command: "brew install ffmpeg" },
    { command: "winget install Gyan.FFmpeg" },
    { command: "sudo apt-get install ffmpeg" },
  );
}
```

### `plan(request)`

Builds an `ExecutionPlan` for the given request, or returns `null` if the plugin cannot handle it:

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
- **`command`** and **`args`** — Passed directly to `execa`. Never shell-concatenate
- **`outputMapping`** — For tools that generate their own output filenames (e.g. LibreOffice). The executor renames these to the user's expected path
- **`stdoutFile`** — Write stdout to a file instead of discarding (used by trafilatura, summarize)
- **`tempDirs`** — Temp directories the executor will clean up after execution

### `explain(request)`

Returns a human-readable explanation of why this plugin was chosen and what it will do. Shown by `morphase explain`.

## Plugin SDK

`@morphase/plugin-sdk` provides helpers to reduce boilerplate:

- **`definePlugin(plugin)`** — Identity function that ensures type correctness at compile time
- **`detectFirstAvailableCommand(commands, versionArgs)`** — Tries multiple command names, returns the first that responds
- **`installHintByPlatform(platform, hints)`** — Selects the correct hint for the current OS

## Shared Plugin Helpers

`packages/plugins/src/helpers.ts` provides additional utilities:

- **`detectBinary(commands, versionArgs)`** — Wraps `detectFirstAvailableCommand` with semver parsing
- **`packageHints(macos, windows, linux, notes?)`** — Creates a per-platform install hint record
- **`verifyBinary(commands, args)`** — Simple binary verification
- **`libreOfficeConvert(input, output, format)`** — Builds a LibreOffice execution plan with output mapping
- **`whisperGeneratedTranscript(input, output)`** — Builds a Whisper execution plan with output mapping

## Plugin Rules

- Keep routing decisions out of CLI files
- Keep global routing decisions out of plugins (plugins declare capabilities; the planner decides)
- Avoid mutating system state without explicit user intent
- Keep backend-specific quirks, warnings, and install metadata inside the plugin
- Commands and args are passed as separate arrays — never shell-concatenate to prevent injection
- Return `null` from `plan()` if the request is not something this plugin can handle

## Example Plugin Skeleton

```ts
import { definePlugin, detectFirstAvailableCommand, installHintByPlatform } from "@morphase/plugin-sdk";
import type { MorphasePlugin, Capability, PlanRequest, ExecutionPlan, Platform, DetectionResult, VerificationResult, InstallHint } from "@morphase/shared";

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

## Adding a New Plugin

1. Create `packages/plugins/<id>/src/index.ts`
2. Implement the `MorphasePlugin` interface using `definePlugin()`
3. Export the plugin from `packages/plugins/src/index.ts` and add it to the `builtinPlugins` array
4. Add tests in `tests/plugins.test.ts` to verify metadata and capabilities
5. Run `pnpm build && pnpm typecheck && pnpm test`
