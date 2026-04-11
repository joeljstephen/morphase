# Plugin Authoring

Builtin plugins live in `packages/plugins/<plugin>/src/index.ts`.

Each plugin must:

- expose `id`, `name`, and `priority`
- declare normalized capabilities
- implement `detect()` and `verify()`
- provide install/update hints
- build an `ExecutionPlan`
- explain why it is appropriate for a route

Plugin rules:

- keep routing decisions out of CLI files
- keep global routing decisions out of plugins
- avoid mutating system state without explicit user intent
- keep backend-specific quirks, warnings, and install metadata inside the plugin

Use `definePlugin()` from `@muxory/plugin-sdk` to keep plugin declarations consistent.

