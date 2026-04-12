# Architecture

## Guiding Principle

> **One shared engine, many interfaces, pluggable backends.**

CLI and server are thin clients. The engine owns routing, planning, execution, doctoring, and job tracking. Plugins isolate backend-specific behavior. Shared types and schemas keep the public surface consistent. The server and CLI both call the same `MorphaseEngine` entry point.

---

## High-Level System Diagram

```
                 +-------------------+
                 |     Web UI        |
                 |   (future client) |
                 +---------+---------+
                           |
                           v
+-----------+    +-------------------+    +------------------+
|   CLI     | -> |   Morphase Engine  | <- |  Local API       |
| (client)  |    |                   |    |  Server          |
+-----------+    | - registry        |    +------------------+
                 | - planner         |
                 | - executor        |
                 | - doctor          |
                 | - job manager     |
                 | - config          |
                 | - platform        |
                 | - logger          |
                 +---------+---------+
                           |
                           v
                 +---------------------+
                 |   Plugin Layer      |
                 |  15 builtin plugins |
                 +---------------------+
                           |
                           v
                 +---------------------+
                 | External Binaries / |
                 | Local Tooling       |
                 +---------------------+
```

---

## Monorepo Structure

morphase uses a **pnpm workspace** monorepo. The root `pnpm-workspace.yaml` declares `apps/*` and `packages/*` as workspace members.

```
morphase/
  apps/
    cli/                    # Interactive and direct CLI (commander + prompts)
    server/                 # Local API server (Fastify)

  packages/
    shared/                 # Types, schemas, constants, utilities
      src/
        types/index.ts      # All domain types
        schemas/config.ts   # Zod config schema
        schemas/job.ts      # Zod job request schema
        constants/routes.ts # ROUTE_PREFERENCES map
        utils/paths.ts      # Path derivation helpers
        utils/resources.ts  # Resource kind inference, URL detection
        utils/process.ts    # spawn wrapper (runCommandCapture)
        utils/version.ts    # Semver parse + compare

    engine/                 # Core routing, planning, execution engine
      src/
        index.ts            # MorphaseEngine class (main entry point)
        registry/           # Plugin registry
        planner/            # Route planning + scoring + pipelines
        executor/           # Process execution + output validation
        doctor/             # Backend health inspection
        jobs/               # In-memory job tracking
        config/             # Config file loading (~/.morphase/config.json)
        platform/           # OS detection + package manager detection
        errors/             # MorphaseRuntimeError
        logging/            # Structured logger

    plugin-sdk/             # Plugin authoring helpers
      src/index.ts          # definePlugin, detectFirstAvailableCommand, installHintByPlatform

    plugins/                # All builtin backend plugins
      src/
        index.ts            # Re-exports all plugins + builtinPlugins array
        helpers.ts          # Shared plugin utilities
      pandoc/               # Document/markup conversion
      libreoffice/          # Office-to-PDF conversion
      ffmpeg/               # Audio/video conversion + compression
      imagemagick/          # Image conversion
      qpdf/                 # PDF merge/split/optimize
      trafilatura/          # URL-to-markdown/text extraction
      markitdown/           # File-to-markdown extraction
      trafilatura/          # URL-to-markdown/text extraction
      ytdlp/                # YouTube/media URL download
      whisper/              # Local transcription
      summarize/            # YouTube transcript extraction
      jpegoptim/            # JPEG compression
      optipng/              # PNG compression

  docs/                     # Architecture, route matrix, support matrix, plugin authoring
  tests/                    # Planner, plugin, and normalize-request tests
```

---

## Package Dependency Graph

```
@morphase/shared          (leaf — zero workspace deps)
    ^
    |
@morphase/plugin-sdk      (depends on @morphase/shared)
    ^
    |
@morphase/plugins         (depends on @morphase/shared + @morphase/plugin-sdk)
    ^
    |
@morphase/engine          (depends on @morphase/shared + @morphase/plugin-sdk + @morphase/plugins)
    ^
    |
  +- @morphase/server     (depends on @morphase/engine + @morphase/shared)
  +- morphase-cli         (depends on @morphase/engine + @morphase/server + @morphase/shared)
```

Key external dependencies:
- **zod** — config and job request validation (`@morphase/shared`)
- **execa** — process spawning (`@morphase/engine`, `morphase-cli`)
- **commander** — CLI argument parsing (`morphase-cli`)
- **prompts** — interactive wizard (`morphase-cli`)
- **fastify** — HTTP server (`@morphase/server`)

---

## Domain Model

### Resource Kinds

morphase reasons about normalized resource kinds, not just file extensions. Defined as a const array in `@morphase/shared`:

`markdown`, `html`, `docx`, `pptx`, `xlsx`, `odt`, `ods`, `odp`, `pdf`, `txt`, `jpg`, `png`, `webp`, `heic`, `mp3`, `wav`, `mp4`, `mov`, `mkv`, `url`, `youtube-url`, `media-url`, `subtitle`, `transcript`

Resource kind inference (`inferResourceKind`) works by:
1. Checking if input is a YouTube URL (hostname matching)
2. Checking if input matches a known media host (Instagram, TikTok, X, Reddit, etc.)
3. Checking if input is any HTTP(S) URL
4. Falling back to file extension mapping

### Routes

A route is either a **conversion** or an **operation**:

```ts
type Route =
  | { kind: "conversion"; from: ResourceKind; to: ResourceKind }
  | { kind: "operation";  resource: ResourceKind; action: string }
```

Examples:
- `{ kind: "conversion", from: "pptx", to: "pdf" }`
- `{ kind: "operation", resource: "pdf", action: "merge" }`

Routes are identified by a string key: `"pptx->pdf"` for conversions, `"pdf:merge"` for operations.

### Core Request/Result Types

| Type | Purpose |
|------|---------|
| `JobRequest` | User-facing request: input, from/to, operation, output, options, backendPreference, flags |
| `PlanRequest` | Internal normalized request with resolved route, platform, and offlineOnly |
| `ExecutionPlan` | What to run: command, args, env, cwd, tempDirs, expectedOutputs, outputMapping |
| `PlannedExecution` | Full plan result: selected plugin, explanation, warnings, steps, fallbacks |
| `JobResult` | Final result: jobId, status, outputPaths, logs, warnings, error, equivalentCommand |
| `JobRecord` | Persistent job state: request, route, status, timestamps, logs, result |
| `MorphaseError` | Structured error: code, message, likelyCause, suggestedFixes, rawStdout/Stderr |

---

## Engine Internals

The engine is the heart of Morphase. `MorphaseEngine` is the single entry point, constructed via the async factory `MorphaseEngine.create()`.

### Initialization

```
MorphaseEngine.create()
  ├── loadMorphaseConfig()          // Reads ~/.morphase/config.json (falls back to defaults)
  ├── new PluginRegistry(plugins) // Registers all builtin plugins
  ├── new Planner(registry, config)
  ├── new Logger(config.debug)
  ├── new Executor(logger)
  └── new Doctor()
```

### Plugin Registry (`packages/engine/src/registry/plugin-registry.ts`)

The registry holds all registered plugins and provides query capabilities:

- **`list()`** — Returns all plugins sorted by descending priority
- **`get(id)`** — Looks up a plugin by ID
- **`capabilities()`** — Flattens all plugin capabilities into a unified list
- **`findCandidates(route, platform)`** — Finds plugins whose capabilities match a given route and platform. For conversions, matches `from` + `to`. For operations, matches resource + operation.

### Planner (`packages/engine/src/planner/planner.ts`)

The planner takes a normalized `PlanRequest` and selects the best plugin or pipeline.

**Step 1: Request Normalization** (`normalize-request.ts`)

The `normalizeRequest()` function transforms a `JobRequest` into a resolved `Route` and partial `PlanRequest`:
- Resolves relative input/output paths against the invocation CWD
- Infers `from` resource kind from the input (file extension or URL)
- Derives default output paths from input name + target extension
- For operations, ensures output path differs from input (appends `_compressed`)

The `toPlanRequest()` function adds `platform` (from OS detection) and `offlineOnly` to produce a complete `PlanRequest`.

**Step 2: Candidate Scoring**

For each candidate plugin from the registry, the planner evaluates a numeric score:

| Factor | Score |
|--------|-------|
| Base (exact route match) | +50 |
| Preferred for route (from ROUTE_PREFERENCES or config) | +20 |
| Plugin installed | +15 |
| Plugin verified healthy | +10 |
| Offline support when offline requested | +15 |
| High quality route | +10 |
| Medium quality route | +5 |
| Best effort route | -20 |
| Installed but unhealthy | -30 |
| Network required when offline requested | rejected (−∞) |

Candidates are sorted by descending score. Non-finite scores are filtered out.

**Step 3: Plan Building**

1. If no candidates exist, check curated pipelines as a fallback
2. If the top-ranked candidate is not installed, return `installNeeded: true`
3. For each installed candidate (in rank order), call `plugin.plan(request)` — the first non-null plan wins
4. If no plugin produces a plan, check curated pipelines again
5. If still nothing, throw `UNSUPPORTED_ROUTE`

**Step 4: Pipeline Support** (`pipelines.ts`)

Curated multi-step pipelines allow chaining plugins when no direct route exists:

| Pipeline ID | Steps |
|-------------|-------|
| `markdown-to-pdf-via-docx` | pandoc (md→docx) → libreoffice (docx→pdf) |
| `html-to-pdf-via-docx` | pandoc (html→docx) → libreoffice (docx→pdf) |
| `docx-to-markdown-via-pdf` | libreoffice (docx→pdf) → markitdown (pdf→md) |
| `pdf-to-txt-via-markdown` | markitdown (pdf→md) → pandoc (md→txt) |

Each pipeline step runs in a shared temp directory. Intermediate outputs are passed as input to the next step.

**Equivalent Command Generation**

The planner generates a human-readable CLI command (e.g. `morphase convert deck.pptx deck.pdf`) based on the route type:
- Conversions → `morphase convert`
- Media → `morphase media`
- URL/YouTube fetches → `morphase fetch`
- Extract to text/markdown/transcript → `morphase extract`
- Operations → `morphase <resource> <action>`

### Executor (`packages/engine/src/executor/executor.ts`)

The executor runs the planned steps and validates results.

**Execution flow:**

1. If `dryRun`, log commands without executing
2. For each step:
   - Track temp directories
   - Spawn process via `execa` with `reject: false`
   - Capture stdout/stderr into job logs
   - If `stdoutFile` is set, write stdout to file
   - If exit code ≠ 0, create a `BACKEND_EXECUTION_FAILED` error
   - Apply `outputMapping` (rename generated files to expected output paths)
   - Collect `expectedOutputs` into the output set
3. Validate that expected outputs actually exist on disk
4. Clean up temp directories (unless `--debug` or `--keep-temp`)
5. If outputs were expected but none validated, return `OUTPUT_NOT_PRODUCED`

**Error Enrichment** (`enrichError`)

The executor contains backend-specific error enrichment logic that detects common failure patterns in stderr and augments errors with `likelyCause` and `suggestedFixes`. Examples:
- FFmpeg: "does not contain any stream" → audio stream missing
- yt-dlp: "requested format not available" → format not supported
- yt-dlp: "sign in" or "bot" → YouTube blocking the request
- yt-dlp: ffmpeg errors → FFmpeg dependency missing
- summarize: "node.*version" → Node 22+ required

### Doctor (`packages/engine/src/doctor/doctor.ts`)

Doctor inspects backend health by calling `detect()` and `verify()` on each plugin:

For each backend, a `BackendDoctorReport` includes:
- Installed status and detected version
- Minimum version requirement
- Verification result (issues + warnings)
- Install and update hints for the current platform
- Common problems list

The CLI exposes this via `morphase doctor`, `morphase backend list`, `morphase backend verify <id>`, and `morphase backend install/update <id>`.

### Job Manager (`packages/engine/src/jobs/job-manager.ts`)

Every operation is tracked as a job with a UUID. Jobs are stored in an in-memory `Map<string, JobRecord>`.

Job lifecycle: `queued` → `planned` → `running` → `success` | `failed` | `cancelled`

The job manager provides:
- `create()` — Initialize a job with UUID and timestamps
- `get()` / `list()` — Retrieve jobs
- `update()` — Apply partial patches
- `setStatus()` — Transition job status
- `appendLog()` — Add log entries
- `complete()` — Finalize with a JobResult

### Platform (`packages/engine/src/platform/platform.ts`)

All OS-specific behavior is isolated here:

- **`detectPlatform()`** — Maps `process.platform` to `"macos" | "windows" | "linux"`
- **`detectPackageManager()`** — Detects available package manager: `brew` (macOS), `winget` (Windows), `apt-get`/`brew`/`manual` (Linux)
- **`homeDirectory()`** — Returns `os.homedir()` for config file resolution

### Configuration (`packages/engine/src/config/load-config.ts`)

Config is loaded from `~/.morphase/config.json`, validated with Zod against `morphaseConfigSchema`:

```ts
{
  offlineOnly: false,                    // Reject network-backed backends
  preferredBackends: {},                 // Override route → plugin preferences
  debug: false,                          // Enable debug logging
  allowPackageManagerDelegation: false,  // Allow running install commands
  server: { host: "127.0.0.1", port: 3210 }
}
```

If the file is missing or invalid, defaults are used.

### Logger (`packages/engine/src/logging/logger.ts`)

Structured log prefixes: `[planner]`, `[doctor]`, `[executor]`, `[plugin:<id>]`, `[debug]`. Debug messages are gated behind the `debug` config flag.

### Errors (`packages/engine/src/errors/morphase-error.ts`)

All engine errors are thrown as `morphaseRuntimeError`, which wraps a structured `morphaseError` with:
- `code` — Machine-readable error code (e.g. `BACKEND_NOT_INSTALLED`, `UNSUPPORTED_ROUTE`)
- `message` — Human-readable description
- `likelyCause` — What probably went wrong
- `suggestedFixes` — Actionable steps
- `backendId` — Which backend is involved
- `rawStdout` / `rawStderr` — Raw process output (for debug)

---

## Plugin Architecture

### Plugin Contract

Every plugin implements the `morphasePlugin` interface:

```ts
interface morphasePlugin {
  id: string;                   // Unique identifier (e.g. "ffmpeg")
  name: string;                 // Display name (e.g. "FFmpeg")
  priority: number;             // Higher = preferred (default ordering)
  minimumVersion?: string;      // Minimum supported version
  optional?: boolean;           // Whether this plugin is optional
  commonProblems?: string[];    // Known issues for doctor output

  capabilities(): Capability[];
  detect(platform: Platform): Promise<DetectionResult>;
  verify(platform: Platform): Promise<VerificationResult>;
  getInstallHints(platform: Platform): InstallHint[];
  getUpdateHints?(platform: Platform): InstallHint[];
  plan(request: PlanRequest): Promise<ExecutionPlan | null>;
  explain(request: PlanRequest): Promise<string>;
}
```

### Plugin SDK (`@morphase/plugin-sdk`)

Provides three helpers to reduce boilerplate:

- **`definePlugin(plugin)`** — Identity function that ensures type correctness
- **`detectFirstAvailableCommand(commands, versionArgs)`** — Tries multiple command names, returns the first one that responds
- **`installHintByPlatform(platform, hints)`** — Selects the correct hint record for the current OS

### Shared Plugin Helpers (`packages/plugins/src/helpers.ts`)

Additional utilities used by most plugins:

- **`detectBinary(commands, versionArgs)`** — Wraps `detectFirstAvailableCommand` with semver parsing
- **`packageHints(macos, windows, linux, notes)`** — Creates a per-platform install hint record
- **`verifyBinary(commands, args)`** — Simple binary verification
- **`libreOfficeConvert(input, output, format)`** — Builds a LibreOffice execution plan with output mapping
- **`whisperGeneratedTranscript(input, output)`** — Builds a Whisper execution plan with output mapping
- **`supportsImageMagickFormat(format)`** — Checks if ImageMagick supports a given format

### Plugin Registration

All 15 plugins are imported and registered in `packages/plugins/src/index.ts` as the `builtinPlugins` array. The engine receives these via `morphaseEngine.create()`.

### Builtin Plugin Matrix

| Plugin | ID | Priority | Capabilities | External Tool |
|--------|-----|----------|-------------|---------------|
| Pandoc | `pandoc` | 95 | md→pdf, md→docx, md→txt, html→pdf, html→md, html→docx | `pandoc` |
| LibreOffice | `libreoffice` | — | docx/pptx/xlsx/odt/ods/odp→pdf | `soffice` |
| FFmpeg | `ffmpeg` | 100 | mp4→mp3, mov→mp4, mkv→mp4, wav→mp3, mp3→wav, video compress | `ffmpeg` |
| ImageMagick | `imagemagick` | — | jpg↔png, webp→png/jpg, heic→jpg/png | `magick`/`convert` |
| qpdf | `qpdf` | 100 | pdf merge/split/optimize | `qpdf` |
| Trafilatura | `trafilatura` | 90 | url→markdown, url→txt | `trafilatura` |
| MarkItDown | `markitdown` | — | pdf→markdown, office→markdown | `markitdown` |
| yt-dlp | `ytdlp` | 60 | youtube→mp4/mp3/transcript/subtitle, media-url→mp4/mp3/transcript | `yt-dlp` |
| Whisper | `whisper` | — | audio/video→transcript | `whisper` |
| summarize | `summarize` | 70 | youtube-url→transcript, url→markdown | `summarize` |
| jpegoptim | `jpegoptim` | — | jpg compress | `jpegoptim` |
| optipng | `optipng` | — | png compress | `optipng` |

### Route Preferences (`ROUTE_PREFERENCES`)

Defined in `packages/shared/src/constants/routes.ts`, this map defines the preferred plugin ordering for each route key. The planner uses this as the default when no config override or `--backend` flag is provided.

### Execution Plan Structure

Plugins return an `ExecutionPlan` that describes exactly what to run:

```ts
{
  command: string;              // Binary to execute
  args: string[];               // Arguments (never shell-concatenated)
  env?: Record<string, string>; // Additional environment variables
  cwd?: string;                 // Working directory
  tempDirs?: string[];          // Temp dirs to clean up after execution
  expectedOutputs?: string[];   // Files that should exist after execution
  outputMapping?: { source: string; target: string }[]; // Rename generated files
  stdoutFile?: string;          // Write stdout to this file path
  timeoutMs?: number;           // Process timeout
  notes?: string[];             // Human-readable notes
}
```

The `outputMapping` field handles backends (like LibreOffice, yt-dlp) that generate output with their own naming conventions. The executor renames these files to match the user's expected output path.

---

## Request Lifecycle

This is the complete flow from user input to final result:

```
User Input
    │
    v
[CLI / Server] builds JobRequest
    │
    v
morphaseEngine.submit(request)
    │
    ├── normalizeRequest()
    │     ├── Resolve input paths (relative → absolute)
    │     ├── Infer resource kind from extension or URL
    │     ├── Determine route (conversion or operation)
    │     └── Derive output path if not specified
    │
    ├── JobManager.create() → job record (status: queued)
    │
    ├── toPlanRequest() → add platform + offlineOnly
    │
    ├── Planner.plan()
    │     ├── Registry.findCandidates(route, platform)
    │     │     └── Filter capabilities by route match + platform
    │     │
    │     ├── For each candidate:
    │     │     ├── plugin.detect(platform) → DetectionResult
    │     │     └── plugin.verify(platform) → VerificationResult
    │     │
    │     ├── Score and rank candidates
    │     │
    │     ├── For each installed candidate (rank order):
    │     │     └── plugin.plan(request) → ExecutionPlan | null
    │     │
    │     └── Return PlannedExecution (or try curated pipelines)
    │
    ├── If installNeeded → throw BACKEND_NOT_INSTALLED
    │
    ├── JobManager.setStatus(running)
    │
    ├── Executor.run(jobId, plan, request)
    │     ├── For each step:
    │     │     ├── execa(command, args, { cwd, env })
    │     │     ├── Capture stdout/stderr
    │     │     ├── Write stdoutFile if specified
    │     │     ├── Apply outputMapping (rename files)
    │     │     └── Collect expectedOutputs
    │     ├── Validate outputs exist on disk
    │     ├── Clean up temp directories
    │     └── Return JobResult
    │
    └── JobManager.complete(jobId, result)
```

---

## CLI Architecture (`apps/cli`)

The CLI is a **thin client** built with **Commander.js** and **prompts**.

### Entry Point (`src/index.ts`)

On startup:
1. Creates `morphaseEngine` instance
2. If `process.argv.length <= 2` (no subcommand), launches the interactive wizard
3. Otherwise, parses CLI arguments via Commander

### Commands

| Command | Description |
|---------|-------------|
| `morphase` | Launch interactive wizard |
| `morphase convert <input> <output>` | Convert a file |
| `morphase extract <input> --to <format>` | Extract content |
| `morphase fetch <url> --to <format>` | Fetch URL content |
| `morphase media <input> --to <format>` | Convert audio/video |
| `morphase image compress <input>` | Compress image |
| `morphase video compress <input>` | Compress video |
| `morphase pdf merge <inputs...> -o <out>` | Merge PDFs |
| `morphase pdf split <input> --pages <range> -o <out>` | Split PDF |
| `morphase pdf optimize <input> -o <out>` | Optimize PDF |
| `morphase doctor` | Inspect all backends |
| `morphase backend list` | List backend install status |
| `morphase backend status` | Detailed backend status |
| `morphase backend verify <id>` | Verify specific backend |
| `morphase backend install <id> [--run]` | Show/run install command |
| `morphase backend update <id> [--run]` | Show/run update command |
| `morphase explain <input> --to <format>` | Show plan without running |
| `morphase serve [--host] [--port]` | Start API server |

### Common Options

All conversion commands support: `--from`, `--backend`, `--offline`, `--debug`, `--dry-run`.

### Interactive Wizard (`src/wizard.ts`)

When the user runs bare `morphase`, a guided flow walks through:
1. **Category selection** — Documents, PDF, Images, Audio & Video, Download, Web pages
2. **Route/operation selection** — Specific conversion or operation within category
3. **Input collection** — File path or URL
4. **Output path** — Pre-filled suggestion, user can override
5. **Plan preview** — Shows which backend will be used
6. **Confirmation** — "Run this now?"
7. **Execution** — Runs the job and displays results

The wizard supports "Back" navigation to return to the category picker.

### Output Formatting (`src/format.ts`)

Three formatters produce human-readable terminal output with ANSI colors:
- `formatJobResult()` — Success: file name, size, path, backend used, warnings. Failure: error message, cause, suggested fixes.
- `formatDoctorReport()` — Backend name, installed status, version, install hint, issues.
- `formatCliError()` — Structured error display with cause and fix suggestions.

---

## Server Architecture (`apps/server`)

A **Fastify** HTTP server that reuses the same `morphaseEngine`.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health check |
| `GET` | `/capabilities` | All plugin capabilities |
| `GET` | `/backends` | Doctor report for all backends |
| `GET` | `/backends/:id` | Doctor report for one backend |
| `POST` | `/jobs` | Submit a job (body: `JobRequest`) |
| `GET` | `/jobs/:id` | Get job record |
| `GET` | `/jobs/:id/logs` | Get job logs |
| `GET` | `/jobs/:id/result` | Get job result |

### Security Defaults

- Binds to `127.0.0.1:3210` by default (localhost only)
- No auth in v1
- Same engine instance as CLI — no shell-out to CLI commands

### Startup

The CLI's `morphase serve` command calls `createmorphaseServer(engine)`, which either accepts an existing engine or creates one. The server is designed to be imported as a library for future web UI integration.

---

## Testing Strategy

Tests live in the root `tests/` directory and use **Vitest**.

| Test file | What it tests |
|-----------|---------------|
| `tests/planner.test.ts` | Planner scoring, candidate selection, route preferences, pipeline fallback |
| `tests/plugins.test.ts` | Plugin metadata, capability declarations, detect/verify behavior |
| `tests/normalize-request.test.ts` | Request normalization, path resolution, resource kind inference |
| `tests/youtube.test.ts` | YouTube URL detection and route handling |

### Build & Test Commands

```bash
pnpm build           # Build all packages (tsup)
pnpm typecheck       # TypeScript type checking across all packages
pnpm test            # Run vitest
pnpm test:watch      # Run vitest in watch mode
pnpm dev             # Run CLI in dev mode (tsx)
```

---

## Route Preference System

Route preferences come from three sources (in priority order):

1. **`--backend` CLI flag** — User explicitly selects a backend
2. **Config `preferredBackends`** — User's `~/.morphase/config.json` overrides
3. **`ROUTE_PREFERENCES` constant** — Built-in default ordering in `packages/shared/src/constants/routes.ts`

This allows users to override defaults per route without modifying code.

---

## Error Handling Philosophy

morphase owns **diagnosis**, not repair. When something breaks:

1. **Say what failed** — Clear error code and message
2. **Say why** — `likelyCause` explains the probable reason
3. **Tell how to fix it** — `suggestedFixes` provides actionable steps
4. **Offer fallback** — `fallbacks` lists alternative backends

Error codes include: `INPUT_NOT_FOUND`, `INVALID_INPUT`, `UNSUPPORTED_ROUTE`, `BACKEND_NOT_INSTALLED`, `BACKEND_VERSION_UNSUPPORTED`, `BACKEND_VERIFY_FAILED`, `BACKEND_EXECUTION_FAILED`, `OUTPUT_NOT_PRODUCED`, `NETWORK_REQUIRED`, `PERMISSION_DENIED`, `PIPELINE_STEP_FAILED`.

---

## Security Posture

- Local-first by default — no network requirement for core routes
- Server binds to localhost only by default
- No silent remote upload
- Network-backed plugins (Jina, yt-dlp) are clearly disclosed
- Plugins do not mutate system state without explicit user confirmation
- `--debug` and `--keep-temp` are opt-in for troubleshooting
- Commands and args are passed separately to `execa` — no shell injection
