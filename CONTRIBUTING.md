# Contributing to Morphase

Thank you for your interest in contributing.

## Setup

```bash
git clone https://github.com/anomalyco/morphase.git
cd morphase
pnpm install
pnpm build
pnpm test
```

## Development

```bash
pnpm dev          # Run CLI in dev mode
pnpm build        # Build all packages
pnpm typecheck    # TypeScript check
pnpm test         # Run tests
pnpm test:watch   # Run tests in watch mode
```

## Architecture

Morphase uses a shared-engine, plugin-based architecture. See [docs/architecture.md](docs/architecture.md) for the full overview.

Key rules:
- Engine logic stays in the engine package.
- CLI and server are thin clients.
- Plugins isolate backend-specific behavior.
- No business logic in CLI files.

## Pull Requests

1. Fork the repository.
2. Create a feature branch.
3. Make your changes with tests.
4. Run `pnpm build && pnpm typecheck && pnpm test`.
5. Open a pull request with a clear description.

## Reporting Issues

Use GitHub Issues. Include:
- Morphase version (`morphase --version` or check package.json)
- OS and package manager
- Steps to reproduce
- Expected vs actual behavior
- Output of `morphase doctor` if relevant

## Adding a Plugin

See [docs/plugin-authoring.md](docs/plugin-authoring.md) for the plugin contract, SDK helpers, and conventions.

## Code of Conduct

See [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
