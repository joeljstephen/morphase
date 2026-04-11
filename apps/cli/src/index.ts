#!/usr/bin/env node
import { Command } from "commander";
import { execa } from "execa";
import prompts from "prompts";

import { MuxoryEngine } from "@muxory/engine";
import { createMuxoryServer } from "@muxory/server";
import { inferResourceKind, isYoutubeUrl, type JobRequest, type ResourceKind } from "@muxory/shared";

import { formatCliError, formatDoctorReport, formatJobResult } from "./format.js";
import { runWizard } from "./wizard.js";

function collectCommonOptions(command: Command): Command {
  return command
    .option("--from <kind>", "Explicitly set the input resource kind")
    .option("--backend <backend>", "Prefer a specific backend")
    .option("--offline", "Require an offline-capable backend", false)
    .option("--debug", "Enable debug logging", false)
    .option("--dry-run", "Plan the job without executing it", false);
}

function buildRequest(options: Record<string, unknown>, partial: JobRequest): JobRequest {
  return {
    ...partial,
    from: (options.from as ResourceKind | undefined) ?? partial.from,
    backendPreference: options.backend as string | undefined,
    offlineOnly: (options.offline as boolean | undefined) ?? partial.offlineOnly,
    debug: (options.debug as boolean | undefined) ?? partial.debug,
    dryRun: (options.dryRun as boolean | undefined) ?? partial.dryRun
  };
}

async function handleJob(engine: MuxoryEngine, request: JobRequest, options?: { setExitCode?: boolean }) {
  try {
    const result = await engine.submit(request);
    console.log(formatJobResult(result));
    if (result.status === "failed" && options?.setExitCode) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.log(formatCliError(error));
    if (options?.setExitCode) {
      process.exitCode = 1;
    }
  }
}

async function printExplain(engine: MuxoryEngine, request: JobRequest) {
  const plan = await engine.explain(request);
  console.log(`selected backend: ${plan.selectedPluginId}`);
  console.log(`explanation: ${plan.explanation}`);
  if (plan.installNeeded) {
    console.log("install required: yes");
  }
  if (plan.warnings.length) {
    console.log(`warnings: ${plan.warnings.join(" | ")}`);
  }
  if (plan.fallbacks.length) {
    console.log(`fallbacks: ${plan.fallbacks.join(", ")}`);
  }
}

async function printBackendHints(
  engine: MuxoryEngine,
  backendId: string,
  mode: "install" | "update",
  run: boolean
) {
  const report = await engine.doctorBackend(backendId);
  const hints = mode === "install" ? report.installHints : report.updateHints;

  if (hints.length === 0) {
    console.log(`No ${mode} hints are available for ${backendId}.`);
    return;
  }

  const command = hints[0]?.command;
  console.log(`${mode} hint for ${backendId}: ${command ?? hints[0]?.manager ?? "manual"}`);

  if (!run || !command) {
    return;
  }

  const confirmation = await prompts({
    type: "confirm",
    name: "ok",
    message: `Run this ${mode} command now?`,
    initial: false
  });

  if (!confirmation.ok) {
    return;
  }

  await execa(command, {
    shell: true,
    stdio: "inherit"
  });
}

async function main() {
  const engine = await MuxoryEngine.create();
  const program = new Command();

  program.name("muxory").description("Local-first open-source conversion router");

  collectCommonOptions(
    program.command("convert <input> <output>").description("Convert a file from one format to another")
  ).action(async (input, output, options) => {
    try {
      await handleJob(
        engine,
        buildRequest(options, {
          input,
          output,
          to: inferResourceKind(output)
        }),
        { setExitCode: true }
      );
    } catch (error) {
      console.log(formatCliError(error));
    }
  });

  collectCommonOptions(
    program.command("extract <input>").description("Extract content to another representation")
  )
    .requiredOption("--to <format>", "Desired output format")
    .option("-o, --output <path>", "Output path")
    .action(async (input, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            to: options.to as ResourceKind,
            output: options.output as string | undefined
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(program.command("fetch <url>").description("Fetch a URL into another format"))
    .requiredOption("--to <format>", "Desired output format")
    .option("-o, --output <path>", "Output path")
    .option("--format <format>", "Output format: text or markdown (default: text)")
    .action(async (url, options) => {
      try {
        const from: ResourceKind | undefined = isYoutubeUrl(url) ? "youtube-url" : "url";
        await handleJob(
          engine,
          buildRequest(options, {
            input: url,
            from,
            to: options.to as ResourceKind,
            output: options.output as string | undefined,
            options: options.format ? { format: options.format } : {}
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(program.command("media <input>").description("Convert audio or video"))
    .requiredOption("--to <format>", "Desired output format")
    .option("-o, --output <path>", "Output path")
    .action(async (input, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            to: options.to as ResourceKind,
            output: options.output as string | undefined
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  const pdf = program.command("pdf").description("PDF operations");

  pdf
    .command("merge <inputs...>")
    .requiredOption("-o, --output <path>", "Output PDF")
    .action(async (inputs, options) => {
      try {
        await handleJob(engine, {
          input: inputs,
          from: "pdf",
          operation: "merge",
          output: options.output as string
        }, { setExitCode: true });
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  pdf
    .command("split <input>")
    .requiredOption("--pages <range>", "Page range to extract, for example 1-3,5")
    .requiredOption("-o, --output <path>", "Output PDF")
    .action(async (input, options) => {
      try {
        await handleJob(engine, {
          input,
          from: "pdf",
          operation: "split",
          output: options.output as string,
          options: { pages: options.pages }
        }, { setExitCode: true });
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  pdf
    .command("optimize <input>")
    .requiredOption("-o, --output <path>", "Output PDF")
    .action(async (input, options) => {
      try {
        await handleJob(engine, {
          input,
          from: "pdf",
          operation: "optimize",
          output: options.output as string
        }, { setExitCode: true });
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  program.command("doctor").description("Inspect backend health").action(async () => {
    try {
      const reports = await engine.doctorAll();
      for (const report of reports) {
        console.log(formatDoctorReport(report));
        console.log("");
      }
    } catch (error) {
      console.log(formatCliError(error));
    }
  });

  const backend = program.command("backend").description("Backend inspection and hints");

  backend.command("list").action(async () => {
    try {
      const reports = await engine.doctorAll();
      for (const report of reports) {
        console.log(`${report.id}\tinstalled=${report.installed}\tverified=${report.verified}\tversion=${report.version ?? "unknown"}`);
      }
    } catch (error) {
      console.log(formatCliError(error));
    }
  });

  backend.command("status").action(async () => {
    try {
      const reports = await engine.doctorAll();
      for (const report of reports) {
        console.log(formatDoctorReport(report));
        console.log("");
      }
    } catch (error) {
      console.log(formatCliError(error));
    }
  });

  backend.command("verify <backendId>").action(async (backendId) => {
    try {
      const report = await engine.doctorBackend(backendId);
      console.log(formatDoctorReport(report));
    } catch (error) {
      console.log(formatCliError(error));
    }
  });

  backend
    .command("install <backendId>")
    .option("--run", "Run the suggested package-manager command after confirmation", false)
    .action(async (backendId, options) => {
      try {
        await printBackendHints(engine, backendId, "install", options.run as boolean);
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  backend
    .command("update <backendId>")
    .option("--run", "Run the suggested package-manager command after confirmation", false)
    .action(async (backendId, options) => {
      try {
        await printBackendHints(engine, backendId, "update", options.run as boolean);
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(program.command("explain <input>").description("Explain how Muxory would route a request"))
    .requiredOption("--to <format>", "Desired output format")
    .action(async (input, options) => {
      try {
        await printExplain(
          engine,
          buildRequest(options, {
            input,
            to: options.to as ResourceKind
          })
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  program
    .command("serve")
    .option("--host <host>", "Host to bind to")
    .option("--port <port>", "Port to bind to", (value) => Number(value))
    .action(async (options) => {
      try {
        const { app } = await createMuxoryServer(engine);
        const host = (options.host as string | undefined) ?? engine.getConfig().server.host;
        const port = (options.port as number | undefined) ?? engine.getConfig().server.port;
        await app.listen({ host, port });
        console.log(`Muxory server listening on http://${host}:${port}`);
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  if (process.argv.length <= 2) {
    try {
      const request = await runWizard();
      if (!request) {
        return;
      }

      const plan = await engine.explain(request);
      console.log(`selected backend: ${plan.selectedPluginId}`);
      if (plan.installNeeded) {
        const report = await engine.doctorBackend(plan.selectedPluginId);
        console.log(formatDoctorReport(report));
        return;
      }

      const confirmation = await prompts({
        type: "confirm",
        name: "ok",
        message: "Run this job now?",
        initial: true
      });

      if (!confirmation.ok) {
        return;
      }

      await handleJob(engine, request);
    } catch (error) {
      console.log(formatCliError(error));
    }

    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  console.log(formatCliError(error));
});
