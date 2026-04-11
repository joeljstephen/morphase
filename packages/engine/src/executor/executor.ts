import fs from "node:fs/promises";
import path from "node:path";

import { execa } from "execa";

import type { JobRequest, JobResult, MuxoryError, PlannedExecution } from "@muxory/shared";

import { createError } from "../errors/muxory-error.js";
import { Logger } from "../logging/logger.js";

function enrichError(pluginId: string, error: MuxoryError, stderr: string): MuxoryError {
  if (pluginId === "ffmpeg" && /does not contain any stream/i.test(stderr)) {
    return {
      ...error,
      likelyCause: "The input file does not contain an audio stream.",
      suggestedFixes: [
        "Verify the input file has an audio track.",
        "The video may have been recorded without sound."
      ]
    };
  }

  if (pluginId === "ffmpeg" && /no such file|no file/i.test(stderr)) {
    return {
      ...error,
      likelyCause: "FFmpeg could not find the input file.",
      suggestedFixes: ["Check that the input path is correct and the file exists."]
    };
  }

  return error;
}

async function validateOutputs(outputs: string[]): Promise<string[]> {
  const present: string[] = [];

  for (const output of outputs) {
    try {
      await fs.access(output);
      present.push(output);
    } catch {
      // Ignore missing outputs here. The caller decides whether it is fatal.
    }
  }

  return present;
}

function isInsideTempDir(filePath: string, tempDirs: Set<string>): boolean {
  return [...tempDirs].some((directory) => filePath.startsWith(`${directory}${path.sep}`));
}

export class Executor {
  constructor(private readonly logger: Logger) {}

  async run(jobId: string, execution: PlannedExecution, request: JobRequest): Promise<JobResult> {
    const logs: string[] = [];
    const warnings = [...execution.warnings];
    const outputPaths = new Set<string>();
    const tempDirs = new Set<string>();

    if (request.dryRun) {
      for (const step of execution.steps) {
        logs.push(this.logger.executor(`dry-run: ${step.plan.command} ${step.plan.args.join(" ")}`));
      }

      return {
        jobId,
        status: "success",
        backendId: execution.selectedPluginId,
        outputPaths: [],
        logs,
        warnings,
        equivalentCommand: execution.equivalentCommand
      };
    }

    for (const step of execution.steps) {
      for (const tempDir of step.plan.tempDirs ?? []) {
        tempDirs.add(tempDir);
      }

      logs.push(this.logger.executor(`running ${step.plan.command} ${step.plan.args.join(" ")}`));

      try {
        const result = await execa(step.plan.command, step.plan.args, {
          cwd: step.plan.cwd,
          env: step.plan.env,
          reject: false,
          timeout: step.plan.timeoutMs
        });

        if (result.stdout) {
          logs.push(result.stdout);
        }

        if (result.stderr) {
          logs.push(result.stderr);
        }

        if (step.plan.stdoutFile && result.stdout) {
          await fs.writeFile(step.plan.stdoutFile, result.stdout, "utf8");
        }

        if (result.exitCode !== 0) {
          throw createError({
            code: "BACKEND_EXECUTION_FAILED",
            message: `${step.pluginId} exited with code ${result.exitCode}.`,
            backendId: step.pluginId,
            rawStdout: result.stdout,
            rawStderr: result.stderr
          });
        }

        if (step.plan.outputMapping?.length) {
          for (const mapping of step.plan.outputMapping) {
            await fs.mkdir(path.dirname(mapping.target), { recursive: true });
            await fs.rename(mapping.source, mapping.target);
            outputPaths.add(mapping.target);
          }
        }

        for (const output of step.plan.expectedOutputs ?? []) {
          outputPaths.add(output);
        }

        if (step.plan.stdoutFile) {
          outputPaths.add(step.plan.stdoutFile);
        }
      } catch (error) {
        const baseError: MuxoryError =
          error instanceof Error && "details" in error
            ? (error as { details: MuxoryError }).details
            : {
                code: "BACKEND_EXECUTION_FAILED",
                message: error instanceof Error ? error.message : String(error),
                backendId: step.pluginId
              };

        const muxoryError = enrichError(
          step.pluginId,
          baseError,
          baseError.rawStderr ?? (error instanceof Error ? error.message : "")
        );

        return {
          jobId,
          status: "failed",
          backendId: execution.selectedPluginId,
          outputPaths: [...outputPaths],
          logs,
          warnings,
          error: muxoryError,
          equivalentCommand: execution.equivalentCommand
        };
      }
    }

    const validatedOutputs = (await validateOutputs([...outputPaths])).filter(
      (output) => !isInsideTempDir(output, tempDirs)
    );
    if (!request.keepTemp && !request.debug) {
      await Promise.all(
        [...tempDirs].map((directory) => fs.rm(directory, { recursive: true, force: true }))
      );
    }

    if (outputPaths.size > 0 && validatedOutputs.length === 0) {
      return {
        jobId,
        status: "failed",
        backendId: execution.selectedPluginId,
        outputPaths: [],
        logs,
        warnings,
        error: {
          code: "OUTPUT_NOT_PRODUCED",
          message: "The backend completed but Muxory could not find the expected output files.",
          backendId: execution.selectedPluginId
        },
        equivalentCommand: execution.equivalentCommand
      };
    }

    return {
      jobId,
      status: "success",
      backendId: execution.selectedPluginId,
      outputPaths: validatedOutputs,
      logs,
      warnings,
      equivalentCommand: execution.equivalentCommand
    };
  }
}
