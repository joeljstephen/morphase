# morphase — Full Product & Architecture Specification

Version: v1.0 draft  
Status: Implementation guide  
Audience: Human maintainers, Claude, Codex, or any coding agent implementing the product end-to-end

---

## 1. Executive summary

morphase is a local-first, open-source conversion router.

It does **not** try to reimplement every file conversion engine itself. Instead, it provides one clean, consistent interface that routes a user’s request to the best available open-source backend for that job.

Examples:
- `pptx -> pdf`
- `docx -> pdf`
- `markdown -> pdf`
- `pdf -> markdown`
- `website -> markdown`
- `jpg -> png`
- `png -> jpg`
- `mp4 -> mp3`
- `mov -> mp4`
- `youtube-url -> mp3` (optional plugin)
- `audio/video -> transcript` (optional plugin)
- `pdf merge`
- `pdf split`

morphase is primarily a **routing, setup, and user-experience layer** on top of existing best-of-breed tools such as Pandoc, LibreOffice, FFmpeg, qpdf, ImageMagick, Trafilatura, MarkItDown, and Docling.

morphase must be designed from the beginning so that:
- it works as a CLI,
- it can later power a local/self-hosted web UI,
- it can run on macOS, Windows, and Linux,
- it stays low-maintenance,
- it remains easy to extend or prune by adding/removing plugins,
- and users can self-diagnose environment issues instead of relying on the maintainer.

The core design principle is:

> **One shared engine, many interfaces, pluggable backends.**

---

## 2. Product definition

### 2.1 What morphase is

morphase is:
- a **conversion router**,
- a **capability registry**,
- a **backend plugin host**,
- a **guided setup and troubleshooting experience**,
- a **thin local automation layer**,
- and later, a **server/UI-friendly engine**.

### 2.2 What morphase is not

morphase is not:
- a universal promise that “anything converts to anything,”
- a new rendering engine,
- a replacement for OS package managers,
- a piracy/downloader-first tool,
- a cloud SaaS that uploads files by default,
- or a monolithic binary bundling every backend.

### 2.3 User value proposition

morphase solves these pain points:
- Users do not want to remember many different CLIs.
- Users do not want to remember install commands for FFmpeg, Pandoc, LibreOffice, etc.
- Users do not want to read docs for every tool.
- Users want a guided setup flow and a friendly wizard.
- Users want one consistent command surface across documents, media, PDFs, images, and web extraction.
- Users want self-hosted and local-first workflows.
- Users want the option to drop to direct commands when they become power users.

### 2.4 Product pillars

1. **Local-first by default**
2. **Open-source and transparent**
3. **Backend-agnostic routing**
4. **Interactive for beginners, scriptable for power users**
5. **Low maintenance through metadata-driven plugins and strong doctor tooling**
6. **Future-ready for web UI and self-hosted browser workflows**

---

## 3. Scope

### 3.1 v1 scope

morphase v1 should support these core families:

1. **Documents and markup**
2. **PDF operations**
3. **Images**
4. **Audio/video**
5. **Website/article to Markdown**

Optional, later-in-v1 or early-v2:
6. **YouTube/media fetch**
7. **Transcription**

### 3.2 v1 high-value supported routes

#### Documents and markup
- `md -> pdf`
- `md -> docx`
- `html -> pdf`
- `html -> md`
- `docx -> pdf`
- `pptx -> pdf`
- `xlsx -> pdf`
- `odt -> pdf`
- `ods -> pdf`
- `odp -> pdf`

#### PDF operations
- `pdf -> md`
- `pdf -> txt`
- `pdf merge`
- `pdf split`
- `pdf optimize`

#### Images
- `jpg -> png`
- `png -> jpg`
- `webp -> png`
- `webp -> jpg`
- `heic -> jpg` (best effort, depends on delegates)
- `heic -> png` (best effort, depends on delegates)

#### Audio/video
- `mp4 -> mp3`
- `mov -> mp4`
- `mkv -> mp4`
- `wav -> mp3`
- `mp3 -> wav`

#### Web extraction
- `url -> markdown`
- `url -> txt`

#### Optional plugins
- `youtube-url -> mp4`
- `youtube-url -> mp3`
- `youtube-url -> subtitles`
- `audio/video -> transcript`

### 3.3 Explicit non-goals for v1

Do **not** promise these in v1:
- perfect `pdf -> docx` fidelity,
- `docx -> pptx`,
- `pptx -> docx`,
- arbitrary “convert any format to any other format,”
- arbitrary multi-hop graph search across dozens of tools,
- multi-user SaaS auth system,
- remote cloud execution by default,
- or bundling every backend in one installer.

### 3.4 Support policy

Officially support only:
- **macOS + Homebrew**
- **Windows + WinGet**
- **Ubuntu/Debian + apt-get**

Everything else is best effort or community-supported.

This narrow support matrix is intentional to keep maintenance low.

---

## 4. Product experience

### 4.1 Dual interaction model

morphase must support two interaction styles.

#### A. Guided mode
This is the default beginner-friendly flow.

When the user runs:

```bash
morphase
```

morphase launches an interactive wizard.

Wizard flow:
1. Ask what the user wants to do.
2. Ask for category.
3. Ask for desired outcome.
4. Ask for input file or URL.
5. Detect candidate backends.
6. Check whether selected backend is installed.
7. If missing, offer install/help.
8. Run the job.
9. Show output path.
10. Show equivalent direct command.

#### B. Power mode
This is the direct, scriptable CLI.

Examples:

```bash
morphase convert deck.pptx deck.pdf
morphase extract paper.pdf --to md
morphase fetch https://example.com/article --to md
morphase media input.mp4 --to mp3
morphase pdf merge a.pdf b.pdf -o merged.pdf
morphase doctor
morphase backend verify ffmpeg
morphase serve
```

### 4.2 CLI UX principles

- The CLI must feel consistent across categories.
- Users should think in terms of outcomes, not backend names.
- Backend names are implementation details unless users explicitly ask.
- Every successful wizard run should print the equivalent direct command for future use.
- Errors must be human-readable and actionable.
- `--debug` should expose raw process details.

### 4.3 Future UI mode

morphase must support a future local browser UI.

Users should eventually be able to run:

```bash
morphase serve
```

Then open a local web app in the browser.

The UI must use the same engine as the CLI. It must **not** shell out to CLI commands.

---

## 5. Architecture overview

### 5.1 High-level architecture

```text
                +-------------------+
                |     Web UI        |
                |   (future client) |
                +---------+---------+
                          |
                          v
+-----------+    +-------------------+    +------------------+
|   CLI     | -> |   morphase Engine   | <- |  Local API       |
| (client)  |    |                   |    |  Server          |
+-----------+    | - registry        |    +------------------+
                 | - planner         |
                 | - executor        |
                 | - doctor          |
                 | - job manager     |
                 +---------+---------+
                           |
                           v
                 +---------------------+
                 |   Plugin Layer      |
                 | pandoc              |
                 | libreoffice         |
                 | ffmpeg              |
                 | imagemagick         |
                 | qpdf                |
                 | trafilatura         |
                 | markitdown          |
                 | docling             |
                 | yt-dlp              |
                 | whisper             |
                 +---------------------+
                           |
                           v
                 +---------------------+
                 | External Binaries / |
                 | Local Tooling       |
                 +---------------------+
```

### 5.2 Core architectural rule

> The engine owns routing and execution.
> Interfaces only collect input and display results.

This means:
- the CLI does not own conversion logic,
- the server does not own conversion logic,
- the web app does not own conversion logic,
- plugins are the only place that know backend-specific behavior,
- and the engine is the single reusable core.

---

## 6. Monorepo structure

Use a monorepo from day one.

```text
morphase/
  apps/
    cli/
    server/
    web/                       # future

  packages/
    engine/
      src/
        registry/
        planner/
        executor/
        doctor/
        jobs/
        config/
        errors/
        platform/
        logging/

    plugin-sdk/
      src/

    plugins/
      pandoc/
      libreoffice/
      ffmpeg/
      imagemagick/
      qpdf/
      trafilatura/
      markitdown/
      docling/
      jina/
      ytdlp/
      whisper/

    shared/
      src/
        types/
        schemas/
        constants/
        utils/

  docs/
  examples/
  scripts/
  tests/
```

### 6.1 Why a monorepo

A monorepo makes it easier to:
- share types,
- share validation schemas,
- keep plugins versioned with the engine,
- test the full stack,
- add server/UI later,
- and give coding agents one clear repo shape.

---

## 7. Engine design

The engine is the heart of morphase.

It contains five main modules:

1. **Registry**
2. **Planner**
3. **Executor**
4. **Doctor**
5. **Job Manager**

### 7.1 Registry

The registry knows:
- which plugins exist,
- what capabilities each plugin supports,
- what platforms each plugin supports,
- how plugins are installed/detected,
- and which plugins are preferred for which routes.

The registry must be mostly metadata-driven.

### 7.2 Planner

The planner takes a normalized request and finds the best plugin or pipeline.

Inputs:
- input type,
- desired output type or operation,
- options,
- platform,
- whether offline-only is required,
- whether the user prefers a specific backend,
- which plugins are installed and healthy.

Outputs:
- selected plugin or pipeline,
- human-readable explanation,
- fallback candidates,
- installation requirements,
- structured execution plan.

### 7.3 Executor

The executor runs the final plan.

Responsibilities:
- path normalization,
- temp directories,
- process execution,
- stdout/stderr capture,
- timeouts,
- output existence checks,
- cleanup,
- structured result creation.

The executor must be backend-agnostic.

### 7.4 Doctor

Doctor checks and explains system health.

Responsibilities:
- detect installed binaries,
- read versions,
- compare against supported version floors,
- verify delegates or dependent binaries when needed,
- suggest install/update commands,
- explain common failures,
- and provide environment diagnostics.

Doctor is a first-class product feature, not an afterthought.

### 7.5 Job Manager

Every operation in morphase must be represented as a job.

Even CLI mode should internally create a job.

Job responsibilities:
- job ID,
- status,
- timestamps,
- selected plugin,
- input/output references,
- logs,
- result artifacts,
- and structured failure info.

This makes the future server and UI easy to add.

---

## 8. Domain model

### 8.1 Resource kinds

morphase should reason about normalized resource kinds, not just file extensions.

Core resource kinds:
- `markdown`
- `html`
- `docx`
- `pptx`
- `xlsx`
- `odt`
- `ods`
- `odp`
- `pdf`
- `txt`
- `jpg`
- `png`
- `webp`
- `heic`
- `mp3`
- `wav`
- `mp4`
- `mov`
- `mkv`
- `url`
- `subtitle`
- `transcript`

### 8.2 Operation kinds

There are two main categories.

#### A. Conversion
Example: `pptx -> pdf`

#### B. Operation
Example: `pdf merge`, `pdf split`, `pdf optimize`

### 8.3 Route model

Suggested shape:

```ts
export type Route =
  | {
      kind: "conversion"
      from: string
      to: string
    }
  | {
      kind: "operation"
      resource: string
      action: string
    }
```

### 8.4 Job request model

```ts
export type JobRequest = {
  input: string | string[]
  from?: string
  to?: string
  operation?: string
  output?: string
  options?: Record<string, unknown>
  backendPreference?: string
  offlineOnly?: boolean
  interactive?: boolean
  debug?: boolean
}
```

### 8.5 Job result model

```ts
export type JobResult = {
  jobId: string
  status: "success" | "failed" | "cancelled"
  backendId?: string
  outputPaths: string[]
  logs: string[]
  warnings?: string[]
  error?: morphaseError
}
```

---

## 9. Plugin architecture

### 9.1 Plugin philosophy

Plugins are the core extensibility mechanism.

morphase must make it easy to:
- add a backend,
- change a backend,
- disable a backend,
- remove a backend,
- and keep backend-specific logic isolated.

### 9.2 Plugin categories

#### Level 1: mostly declarative plugins
Good for backends that are mostly command-template driven:
- FFmpeg
- qpdf
- ImageMagick
- Pandoc
- LibreOffice

#### Level 2: advanced plugins
Good for backends that need richer logic:
- Trafilatura
- MarkItDown
- Docling
- Jina
- yt-dlp
- Whisper

### 9.3 Plugin contract

```ts
export type Platform = "macos" | "windows" | "linux"

export type Capability = {
  kind: "convert" | "extract" | "fetch" | "transform"
  from: string | null
  to: string | null
  operation?: string
  quality: "high" | "medium" | "best_effort"
  offline: boolean
  platforms: Platform[]
  notes?: string[]
}

export type DetectionResult = {
  installed: boolean
  version?: string
  reason?: string
}

export type VerificationResult = {
  ok: boolean
  issues?: string[]
  warnings?: string[]
}

export type InstallHint = {
  manager: "brew" | "winget" | "apt-get" | "manual"
  command?: string
  notes?: string[]
}

export type PlanRequest = {
  input: string | string[]
  from?: string
  to?: string
  operation?: string
  output?: string
  options: Record<string, unknown>
  platform: Platform
  offlineOnly: boolean
}

export type ExecutionPlan = {
  command: string
  args: string[]
  env?: Record<string, string>
  cwd?: string
  tempDirs?: string[]
  expectedOutputs?: string[]
}

export interface morphasePlugin {
  id: string
  name: string
  priority: number

  capabilities(): Capability[]
  detect(platform: Platform): Promise<DetectionResult>
  verify(platform: Platform): Promise<VerificationResult>
  getInstallHints(platform: Platform): InstallHint[]
  plan(request: PlanRequest): Promise<ExecutionPlan | null>
  explain(request: PlanRequest): Promise<string>
}
```

### 9.4 Plugin rules

- Plugins must not own global routing.
- Plugins must only describe their own capabilities.
- Plugins must not mutate external system state without explicit user confirmation.
- Plugins must expose install hints.
- Plugins must expose version detection.
- Plugins must produce normalized execution plans.
- Plugins must surface warnings for lossy or best-effort routes.

### 9.5 Plugin registration

Plugins should be registered explicitly in the engine via a plugin registry file.

Example:

```ts
export const builtinPlugins = [
  pandocPlugin,
  libreOfficePlugin,
  ffmpegPlugin,
  imageMagickPlugin,
  qpdfPlugin,
  trafilaturaPlugin,
]
```

Later, external/community plugins can be supported, but v1 should keep plugins in-repo for stability.

---

## 10. Planner design

### 10.1 Planner goals

The planner must choose the best route without giant hardcoded if/else trees.

### 10.2 Candidate selection

The planner should:
1. normalize the requested route,
2. query registry for candidate plugins,
3. detect installed status,
4. filter out unsupported platform candidates,
5. filter out network backends when `offlineOnly = true`,
6. score remaining candidates,
7. select the best match,
8. return fallbacks if available.

### 10.3 Scoring model

Recommended initial scoring:
- exact route support: `+50`
- preferred backend for that route: `+20`
- plugin installed: `+15`
- plugin verified healthy: `+10`
- offline support when offline requested: `+15`
- high quality route: `+10`
- medium quality route: `+5`
- best effort route: `-20`
- network required when offline requested: reject
- unsupported platform: reject
- missing dependency/delegate: `-30`

### 10.4 Planner output

The planner should return:
- chosen plugin,
- plan request,
- explanation string,
- fallback plugins,
- whether installation is needed,
- warnings.

### 10.5 Pipelines

morphase should support curated multi-step pipelines, but only in a controlled way.

Examples:
- `docx -> pdf -> markdown`
- `youtube-url -> audio -> transcript`

Pipeline support must be explicit, not arbitrary graph search.

Suggested structure:

```ts
export type PlannedStep = {
  pluginId: string
  from: string
  to?: string
  operation?: string
}

export type PipelineDefinition = {
  id: string
  route: Route
  steps: PlannedStep[]
  quality: "high" | "medium" | "best_effort"
}
```

v1 should ship with a very small curated pipeline list.

---

## 11. Executor design

### 11.1 Responsibilities

The executor is responsible for:
- spawning processes,
- normalizing paths,
- temp file management,
- execution timeouts,
- result validation,
- cleanup,
- and returning structured logs/errors.

### 11.2 Execution flow

1. Receive planned step or pipeline.
2. Create temp workspace if needed.
3. Resolve input/output paths.
4. Spawn process.
5. Capture stdout/stderr.
6. Wait for exit.
7. Validate expected outputs.
8. Return result.
9. Clean temp files unless `--debug` or `--keep-temp` is set.

### 11.3 Execution constraints

- Never allow shell injection through unsafe string concatenation.
- Pass command and args separately.
- Always normalize paths per OS.
- Keep output validation mandatory.
- Do not assume success just because exit code is 0.
- Support `dry-run` mode.
- Support `debug` mode.

### 11.4 Logging

Logs should be structured and categorized:
- planner logs,
- doctor logs,
- plugin logs,
- execution logs.

CLI should show concise summaries by default and raw logs in debug mode.

---

## 12. Doctor and backend management

### 12.1 Why doctor is critical

morphase wraps many external tools. This creates environment variability.

To keep maintenance low, morphase must diagnose problems well enough that users can solve most issues themselves.

### 12.2 Doctor commands

```bash
morphase doctor
morphase backend list
morphase backend verify ffmpeg
morphase backend status
morphase backend install ffmpeg
morphase backend update pandoc
```

### 12.3 What doctor should report

For each backend:
- installed or not,
- detected version,
- minimum supported version,
- warnings,
- install hints,
- update hints,
- verify result,
- common problems.

### 12.4 Install/update philosophy

morphase should:
- detect package manager,
- offer install/update commands,
- optionally delegate to package manager after confirmation,
- but **not** silently auto-update system tools.

morphase should not become a package manager.

It should only:
- detect,
- verify,
- explain,
- and nudge.

### 12.5 Package manager detection

Per platform:

#### macOS
Prefer:
1. `brew`
2. manual

#### Windows
Prefer:
1. `winget`
2. manual

#### Ubuntu/Debian
Prefer:
1. `apt-get`
2. `brew` if present
3. manual

### 12.6 Backend metadata registry

Each plugin should expose install/update metadata, for example:

```yaml
ffmpeg:
  detect:
    command: ffmpeg
    args: ["-version"]
  minVersion: 6.0.0
  install:
    macos:
      manager: brew
      command: brew install ffmpeg
    windows:
      manager: winget
      command: winget install Gyan.FFmpeg
    linux:
      manager: apt-get
      command: sudo apt-get install ffmpeg
  update:
    macos:
      command: brew upgrade ffmpeg
    windows:
      command: winget upgrade --id Gyan.FFmpeg
    linux:
      command: sudo apt-get install --only-upgrade ffmpeg
```

Store these hints per plugin, not globally.

---

## 13. Platform abstraction

### 13.1 Goal

All OS-specific behavior must be isolated behind a platform layer.

### 13.2 Responsibilities

The platform module should handle:
- OS detection,
- binary lookup,
- shell/path behavior,
- temp directory creation,
- package manager detection,
- path separator differences,
- quoting nuances,
- executable suffixes.

### 13.3 Rule

No plugin or CLI command should contain ad-hoc `if (process.platform === ...)` logic unless absolutely necessary.

Keep that in the platform layer.

---

## 14. CLI application architecture

### 14.1 CLI responsibilities

The CLI is a thin client.

Its responsibilities:
- parse user input,
- run guided wizard,
- call engine,
- print progress/results,
- print actionable errors,
- support scripting-friendly output formats later.

### 14.2 CLI commands

Initial command set:

```bash
morphase
morphase convert <input> <output>
morphase extract <input> --to <format>
morphase fetch <url> --to <format>
morphase media <input> --to <format>
morphase pdf merge <inputs...> -o <output>
morphase pdf split <input> --pages <range> -o <output>
morphase doctor
morphase backend list
morphase backend verify <backend>
morphase backend install <backend>
morphase backend update <backend>
morphase explain <input> --to <format>
morphase serve
```

### 14.3 Wizard flow details

When user runs just `morphase`, launch guided flow.

Questions:
1. What do you want to do?
2. Which category?
3. Which outcome?
4. Where is your input?
5. Suggested output path?
6. Missing backend? Install/help?
7. Run now?
8. Show result and equivalent direct command.

### 14.4 Output design

Successful output should show:
- chosen backend,
- output location,
- warnings if any,
- equivalent direct command.

Failure output should show:
- what failed,
- likely reason,
- how to fix it,
- fallback if available.

---

## 15. Local API server architecture

### 15.1 Why server mode exists

Server mode exists so the same engine can power:
- a local browser UI,
- homelab deployments,
- future automation tools,
- and scripting integrations.

### 15.2 Server responsibilities

The server is also a thin layer.

Responsibilities:
- expose health and capabilities,
- create jobs,
- return job status,
- return results,
- expose backend info.

### 15.3 Minimal endpoints

```http
GET  /health
GET  /capabilities
GET  /backends
GET  /backends/:id
POST /jobs
GET  /jobs/:id
GET  /jobs/:id/logs
GET  /jobs/:id/result
```

### 15.4 Security defaults

Default server mode must bind to `127.0.0.1` only.

Do not expose to LAN/public network by default.

Later phases can add:
- LAN mode,
- auth,
- reverse proxy docs,
- multi-user support.

---

## 16. Future web UI architecture

### 16.1 UI design principles

The UI must be backend-agnostic.

Users should select outcomes, not tools.

Good UI examples:
- Convert PPTX to PDF
- Convert Website to Markdown
- Convert Video to MP3
- Merge PDFs
- Extract transcript

Bad UI examples:
- Run Pandoc
- Run FFmpeg
- Run qpdf

### 16.2 UI capabilities

Initial future UI should support:
- file upload or local file selection flow,
- category picker,
- route picker,
- output selection,
- job status,
- logs/errors,
- download result,
- backend status view.

---

## 17. Backends and plugin matrix

This section defines the initial official backend set.

### 17.1 Pandoc plugin

#### Purpose
Structured document and markup conversion.

#### Primary capabilities
- `md -> pdf`
- `md -> docx`
- `html -> pdf`
- `html -> md`
- `html -> docx` (optional)

#### Notes
- Great for markup and structured text workflows.
- PDF generation may require an available PDF engine depending on chosen route.
- Treat Pandoc as a first-class plugin for markup/document transformations.

#### Plugin ID
`pandoc`

### 17.2 LibreOffice plugin

#### Purpose
Office-family document conversion, especially to PDF.

#### Primary capabilities
- `docx -> pdf`
- `pptx -> pdf`
- `xlsx -> pdf`
- `odt -> pdf`
- `ods -> pdf`
- `odp -> pdf`

#### Notes
- Best for Office-family rendering and export.
- Complex fidelity is still best-effort.
- Use CLI filter names where needed.

#### Plugin ID
`libreoffice`

### 17.3 qpdf plugin

#### Purpose
PDF-native structural operations.

#### Primary capabilities
- `pdf merge`
- `pdf split`
- `pdf optimize`
- `pdf inspect` (optional)

#### Notes
- qpdf is not a rendering or text-extraction backend.
- It is ideal for content-preserving transformations.

#### Plugin ID
`qpdf`

### 17.4 ImageMagick plugin

#### Purpose
Image conversion and basic image transformations.

#### Primary capabilities
- `jpg -> png`
- `png -> jpg`
- `webp -> png`
- `webp -> jpg`
- `heic -> jpg` (best effort)
- `heic -> png` (best effort)

#### Notes
- Delegate support varies by installation.
- Doctor must verify formats/delegates where possible.

#### Plugin ID
`imagemagick`

### 17.5 FFmpeg plugin

#### Purpose
Audio/video conversion.

#### Primary capabilities
- `mp4 -> mp3`
- `mov -> mp4`
- `mkv -> mp4`
- `wav -> mp3`
- `mp3 -> wav`

#### Notes
- Should be the default media backend.
- Expose clear warnings for lossy codec changes.

#### Plugin ID
`ffmpeg`

### 17.6 Trafilatura plugin

#### Purpose
Website/article extraction to Markdown or text.

#### Primary capabilities
- `url -> markdown`
- `url -> txt`

#### Notes
- Local-first default for website extraction.
- Strong fit for article/news/blog pages.

#### Plugin ID
`trafilatura`

### 17.7 MarkItDown plugin

#### Purpose
General-purpose file/URL to Markdown extraction.

#### Primary capabilities
- `pdf -> markdown`
- office docs -> markdown
- `html -> markdown`
- `youtube-url -> markdown` (optional)

#### Notes
- Good lightweight markdown-extraction backend.
- Should not replace Pandoc for structured authoring conversions.

#### Plugin ID
`markitdown`

### 17.8 Docling plugin

#### Purpose
Higher-quality and richer document extraction.

#### Primary capabilities
- `pdf -> markdown`
- `docx -> markdown`
- `pptx -> markdown`
- `html -> markdown`
- OCR-backed extraction where supported

#### Notes
- More powerful, heavier, and more advanced than MarkItDown.
- Best for harder document extraction cases.

#### Plugin ID
`docling`

### 17.9 Jina plugin

#### Purpose
Optional remote fallback for URL extraction.

#### Primary capabilities
- `url -> markdown`

#### Notes
- Network-backed.
- Must be opt-in or clearly disclosed.
- Never default over a local backend when offline/local-first is desired.

#### Plugin ID
`jina`

### 17.10 yt-dlp plugin

#### Purpose
Optional URL media acquisition plugin.

#### Primary capabilities
- `youtube-url -> mp4`
- `youtube-url -> mp3`
- `youtube-url -> subtitles`

#### Notes
- Optional plugin, not part of the default “safe core.”
- Must be clearly framed as user-responsibility for rights/terms compliance.

#### Plugin ID
`ytdlp`

### 17.11 Whisper plugin

#### Purpose
Optional local transcription.

#### Primary capabilities
- `audio/video -> transcript`

#### Suggested sub-backends
- `whisper.cpp`
- `faster-whisper`

#### Notes
- Optional plugin family.
- Should be designed as another plugin layer or internal strategy selection.

#### Plugin ID
`whisper`

---

## 18. Backend priority recommendations

Use these defaults.

### 18.1 Route preferences

#### `md -> pdf`
1. `pandoc`

#### `docx -> pdf`
1. `libreoffice`

#### `pptx -> pdf`
1. `libreoffice`

#### `pdf -> markdown`
1. `markitdown` for lightweight default
2. `docling` for higher quality / advanced cases

#### `url -> markdown`
1. `trafilatura`
2. `jina` only as explicit network fallback

#### media conversions
1. `ffmpeg`

#### PDF structural operations
1. `qpdf`

#### image conversions
1. `imagemagick`

---

## 19. Installation strategy

### 19.1 Install model

morphase should install only the **core product** first.

It should **not** install every backend upfront.

### 19.2 Core install paths

#### v1 official paths
- npm global install for CLI
- Docker image for self-hosted/server mode

### 19.3 On-demand backend installation

When a user requests an operation:
1. detect required backend,
2. verify whether backend is installed,
3. if not installed, offer install/help,
4. if installed but unhealthy, explain fix,
5. rerun.

### 19.4 Why lazy installation is required

This keeps:
- initial install small,
- maintenance low,
- and user onboarding lighter.

It also avoids forcing every user to install large tools like LibreOffice or FFmpeg if they never need them.

---

## 20. Error handling architecture

### 20.1 Product philosophy

morphase should own **diagnosis**, not magical repair.

When something breaks, morphase should:
- say what failed,
- say why,
- tell the user how to fix it,
- and offer fallback where possible.

### 20.2 Error categories

Suggested normalized errors:
- `INPUT_NOT_FOUND`
- `INVALID_INPUT`
- `UNSUPPORTED_ROUTE`
- `BACKEND_NOT_INSTALLED`
- `BACKEND_VERSION_UNSUPPORTED`
- `BACKEND_VERIFY_FAILED`
- `BACKEND_EXECUTION_FAILED`
- `OUTPUT_NOT_PRODUCED`
- `NETWORK_REQUIRED`
- `PERMISSION_DENIED`
- `PIPELINE_STEP_FAILED`

### 20.3 Error shape

```ts
export type morphaseError = {
  code: string
  message: string
  likelyCause?: string
  suggestedFixes?: string[]
  backendId?: string
  rawStdout?: string
  rawStderr?: string
}
```

### 20.4 Failure UX example

Good failure message:

- Backend: FFmpeg
- Problem: FFmpeg not found on this system
- To fix on macOS: `brew install ffmpeg`
- To fix on Windows: `winget install Gyan.FFmpeg`
- To fix on Ubuntu/Debian: `sudo apt-get install ffmpeg`
- Then rerun the same command

This kind of guidance is essential for low maintenance.

---

## 21. Security, legal, and privacy posture

### 21.1 Security posture

- Local-first by default
- No network requirement for core routes
- Server binds to localhost by default
- No silent remote upload
- No arbitrary code execution from plugins outside the trusted plugin set in v1

### 21.2 Privacy posture

- File conversions happen locally whenever possible
- Network-backed plugins must be clearly disclosed
- Jina and yt-dlp-like plugins must be explicitly identified as networked features

### 21.3 Legal posture

morphase must be positioned as:
- a local conversion router,
- not a rights-granting tool,
- not a DRM bypass tool,
- not a piracy-first product.

URL/media fetch plugins should be optional and explicitly user-responsibility.

---

## 22. Configuration system

### 22.1 Config file

morphase should support a user config file, for example:

```text
~/.morphase/config.json
```

### 22.2 Config scope

Store:
- backend preferences,
- offline-only default,
- debug preferences,
- UI/server port,
- local paths,
- telemetry opt-in if ever added,
- whether automatic package-manager delegation is allowed after prompt.

### 22.3 Example config

```json
{
  "offlineOnly": true,
  "preferredBackends": {
    "pdf_to_markdown": "docling",
    "url_to_markdown": "trafilatura"
  },
  "server": {
    "host": "127.0.0.1",
    "port": 3210
  }
}
```

---

## 23. Testing strategy

### 23.1 Testing layers

#### Unit tests
For:
- planner scoring,
- route normalization,
- config parsing,
- plugin metadata validation,
- platform detection logic.

#### Plugin tests
For:
- command planning,
- detection,
- version parsing,
- verify logic.

#### Integration tests
For:
- real backend invocation when available,
- end-to-end route tests,
- doctor behavior,
- CLI flows.

#### Snapshot tests
For:
- error output,
- explain output,
- wizard prompts where appropriate.

### 23.2 CI strategy

CI should:
- run core tests on macOS, Windows, and Linux,
- run backend integration tests only when tool is installed or provisioned,
- not require every heavy backend on every CI job,
- use a matrix strategy.

### 23.3 Golden-route tests

Create a small fixture set and validate key routes:
- markdown -> pdf
- docx -> pdf
- pptx -> pdf
- jpg -> png
- mp4 -> mp3
- url -> markdown
- pdf merge
- pdf split

---

## 24. Documentation requirements

The repo must include:
- README
- architecture.md
- plugin-authoring.md
- support-matrix.md
- route-matrix.md
- legal-notes.md
- examples/

### 24.1 README must include

- what morphase is,
- what it supports,
- how to install core CLI,
- how to run guided mode,
- common direct commands,
- how backend installation works,
- how to use doctor,
- and future self-hosted/server mode.

### 24.2 Route matrix doc

List:
- supported routes,
- preferred backend,
- quality,
- whether local-only,
- whether optional.

---

## 25. Dependency and maintenance strategy

### 25.1 Core repo dependencies

Use automated dependency update tooling for morphase’s own codebase.

Recommended:
- Dependabot or Renovate

### 25.2 External backend maintenance policy

morphase should **not** track every upstream release manually.

Instead:
- store minimum supported versions,
- store tested ranges when useful,
- detect versions at runtime,
- warn if unsupported or unknown,
- and rely on package managers for backend installation and updates.

### 25.3 Low-maintenance rules

To keep the project maintainable:
- keep the official support matrix narrow,
- keep plugins metadata-driven,
- keep doctor excellent,
- keep install/update hints per plugin,
- avoid auto-updating system tools silently,
- do not promise perfect fidelity,
- and add routes only when there is a clear backend and testing path.

---

## 26. Recommended implementation stack

### 26.1 Language and runtime

- **TypeScript**
- **Node.js**

### 26.2 Recommended libraries

#### Core
- `typescript`
- `zod`
- `execa` or equivalent
- `commander` or `oclif`
- `prompts` or `inquirer`
- `fastify` or `express` for server

#### Quality of life
- logging library of choice
- test runner of choice (Vitest preferred if staying in TS ecosystem)
- workspace tooling (pnpm recommended)

### 26.3 Why TypeScript

Because morphase is mostly:
- orchestration,
- config,
- routing,
- process control,
- and interface design.

It is not compute-heavy enough to require a lower-level language in v1.

---

## 27. Phased build plan

This section is the canonical implementation order.

### Phase 0 — Repository and foundations

Goal: create the monorepo and core scaffolding.

Tasks:
- create monorepo,
- set up TypeScript,
- set up shared package,
- set up engine package,
- set up plugin-sdk,
- set up CLI app,
- set up test runner,
- set up linting/formatting,
- add base README,
- add Dependabot or Renovate.

Deliverables:
- repo boots,
- CLI prints hello and loads engine,
- plugin registration system exists.

### Phase 1 — Core engine primitives

Goal: implement routing primitives without real backends.

Tasks:
- route model,
- job model,
- registry,
- planner,
- executor abstraction,
- error model,
- platform detection,
- config loading.

Deliverables:
- engine can accept a normalized request,
- planner can choose among fake plugins,
- executor can run a mocked plan.

### Phase 2 — First real plugins

Goal: support core real-world routes.

Implement these official plugins first:
- `pandoc`
- `libreoffice`
- `ffmpeg`
- `imagemagick`
- `qpdf`
- `trafilatura`

Tasks:
- implement plugin metadata,
- implement detect/verify,
- implement plan builders,
- add install hints,
- add plugin tests.

Deliverables:
- real direct routes work end-to-end,
- doctor can report backend health.

### Phase 3 — CLI UX

Goal: make the product usable.

Tasks:
- `morphase convert`
- `morphase extract`
- `morphase fetch`
- `morphase media`
- `morphase pdf ...`
- `morphase doctor`
- `morphase backend list/verify/install/update`
- `morphase explain`
- interactive wizard for `morphase`

Deliverables:
- beginner-friendly interactive CLI,
- scriptable power-user CLI.

### Phase 4 — Doctor and troubleshooting polish

Goal: reduce support burden.

Tasks:
- version parsing,
- package-manager detection,
- install/update hint generation,
- common failure message templates,
- debug logging,
- fallback suggestions.

Deliverables:
- strong self-diagnosis UX,
- lower maintenance for the maintainer.

### Phase 5 — Additional extraction plugins

Goal: broaden document extraction capabilities.

Add:
- `markitdown`
- `docling`
- `jina` (optional)

Tasks:
- richer route preferences,
- `pdf -> markdown` backend selection,
- `url -> markdown` fallback logic,
- network/offline warnings.

Deliverables:
- better Markdown extraction workflows.

### Phase 6 — Optional media acquisition and transcription

Goal: add optional advanced workflows.

Add:
- `ytdlp`
- `whisper`

Tasks:
- opt-in plugin registration,
- rights/terms disclaimer messaging,
- local transcription pipeline,
- curated `youtube-url -> transcript` style flows if desired.

Deliverables:
- optional extended media workflows.

### Phase 7 — Local API server

Goal: make morphase UI-ready.

Tasks:
- implement `morphase serve`,
- create Fastify/Express server,
- expose health/capabilities/backends/jobs endpoints,
- persist job state in memory first,
- allow local browser integration.

Deliverables:
- local API server that reuses engine.

### Phase 8 — Web UI

Goal: add local/self-hosted browser experience.

Tasks:
- route picker UI,
- job creation UI,
- progress/results UI,
- backend health view,
- local-only default host behavior,
- Dockerized self-hosted setup.

Deliverables:
- local browser-based morphase interface.

### Phase 9 — Packaging and polish

Goal: improve distribution.

Tasks:
- npm package polish,
- Docker image,
- optional Homebrew formula later,
- optional WinGet package later,
- support matrix docs,
- fixtures/examples.

Deliverables:
- more polished distribution and adoption.

---

## 28. Suggested implementation priorities for coding agents

If handing this to Claude or Codex, instruct it to implement in this order:

1. repository structure,
2. shared types/schemas,
3. engine core,
4. plugin SDK,
5. fake/demo plugin tests,
6. real core plugins,
7. CLI direct commands,
8. doctor,
9. interactive wizard,
10. server mode,
11. advanced plugins,
12. UI.

### 28.1 Coding rules for the implementing agent

- Do not hardcode route decisions in CLI files.
- Put all routing in the planner.
- Keep plugin logic isolated.
- Keep platform logic isolated.
- Keep error messages structured and actionable.
- Prefer metadata-driven behavior wherever possible.
- Keep tests close to plugins and core engine modules.
- Avoid over-engineering external plugin loading in v1.
- Keep public APIs clean and well-typed.

---

## 29. Example route decisions

### Example 1: `pptx -> pdf`

1. CLI receives request.
2. Engine normalizes route.
3. Registry finds `libreoffice` plugin.
4. Planner selects `libreoffice` as preferred backend.
5. Doctor verifies `soffice` exists.
6. Executor runs plan.
7. Result returned.

### Example 2: `url -> markdown`

1. CLI receives URL.
2. Engine normalizes route.
3. Registry finds `trafilatura`, maybe `jina`, maybe `markitdown`.
4. Planner chooses `trafilatura` by default if installed and offline-compatible.
5. If user requested network fallback or local backend unavailable, planner may propose `jina`.
6. Executor runs chosen plugin.

### Example 3: `pdf -> markdown`

1. Registry finds `markitdown` and `docling`.
2. Planner prefers `markitdown` for lighter default or `docling` when quality preference is configured.
3. If one backend is missing, planner falls back to the other.
4. If both are unavailable, doctor suggests install paths.

---

## 30. Minimal viable v1 checklist

morphase v1 is “good” when all of the following are true:

- user can install core CLI,
- `morphase` launches a guided wizard,
- `morphase doctor` works,
- `morphase explain` works,
- `md -> pdf` works,
- `docx -> pdf` works,
- `pptx -> pdf` works,
- `jpg -> png` works,
- `mp4 -> mp3` works,
- `url -> markdown` works,
- `pdf merge` works,
- missing backends produce helpful fix instructions,
- direct commands are scriptable,
- engine is reusable by server mode.

---

## 31. Post-v1 roadmap ideas

Possible future features after core stability:
- community plugin system,
- route aliases,
- batch conversion,
- watched folders,
- queueing,
- browser drag-and-drop UI,
- Docker Compose self-hosted stack,
- output presets,
- profile-based workflows,
- richer pipelines,
- OCR presets,
- subtitle/transcript formatting modes,
- JSON API output mode.

---

## 32. Final guidance

morphase succeeds if it remains:
- opinionated,
- consistent,
- transparent,
- local-first,
- and easy to troubleshoot.

The main failure mode to avoid is turning morphase into a giant unstable “everything converter.”

The correct strategy is:
- keep the core clean,
- keep the support matrix narrow,
- keep plugins isolated,
- keep routing metadata-driven,
- and grow capabilities only where there is a strong backend and testable route.

If implemented this way, morphase can become:
- a very useful CLI,
- a strong self-hosted utility,
- a great developer tool,
- and a low-maintenance open-source project.

