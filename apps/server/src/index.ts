import Fastify from "fastify";

import { MorphaseEngine } from "@morphase/engine";
import { jobRequestSchema, type JobRequest, type MorphaseError } from "@morphase/shared";

const CLIENT_ERROR_CODES = new Set([
  "INVALID_INPUT",
  "OUTPUT_EXISTS",
  "UNSUPPORTED_ROUTE",
  "NETWORK_REQUIRED",
  "BACKEND_NOT_INSTALLED"
]);

function statusCodeForError(details: MorphaseError): number {
  return CLIENT_ERROR_CODES.has(details.code) ? 400 : 500;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function isZodLikeError(
  error: unknown
): error is { issues: Array<{ path: Array<string | number>; message: string }> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "issues" in error &&
    Array.isArray((error as { issues?: unknown }).issues)
  );
}

export function validateServerHost(host: string, allowRemote = false): string {
  const normalized = host.trim();
  if (!normalized) {
    throw new Error("Server host must not be empty.");
  }

  if (!allowRemote && !isLoopbackHost(normalized)) {
    throw new Error(
      `Refusing to bind morphase to non-loopback host ${normalized}. Pass --allow-remote if you intentionally want remote access.`
    );
  }

  return normalized;
}

export async function createMorphaseServer(engine?: MorphaseEngine) {
  const app = Fastify({ logger: false, bodyLimit: 1024 * 1024 });
  const runtime = engine ?? (await MorphaseEngine.create());

  app.setErrorHandler((error, _request, reply) => {
    if (isZodLikeError(error)) {
      reply.code(400).send({
        error: {
          code: "INVALID_INPUT",
          message: "Invalid job request payload.",
          likelyCause: error.issues
            .map((issue) => issue.path.join(".") || issue.message)
            .join("; ")
        }
      });
      return;
    }

    if (error instanceof Error && "details" in error) {
      const details = (error as { details: MorphaseError }).details;
      reply.code(statusCodeForError(details)).send({ error: details });
      return;
    }

    reply.code(500).send({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error."
      }
    });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "morphase",
    time: new Date().toISOString()
  }));

  app.get("/capabilities", async () => runtime.capabilities());

  app.get("/backends", async () => runtime.doctorAll());

  app.get<{ Params: { id: string } }>("/backends/:id", async (request) =>
    runtime.doctorBackend(request.params.id)
  );

  app.post<{ Body: JobRequest }>("/jobs", async (request) => {
    const job = jobRequestSchema.parse(request.body);
    return runtime.submit(job);
  });

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
