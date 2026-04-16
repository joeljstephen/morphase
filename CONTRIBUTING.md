# Contributing to Morphase

Thanks for your interest in contributing. Morphase is a CLI-first, local-first conversion router, and it's happy to have external contributors.

## Setup

```bash
git clone https://github.com/joeljstephen/morphase.git
cd morphase
pnpm install
pnpm build
pnpm test
```

You'll also want at least one backend installed on your system (FFmpeg, Pandoc, LibreOffice, etc.) to exercise real routes end-to-end. Run `pnpm dev -- doctor` to see what Morphase detects.

## Development commands

```bash
pnpm dev          # Run the CLI in dev mode (tsx)
pnpm build        # Build all packages (tsup)
pnpm typecheck    # TypeScript check across all packages
pnpm test         # Run the test suite (vitest)
pnpm test:watch   # Run tests in watch mode
```

## Architecture in one paragraph

Morphase is a pnpm monorepo with a thin CLI and a shared engine. The engine owns routing, planning, execution, and diagnostics. Plugins isolate backend-specific behavior — each wraps one external tool (FFmpeg, Pandoc, LibreOffice, …) and declares what routes it can handle. Network-backed routes are explicit and opt-in.

See [docs/architecture.md](docs/architecture.md) for the full walkthrough.

Key rules:

- Engine logic stays in the engine package.
- CLI code stays thin — no business logic, no routing decisions.
- Plugins declare capabilities; the planner decides which one runs.
- No mutating system state without explicit user intent.

## Pull requests

1. Fork the repository.
2. Create a feature branch.
3. Make your changes, with tests if you're adding behavior.
4. Run `pnpm build && pnpm typecheck && pnpm test`.
5. Open a PR with a clear description of what changed and why.

Small, focused PRs are much easier to review than large ones. If you're planning something big, open an issue or draft PR first to discuss the shape.

## Reporting issues

Please use GitHub Issues. Include:

- Morphase version (or commit SHA if running from source).
- OS and package manager.
- Steps to reproduce.
- Expected vs actual behavior.
- Output of `morphase doctor` if the issue involves a backend.
- `--debug` output if the issue involves execution.

## Adding a plugin

See [docs/plugin-authoring.md](docs/plugin-authoring.md) for the plugin contract, SDK helpers, conventions, and guidance on whether a plugin belongs in the main repo or as a community plugin.

## Security

Please do not file public issues for security vulnerabilities. See [SECURITY.md](SECURITY.md) for how to report them privately.

## Code of conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
