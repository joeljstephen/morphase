# Contributing To Morphase

Morphase is a CLI-first, local-first router for file conversion, extraction, fetches, and document operations. Contributions are welcome, but correctness matters more than churn. Small, well-tested changes are much easier to review and release.

## Setup

The repo is pinned to `pnpm@10.2.0`, so use Corepack locally:

```bash
git clone https://github.com/joeljstephen/morphase.git
cd morphase
corepack pnpm install
corepack pnpm build
corepack pnpm test
```

For end-to-end route checks, install at least one real backend such as `pandoc`, `ffmpeg`, or `libreoffice`, then run:

```bash
corepack pnpm dev -- doctor
```

## Development Commands

```bash
corepack pnpm dev          # Run the CLI in dev mode (tsx)
corepack pnpm build        # Build all workspace packages
corepack pnpm typecheck    # TypeScript checks across the repo
corepack pnpm test         # Run the Vitest suite
corepack pnpm test:watch   # Watch mode
```

## Project Shape

Morphase is a pnpm monorepo with:

- a thin CLI in `apps/cli`
- a shared engine in `packages/engine`
- shared types and utilities in `packages/shared`
- one plugin per backend in `packages/plugins/*`

The engine owns routing, planning, execution, diagnostics, and runtime environment detection. Plugins describe backend capabilities, install/update strategies, and execution plans.

See [docs/architecture.md](docs/architecture.md) for the full walkthrough.

## Working Rules

- Keep routing and planning logic in the engine, not in the CLI.
- Keep backend-specific behavior inside plugins.
- Prefer shared helpers over duplicated install-guidance logic.
- Do not add guessed package-manager commands for environments the plugin cannot support confidently.
- Keep docs and CLI output aligned when changing routes, install guidance, or user-facing wording.
- Do not mutate the user's system without explicit intent. Package-manager delegation stays opt-in.

## Tests And Verification

If you change behavior, add or update tests that protect the real behavior you changed.

Priority areas:

- route normalization
- planner selection and fallbacks
- runtime environment detection
- install/update guidance
- CLI-facing error and doctor output

Before opening a PR, run:

```bash
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test
```

## Pull Requests

1. Fork the repository.
2. Create a focused branch.
3. Make the change with tests and docs when needed.
4. Run the full verification commands above.
5. Open a PR that explains what changed, why it changed, and how you verified it.

If the change affects routes, backend install guidance, or plugin behavior, include that explicitly in the PR description.

## Reporting Bugs

Please use GitHub Issues and include:

- Morphase version or commit SHA
- operating system and package manager
- the exact command you ran
- expected behavior and actual behavior
- output of `morphase doctor` or `morphase backend verify <id>` when the issue involves a backend
- `--debug` output when the issue involves execution planning or command failures

## Adding Or Updating A Plugin

See [docs/plugin-authoring.md](docs/plugin-authoring.md) for the plugin contract, shared helpers, install strategy model, and conventions for built-in plugins.

## Security

Do not file public issues for security vulnerabilities. Follow [SECURITY.md](SECURITY.md) instead.

## Code Of Conduct

All contributors are expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
