import { randomUUID } from "node:crypto";

import type { JobRecord, JobRequest, JobResult, JobStatus, Route } from "@muxory/shared";

function now(): string {
  return new Date().toISOString();
}

export class JobManager {
  private readonly jobs = new Map<string, JobRecord>();

  create(request: JobRequest, route: Route): JobRecord {
    const id = randomUUID();
    const job: JobRecord = {
      id,
      request,
      route,
      status: "queued",
      createdAt: now(),
      updatedAt: now(),
      logs: [],
      warnings: [],
      outputPaths: []
    };

    this.jobs.set(id, job);
    return job;
  }

  get(jobId: string): JobRecord | undefined {
    return this.jobs.get(jobId);
  }

  list(): JobRecord[] {
    return [...this.jobs.values()];
  }

  update(jobId: string, patch: Partial<JobRecord>): JobRecord {
    const current = this.jobs.get(jobId);
    if (!current) {
      throw new Error(`Unknown job ${jobId}`);
    }

    const next: JobRecord = {
      ...current,
      ...patch,
      updatedAt: now()
    };
    this.jobs.set(jobId, next);
    return next;
  }

  setStatus(jobId: string, status: JobStatus): JobRecord {
    return this.update(jobId, { status });
  }

  appendLog(jobId: string, message: string): JobRecord {
    const current = this.jobs.get(jobId);
    if (!current) {
      throw new Error(`Unknown job ${jobId}`);
    }

    return this.update(jobId, {
      logs: [...current.logs, message]
    });
  }

  complete(jobId: string, result: JobResult): JobRecord {
    return this.update(jobId, {
      status: result.status,
      result,
      outputPaths: result.outputPaths,
      error: result.error
    });
  }
}

