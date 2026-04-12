import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ROUTE_PREFERENCES,
  extensionForResourceKind,
  routeKey,
  type Capability,
  type MorphaseConfig,
  type PlannedExecution,
  type PlannerCandidate,
  type PlanRequest,
  type PlannedStep,
  type PipelineDefinition,
  type ResourceKind
} from "@morphase/shared";

import { createError } from "../errors/morphase-error.js";
import { curatedPipelines } from "./pipelines.js";
import { PluginRegistry } from "../registry/plugin-registry.js";

function equivalentCommandForRequest(request: PlanRequest): string {
  const input = Array.isArray(request.input) ? request.input.join(" ") : request.input;
  const baseCwd = process.env.INIT_CWD ?? process.cwd();
  const printableInput = Array.isArray(request.input)
    ? request.input.map((item) => path.isAbsolute(item) ? path.relative(baseCwd, item) || "." : item).join(" ")
    : path.isAbsolute(input) ? path.relative(baseCwd, input) || "." : input;
  const output = request.output ? (path.isAbsolute(request.output) ? path.relative(baseCwd, request.output) : request.output) : "";

  if (request.route.kind === "operation") {
    const optionSuffix =
      request.route.action === "split" && typeof request.options.pages === "string"
        ? ` --pages ${request.options.pages}`
        : "";
    return `morphase ${request.route.resource} ${request.route.action} ${printableInput}${optionSuffix}${output ? ` -o ${output}` : ""}`.trim();
  }

  if (request.route.from === "url" || request.route.from === "youtube-url" || request.route.from === "media-url") {
    return `morphase fetch ${printableInput} --to ${request.route.to}${output ? ` -o ${output}` : ""}`;
  }

  if (["mp3", "wav", "mp4", "mov", "mkv"].includes(request.route.from)) {
    return `morphase media ${printableInput} --to ${request.route.to}${output ? ` -o ${output}` : ""}`;
  }

  if (request.route.to === "markdown" || request.route.to === "txt" || request.route.to === "transcript") {
    return `morphase extract ${printableInput} --to ${request.route.to}${output ? ` -o ${output}` : ""}`;
  }

  return `morphase convert ${printableInput} ${output}`.trim();
}

function qualityScore(capability: Capability): number {
  switch (capability.quality) {
    case "high":
      return 10;
    case "medium":
      return 5;
    default:
      return -20;
  }
}

function scoreCandidate(
  candidate: PlannerCandidate,
  request: PlanRequest,
  preferredPlugins: string[]
): number {
  let score = 50;

  if (preferredPlugins.includes(candidate.pluginId)) {
    score += 20;
  }

  if (candidate.installed) {
    score += 15;
  }

  if (candidate.verified) {
    score += 10;
  }

  if (request.offlineOnly && candidate.capability.offline) {
    score += 15;
  }

  score += qualityScore(candidate.capability);

  if (request.offlineOnly && !candidate.capability.offline) {
    return Number.NEGATIVE_INFINITY;
  }

  if (candidate.detection.installed && !candidate.verification.ok) {
    score -= 30;
  }

  return score;
}

function pipelineMatches(pipeline: PipelineDefinition, request: PlanRequest): boolean {
  if (pipeline.route.kind !== request.route.kind) {
    return false;
  }

  if (pipeline.route.kind === "conversion" && request.route.kind === "conversion") {
    return pipeline.route.from === request.route.from && pipeline.route.to === request.route.to;
  }

  return false;
}

export class Planner {
  constructor(
    private readonly registry: PluginRegistry,
    private readonly config: MorphaseConfig
  ) {}

  private async planPipeline(
    request: PlanRequest,
    pipeline: PipelineDefinition,
    rankedCandidates: PlannerCandidate[]
  ): Promise<PlannedExecution | null> {
    const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "morphase-"));
    const steps: PlannedStep[] = [];
    let currentInput = request.input;

    for (let index = 0; index < pipeline.steps.length; index += 1) {
      const definition = pipeline.steps[index];
      const plugin = this.registry.get(definition.pluginId);

      if (!plugin) {
        await fs.rm(tempRoot, { recursive: true, force: true });
        return null;
      }

      const detection = await plugin.detect(request.platform);
      if (!detection.installed) {
        return {
          selectedPluginId: plugin.id,
          explanation: `${pipeline.id} could not run because ${plugin.name} is not installed.`,
          warnings: [detection.reason ?? `${plugin.name} is not installed.`],
          installNeeded: true,
          fallbacks: rankedCandidates.map((candidate) => candidate.pluginId),
          steps: [],
          equivalentCommand: equivalentCommandForRequest(request)
        };
      }

      const isLast = index === pipeline.steps.length - 1;
      const output = isLast
        ? request.output
        : path.join(tempRoot, `step-${index + 1}${extensionForResourceKind(definition.to as ResourceKind)}`);

      if (!output) {
        await fs.rm(tempRoot, { recursive: true, force: true });
        return null;
      }

      const route = {
        kind: "conversion" as const,
        from: definition.from,
        to: definition.to as ResourceKind
      };

      const plan = await plugin.plan({
        input: currentInput,
        from: definition.from,
        to: definition.to as ResourceKind,
        output,
        options: request.options,
        platform: request.platform,
        offlineOnly: request.offlineOnly,
        route
      });

      if (!plan) {
        await fs.rm(tempRoot, { recursive: true, force: true });
        return null;
      }

      steps.push({
        pluginId: plugin.id,
        route,
        plan: {
          ...plan,
          tempDirs: [...(plan.tempDirs ?? []), tempRoot]
        }
      });
      currentInput = output;
    }

    return {
      selectedPluginId: `pipeline:${pipeline.id}`,
      explanation: `morphase selected curated pipeline ${pipeline.id} because no direct backend could produce a valid plan for ${routeKey(request.route)} on this machine.`,
      warnings: [],
      installNeeded: false,
      fallbacks: rankedCandidates.map((candidate) => candidate.pluginId),
      steps,
      equivalentCommand: equivalentCommandForRequest(request)
    };
  }

  async plan(request: PlanRequest, preferredBackend?: string): Promise<PlannedExecution> {
    const candidates = this.registry.findCandidates(request.route, request.platform);

    const preferences = preferredBackend
      ? [preferredBackend]
      : this.config.preferredBackends[routeKey(request.route)]?.split(",").map((item) => item.trim()).filter(Boolean) ??
        ROUTE_PREFERENCES[routeKey(request.route)] ??
        [];

    if (candidates.length === 0) {
      const pipeline = curatedPipelines.find((item) => pipelineMatches(item, request));
      if (pipeline) {
        const pipelinePlan = await this.planPipeline(request, pipeline, []);
        if (pipelinePlan) {
          return pipelinePlan;
        }
      }

      throw createError({
        code: "UNSUPPORTED_ROUTE",
        message: `morphase does not currently support ${routeKey(request.route)}.`,
        suggestedFixes: ["Run `morphase doctor` to inspect available backends."]
      });
    }

    const evaluated: PlannerCandidate[] = [];

    for (const { plugin, capability } of candidates) {
      const detection = await plugin.detect(request.platform);
      const verification = detection.installed
        ? await plugin.verify(request.platform)
        : { ok: false, issues: [detection.reason ?? `${plugin.name} is not installed.`], warnings: [] };

      const explanation = [`${plugin.name} matches ${routeKey(request.route)}.`];

      if (preferences.includes(plugin.id)) {
        explanation.push(`${plugin.name} is preferred for this route.`);
      }

      if (!capability.offline) {
        explanation.push(`${plugin.name} requires network access.`);
      }

      evaluated.push({
        pluginId: plugin.id,
        capability,
        detection,
        verification,
        installed: detection.installed,
        verified: verification.ok,
        explanation,
        score: 0
      });
    }

    const ranked = evaluated
      .map((candidate) => ({
        ...candidate,
        score: scoreCandidate(candidate, request, preferences)
      }))
      .filter((candidate) => Number.isFinite(candidate.score))
      .sort((left, right) => right.score - left.score);

    if (ranked.length === 0) {
      throw createError({
        code: "NETWORK_REQUIRED",
        message: `morphase found only network-backed candidates for ${routeKey(request.route)}, but offline mode is enabled.`,
        suggestedFixes: ["Disable offline mode or install a local backend for this route."]
      });
    }

    const firstInstalled = ranked.find((candidate) => candidate.installed);
    if (!firstInstalled) {
      return {
        selectedPluginId: ranked[0].pluginId,
        explanation: ranked[0].explanation.join(" "),
        warnings: ranked[0].verification.issues ?? [],
        installNeeded: true,
        fallbacks: ranked.slice(1).map((candidate) => candidate.pluginId),
        steps: [],
        equivalentCommand: equivalentCommandForRequest(request)
      };
    }

    for (const selected of ranked) {
      if (!selected.installed) {
        continue;
      }

      const plugin = this.registry.get(selected.pluginId);
      if (!plugin) {
        continue;
      }

      const plan = await plugin.plan(request);
      if (!plan) {
        continue;
      }

      return {
        selectedPluginId: selected.pluginId,
        explanation: selected.explanation.join(" "),
        warnings: [],
        installNeeded: false,
        fallbacks: ranked
          .filter((candidate) => candidate.pluginId !== selected.pluginId)
          .map((candidate) => candidate.pluginId),
        steps: [
          {
            pluginId: plugin.id,
            route: request.route,
            plan
          }
        ],
        equivalentCommand: equivalentCommandForRequest(request)
      };
    }

    const pipeline = curatedPipelines.find((item) => pipelineMatches(item, request));
    if (pipeline) {
      const pipelinePlan = await this.planPipeline(request, pipeline, ranked);
      if (pipelinePlan) {
        return pipelinePlan;
      }
    }

    throw createError({
      code: "UNSUPPORTED_ROUTE",
      message: `${firstInstalled.pluginId} matches ${routeKey(request.route)} but could not produce a runnable plan on this machine.`,
      backendId: firstInstalled.pluginId
    });
  }
}
