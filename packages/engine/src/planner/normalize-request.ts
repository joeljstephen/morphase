import fs from "node:fs";
import path from "node:path";

import { deriveOperationOutputPath, deriveOutputPath, extensionForResourceKind, inferResourceKind, isUrl } from "@muxory/shared";
import type { JobRequest, PlanRequest, ResourceKind, Route } from "@muxory/shared";

import { createError } from "../errors/muxory-error.js";
import { detectPlatform } from "../platform/platform.js";

function invocationCwd(): string {
  if (process.env.MUXORY_CWD) {
    return process.env.MUXORY_CWD;
  }

  if (process.env.INIT_CWD) {
    return process.env.INIT_CWD;
  }

  const cwd = process.cwd();
  const repoRoot = path.resolve(cwd, "..", "..");
  if (
    path.basename(cwd) === "cli" &&
    path.basename(path.dirname(cwd)) === "apps" &&
    fs.existsSync(path.join(repoRoot, "pnpm-workspace.yaml"))
  ) {
    return repoRoot;
  }

  return cwd;
}

function resolveInputPath(input: string): string {
  const inferred = inferResourceKind(input);
  if (inferred === "url" || inferred === "youtube-url") {
    return input;
  }

  return path.resolve(invocationCwd(), input);
}

function resolveOutputPath(
  output: string | undefined,
  input: string | string[],
  to: ResourceKind
): string | undefined {
  if (!output) {
    return undefined;
  }

  const resolved = path.resolve(invocationCwd(), output);

  const isExistingDir = (() => {
    try {
      return fs.statSync(resolved).isDirectory();
    } catch {
      return false;
    }
  })();

  if (isExistingDir || output.endsWith("/") || output.endsWith(path.sep)) {
    return deriveOutputInDir(resolved, input, to);
  }

  if (!path.extname(resolved)) {
    return deriveOutputInDir(resolved, input, to);
  }

  return resolved;
}

function deriveOutputInDir(dir: string, input: string | string[], to: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const ext = extensionForResourceKind(to);

  if (isUrl(first)) {
    try {
      const parsed = new URL(first);
      const name = parsed.searchParams.get("v")
        || parsed.pathname.split("/").filter(Boolean).pop()
        || "output";
      return path.join(dir, `${name}${ext}`);
    } catch {
      return path.join(dir, `output${ext}`);
    }
  }

  const filePath = path.parse(first);
  return path.join(dir, `${filePath.name}${ext}`);
}

function normalizeInput(input: string | string[]): string | string[] {
  return Array.isArray(input) ? input.map(resolveInputPath) : resolveInputPath(input);
}

function ensureOutputDiffersFromInput(output: string, input: string | string[]): string {
  const first = Array.isArray(input) ? input[0] : input;
  if (path.resolve(output) === path.resolve(first)) {
    const parsed = path.parse(output);
    return path.join(parsed.dir, `${parsed.name}_compressed${parsed.ext}`);
  }
  return output;
}

export function normalizeRequest(
  request: JobRequest,
  defaults: { offlineOnly: boolean }
): {
  route: Route;
  planRequest: Omit<PlanRequest, "route" | "platform" | "options" | "offlineOnly"> & {
    output: string;
    options: Record<string, unknown>;
  };
} {
  const normalizedInput = normalizeInput(request.input);
  const from = request.from ?? inferResourceKind(Array.isArray(normalizedInput) ? normalizedInput[0] : normalizedInput);
  const to = request.to;

  if (request.operation) {
    if (!from) {
      throw createError({
        code: "INVALID_INPUT",
        message: "Muxory could not determine the resource kind for this operation.",
        suggestedFixes: ["Pass --from explicitly to help route the request."]
      });
    }

    return {
      route: {
        kind: "operation",
        resource: from,
        action: request.operation
      },
      planRequest: {
        input: normalizedInput,
        from,
        output: ensureOutputDiffersFromInput(
          resolveOutputPath(request.output, normalizedInput, from) ?? deriveOperationOutputPath(normalizedInput, from),
          normalizedInput
        ),
        operation: request.operation,
        options: request.options ?? {}
      }
    };
  }

  if (!from || !to) {
    throw createError({
      code: "INVALID_INPUT",
      message: "Muxory needs both the input kind and the desired output kind.",
      suggestedFixes: [
        "Pass --from and --to explicitly.",
        "Use a file extension Muxory can infer."
      ]
    });
  }

  return {
      route: {
        kind: "conversion",
        from,
        to
      },
      planRequest: {
        input: normalizedInput,
        from,
        to,
        output: resolveOutputPath(request.output, normalizedInput, to) ?? deriveOutputPath(normalizedInput, to),
        options: request.options ?? {}
      }
    };
}

export function toPlanRequest(
  request: JobRequest,
  normalized: ReturnType<typeof normalizeRequest>,
  offlineOnly: boolean = false
): PlanRequest {
  return {
    ...normalized.planRequest,
    route: normalized.route,
    platform: detectPlatform(),
    offlineOnly: request.offlineOnly ?? offlineOnly
  };
}

export function preferredRouteKey(from: ResourceKind, to: ResourceKind): string {
  return `${from}->${to}`;
}
