import { builtinPlugins } from "@morphase/plugins";
import type { BackendDoctorReport, JobRecord, JobRequest, JobResult, MorphaseConfig, MorphasePlugin, PlannedExecution } from "@morphase/shared";

import { loadMorphaseConfig } from "./config/load-config.js";
import { Doctor } from "./doctor/doctor.js";
import { createError } from "./errors/morphase-error.js";
import { Executor } from "./executor/executor.js";
import { JobManager } from "./jobs/job-manager.js";
import { Logger } from "./logging/logger.js";
import { detectPlatform } from "./platform/platform.js";
import { normalizeRequest, toPlanRequest } from "./planner/normalize-request.js";
import { Planner } from "./planner/planner.js";
import { PluginRegistry } from "./registry/plugin-registry.js";

export class MorphaseEngine {
  private readonly registry: PluginRegistry;
  private readonly planner: Planner;
  private readonly executor: Executor;
  private readonly doctor: Doctor;
  private readonly jobs = new JobManager();
  private readonly logger: Logger;

  private constructor(
    private readonly config: MorphaseConfig,
    plugins: MorphasePlugin[]
  ) {
    this.registry = new PluginRegistry(plugins);
    this.planner = new Planner(this.registry, config);
    this.logger = new Logger(config.debug);
    this.executor = new Executor(this.logger);
    this.doctor = new Doctor();
  }

  static async create(plugins: MorphasePlugin[] = builtinPlugins): Promise<MorphaseEngine> {
    const config = await loadMorphaseConfig();
    return new MorphaseEngine(config, plugins);
  }

  getConfig(): MorphaseConfig {
    return this.config;
  }

  listPlugins(): MorphasePlugin[] {
    return this.registry.list();
  }

  async capabilities() {
    return this.registry.capabilities().map(({ plugin, capability }) => ({
      backendId: plugin.id,
      backendName: plugin.name,
      capability
    }));
  }

  getJob(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  async explain(request: JobRequest): Promise<PlannedExecution> {
    const normalized = normalizeRequest(request, {
      offlineOnly: this.config.offlineOnly,
      skipOverwriteCheck: true
    });
    const planRequest = toPlanRequest(request, normalized, this.config.offlineOnly);
    return this.planner.plan(planRequest, request.backendPreference);
  }

  async submit(request: JobRequest): Promise<JobResult> {
    const normalized = normalizeRequest(request, {
      offlineOnly: this.config.offlineOnly
    });
    const job = this.jobs.create(request, normalized.route);
    this.jobs.appendLog(job.id, this.logger.planner(`received ${job.id}`));
    this.jobs.setStatus(job.id, "planned");

    const planRequest = toPlanRequest(request, normalized, this.config.offlineOnly);
    const plan = await this.planner.plan(planRequest, request.backendPreference);

    if (plan.installNeeded) {
      const plugin = this.registry.get(plan.selectedPluginId);
      throw createError({
        code: "BACKEND_NOT_INSTALLED",
        message: `${plugin?.name ?? plan.selectedPluginId} is required for this route but is not installed.`,
        backendId: plan.selectedPluginId,
        suggestedFixes: plugin?.getInstallHints(detectPlatform()).map((hint) => hint.command ?? hint.manager)
      });
    }

    this.jobs.update(job.id, {
      selectedPlugin: plan.selectedPluginId,
      warnings: plan.warnings
    });
    this.jobs.setStatus(job.id, "running");

    const result = await this.executor.run(job.id, plan, request);
    this.jobs.complete(job.id, result);
    return result;
  }

  async doctorAll(): Promise<BackendDoctorReport[]> {
    return this.doctor.inspectAll(this.registry.list(), detectPlatform());
  }

  async doctorBackend(backendId: string): Promise<BackendDoctorReport> {
    const plugin = this.registry.get(backendId);
    if (!plugin) {
      throw createError({
        code: "INVALID_INPUT",
        message: `Unknown backend ${backendId}.`
      });
    }

    return this.doctor.inspectBackend(plugin, detectPlatform());
  }
}

export * from "./platform/platform.js";
