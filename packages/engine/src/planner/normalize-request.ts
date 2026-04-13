import fs from "node:fs";
import path from "node:path";

import { deriveOperationOutputPath, deriveOutputPath, extensionForResourceKind, inferResourceKind, isUrl } from "@morphase/shared";
import type { JobRequest, PlanRequest, ResourceKind, Route } from "@morphase/shared";

import { createError } from "../errors/morphase-error.js";
import { detectPlatform } from "../platform/platform.js";

function invocationCwd(): string {
  if (process.env.MORPHASE_CWD) {
    return process.env.MORPHASE_CWD;
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
  if (inferred === "url" || inferred === "youtube-url" || inferred === "media-url") {
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
    return `${resolved}${extensionForResourceKind(to)}`;
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

function localInputs(input: string | string[]): string[] {
  return (Array.isArray(input) ? input : [input]).filter((item) => !isUrl(item));
}

function ensureLocalInputsExist(input: string | string[]): void {
  const missing = localInputs(input).filter((item) => !fs.existsSync(item));
  if (missing.length === 0) {
    return;
  }

  throw createError({
    code: "INVALID_INPUT",
    message:
      missing.length === 1
        ? `Input file was not found: ${missing[0]}`
        : `Some input files were not found: ${missing.join(", ")}`,
    suggestedFixes: [
      "Check the file path and current working directory.",
      "Pass an absolute path if the file is outside the current directory."
    ]
  });
}

const imageResourceKinds: import("@morphase/shared").ResourceKind[] = ["jpg", "png", "webp"];

function validateMultiImageInput(input: string | string[], to: import("@morphase/shared").ResourceKind | undefined): void {
  if (to !== "pdf" || !Array.isArray(input) || input.length <= 1) {
    return;
  }

  const nonImageInputs = input.filter((item) => {
    if (isUrl(item)) {
      return true;
    }
    const kind = inferResourceKind(item);
    return !kind || !imageResourceKinds.includes(kind);
  });

  if (nonImageInputs.length > 0) {
    throw createError({
      code: "INVALID_INPUT",
      message: `Some input files are not images: ${nonImageInputs.join(", ")}`,
      suggestedFixes: [
        "Only JPG, PNG, and WebP images can be combined into a PDF.",
        "Remove non-image files from the input list."
      ]
    });
  }
}

function outputMatchesInput(output: string, input: string | string[]): boolean {
  return localInputs(input).some((item) => path.resolve(output) === path.resolve(item));
}

function assertSafeOutputPath(output: string, input: string | string[], force = false): void {
  if (outputMatchesInput(output, input)) {
    throw createError({
      code: "INVALID_INPUT",
      message: "Output path must differ from the input path.",
      suggestedFixes: [
        "Choose a different output path.",
        "Omit -o/--output to let morphase derive a safe default."
      ]
    });
  }

  if (!force && fs.existsSync(output)) {
    throw createError({
      code: "OUTPUT_EXISTS",
      message: `Refusing to overwrite existing output: ${output}`,
      suggestedFixes: [
        "Pass --force to overwrite the existing file.",
        "Choose a different output path."
      ]
    });
  }
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
  ensureLocalInputsExist(normalizedInput);
  validateMultiImageInput(normalizedInput, request.to);
  const from = request.from ?? inferResourceKind(Array.isArray(normalizedInput) ? normalizedInput[0] : normalizedInput);
  const to = request.to;

  if (request.operation) {
    if (!from) {
      throw createError({
        code: "INVALID_INPUT",
        message: "morphase could not determine the resource kind for this operation.",
        suggestedFixes: ["Pass --from explicitly to help route the request."]
      });
    }

    const output = request.output
      ? resolveOutputPath(request.output, normalizedInput, from)
      : deriveOperationOutputPath(normalizedInput, from);

    if (!output) {
      throw createError({
        code: "INVALID_INPUT",
        message: "morphase could not determine an output path for this operation."
      });
    }

    assertSafeOutputPath(output, normalizedInput, request.force);

    return {
      route: {
        kind: "operation",
        resource: from,
        action: request.operation
      },
      planRequest: {
        input: normalizedInput,
        from,
        output,
        operation: request.operation,
        options: request.options ?? {}
      }
    };
  }

  if (!from || !to) {
    throw createError({
      code: "INVALID_INPUT",
      message: "morphase needs both the input kind and the desired output kind.",
      suggestedFixes: [
        "Pass --from and --to explicitly.",
        "Use a file extension morphase can infer."
      ]
    });
  }

  const output = resolveOutputPath(request.output, normalizedInput, to) ?? deriveOutputPath(normalizedInput, to);
  assertSafeOutputPath(output, normalizedInput, request.force);

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
      output,
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
