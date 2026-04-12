# Test Strategy

## Philosophy

Fewer tests, higher signal. We do not chase coverage percentages. Tests exist to protect core architecture and release-critical flows, not to enumerate every code path.

## What the test suite covers

### Request normalization (`normalize-request.test.ts`)

- File extension → resource kind inference (e.g. `slides.pptx` → `pptx`)
- YouTube URL detection (watch URLs, short links) → `youtube-url` kind
- Generic HTTP URLs → `url` kind
- Output path derivation from input (video ID → filename)
- Explicit `from` overrides
- Invalid input handling

### Planner (`planner.test.ts`)

- Route candidate selection among multiple matching plugins
- Preferred backend ordering (summarize > yt-dlp for transcripts)
- Fallback when preferred backend is not installed
- Offline rejection and `installNeeded` flag reporting
- Pipeline assembly when no direct candidate exists (e.g. PDF → TXT via Markdown)
- Equivalent `morphase fetch` command generation for URL routes

### Error enrichment (`youtube.test.ts`)

- yt-dlp errors: format unavailable, video unavailable, bot detection, FFmpeg missing, missing subtitle files
- Summarize errors: unsupported Node version, no transcript available

### Doctor reports (`youtube.test.ts`)

- Backend installed/not installed detection
- Healthy/unhealthy verification status
- Install hint availability

### Plugin metadata and capabilities (`plugins.test.ts`)

- Stable plugins (pandoc, trafilatura, summarize, yt-dlp) declare expected capabilities
- Plan generation for supported routes returns correct commands and arguments
- Unsupported routes return `null`
- Install hints are present and meaningful

### URL detection (`youtube.test.ts`)

- YouTube URL matching (youtube.com, youtu.be, m.youtube.com)
- Media URL matching (Instagram, TikTok, Facebook, Twitter/X, Reddit, Vimeo, Twitch, SoundCloud, Dailymotion)
- Negative cases: generic URLs and non-URL strings rejected

## What is NOT tested

| Area | Reason |
|---|---|
| Actual external binary execution | Requires real tools (pandoc, yt-dlp, ffmpeg) installed on the host |
| CLI formatting / ANSI color output | Cosmetic; not worth the maintenance burden |
| Server endpoints | Experimental feature, low priority |
| Exhaustive per-plugin plan generation | Representative coverage across key routes is sufficient |

## Running tests

```bash
pnpm test              # run all tests
pnpm test -- --watch   # watch mode
pnpm typecheck         # TypeScript type checking
```

No real external binaries are required. All tests run offline.

## Test utilities

- **Mock plugins** are created via the `createPlugin()` helper (see `planner.test.ts`) and `createStubPlugin()` (see `youtube.test.ts`), which provide sensible defaults for every `MorphasePlugin` field
- **No network calls** — all URL detection and planning logic is pure
- **No filesystem dependencies** — no temp directories or file I/O required beyond what Vitest provides
