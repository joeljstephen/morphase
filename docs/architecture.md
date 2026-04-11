# Architecture

Muxory follows the architecture defined in `muxory_spec.md`:

- CLI and server are thin clients.
- The engine owns routing, planning, execution, doctoring, and job tracking.
- Plugins isolate backend-specific behavior.
- Shared types and schemas keep the public surface consistent.

The core runtime flow is:

1. The interface builds a `JobRequest`.
2. The engine normalizes it into a route.
3. The planner scores candidate plugins from the registry.
4. The doctor/detection path informs install and verify state.
5. The executor runs the selected plan and validates outputs.
6. The job manager stores logs, warnings, timestamps, and results.

The server and CLI both call the same `MuxoryEngine` entry point, which is the product's main architectural rule.

