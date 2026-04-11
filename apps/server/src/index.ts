import Fastify from "fastify";

import { MuxoryEngine } from "@muxory/engine";
import type { JobRequest } from "@muxory/shared";

export async function createMuxoryServer(engine?: MuxoryEngine) {
  const app = Fastify({ logger: false });
  const runtime = engine ?? (await MuxoryEngine.create());

  app.get("/health", async () => ({
    ok: true,
    service: "muxory",
    time: new Date().toISOString()
  }));

  app.get("/capabilities", async () => runtime.capabilities());

  app.get("/backends", async () => runtime.doctorAll());

  app.get<{ Params: { id: string } }>("/backends/:id", async (request) =>
    runtime.doctorBackend(request.params.id)
  );

  app.post<{ Body: JobRequest }>("/jobs", async (request) => runtime.submit(request.body));

  app.get<{ Params: { id: string } }>("/jobs/:id", async (request, reply) => {
    const job = runtime.getJob(request.params.id);
    if (!job) {
      reply.code(404);
      return { message: "Job not found" };
    }

    return job;
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/logs", async (request, reply) => {
    const job = runtime.getJob(request.params.id);
    if (!job) {
      reply.code(404);
      return { message: "Job not found" };
    }

    return { jobId: job.id, logs: job.logs };
  });

  app.get<{ Params: { id: string } }>("/jobs/:id/result", async (request, reply) => {
    const job = runtime.getJob(request.params.id);
    if (!job) {
      reply.code(404);
      return { message: "Job not found" };
    }

    return job.result ?? { jobId: job.id, status: job.status };
  });

  return { app, engine: runtime };
}

