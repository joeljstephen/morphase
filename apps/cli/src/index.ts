#!/usr/bin/env node
import path from "node:path";

import { Command } from "commander";
import { execa } from "execa";
import prompts from "prompts";

import { MorphaseEngine } from "@morphase/engine";
import { createMorphaseServer, validateServerHost } from "@morphase/server";
import { inferResourceKind, isMediaUrl, isYoutubeUrl, type JobRequest, type ResourceKind } from "@morphase/shared";

import { formatCliError, formatDoctorReport, formatJobResult } from "./format.js";
import { runWizard } from "./wizard.js";

function collectCommonOptions(command: Command): Command {
  return command
    .option("--from <kind>", "Explicitly set the input resource kind")
    .option("--backend <backend>", "Prefer a specific backend")
    .option("--offline", "Require an offline-capable backend", false)
    .option("--debug", "Enable debug logging", false)
    .option("--dry-run", "Plan the job without executing it", false)
    .option("--force", "Overwrite an existing output path", false);
}

function buildRequest(options: Record<string, unknown>, partial: JobRequest): JobRequest {
  return {
    ...partial,
    from: partial.from ?? (options.from as ResourceKind | undefined),
    backendPreference: options.backend as string | undefined,
    offlineOnly: (options.offline as boolean | undefined) ?? partial.offlineOnly,
    debug: (options.debug as boolean | undefined) ?? partial.debug,
    dryRun: (options.dryRun as boolean | undefined) ?? partial.dryRun,
    force: (options.force as boolean | undefined) ?? partial.force
  };
}

function tokenizeCommand(command: string): string[] {
  const matches = command.match(/"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|[^\s]+/g) ?? [];
  return matches.map((token) =>
    token.startsWith("\"") || token.startsWith("'")
      ? token.slice(1, -1)
      : token
  );
}

function containsShellOperators(command: string): boolean {
  return /(^|[\s])(?:&&|\|\||\||;)(?=[\s]|$)/.test(command);
}

async function promptAndInstall(engine: MorphaseEngine, backendId: string): Promise<boolean> {
  const report = await engine.doctorBackend(backendId);
  const hints = report.installHints;
  const command = hints[0]?.command;

  if (!command) {
    console.log(formatDoctorReport(report));
    console.log(`\n  No automated install command available. Install manually and try again.`);
    return false;
  }

  console.log("");
  console.log(formatDoctorReport(report));
  console.log("");

  const answer = await prompts({
    type: "confirm",
    name: "ok",
    message: `Install ${backendId} now?`,
    initial: true
  });

  if (!answer.ok) {
    console.log(`Skipped. You can install it later with: ${command}`);
    return false;
  }

  if (containsShellOperators(command)) {
    console.log(`This install command contains shell operators and cannot be run automatically.`);
    console.log(`Please run it manually: ${command}`);
    return false;
  }

  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    console.log(`Could not parse install command: ${command}`);
    return false;
  }

  const [file, ...args] = tokens;
  try {
    await execa(file, args, { stdio: "inherit" });
    console.log("");
    return true;
  } catch (installError) {
    const reason = installError instanceof Error ? installError.message : "";
    console.log(`\n  Installation failed${reason ? `: ${reason}` : ""}.`);
    console.log(`  Try running it manually: ${command}`);
    return false;
  }
}

async function handleJob(engine: MorphaseEngine, request: JobRequest, options?: { setExitCode?: boolean }) {
  try {
    const result = await engine.submit(request);
    console.log(formatJobResult(result));
    if (result.status === "failed" && options?.setExitCode) {
      process.exitCode = 1;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      "details" in error &&
      (error as { details: { code: string; backendId?: string } }).details.code === "BACKEND_NOT_INSTALLED"
    ) {
      const { backendId } = (error as { details: { code: string; backendId?: string; suggestedFixes?: string[] } }).details;
      if (backendId) {
        const installed = await promptAndInstall(engine, backendId);
        if (installed) {
          try {
            const result = await engine.submit(request);
            console.log(formatJobResult(result));
            if (result.status === "failed" && options?.setExitCode) {
              process.exitCode = 1;
            }
            return;
          } catch (retryError) {
            console.log(formatCliError(retryError));
            if (options?.setExitCode) {
              process.exitCode = 1;
            }
            return;
          }
        }
      }
    }

    console.log(formatCliError(error));
    if (options?.setExitCode) {
      process.exitCode = 1;
    }
  }
}

async function printExplain(engine: MorphaseEngine, request: JobRequest) {
  const plan = await engine.explain(request);
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";
  function lbl(label: string, value: string) {
    return `    ${dim}${label.padEnd(8)}${reset} ${value}`;
  }

  console.log("");
  console.log(`  ${bold}Plan${reset}`);
  console.log(lbl("Using", plan.selectedPluginId));
  console.log(lbl("Detail", plan.explanation));
  if (plan.installNeeded) {
    console.log(lbl("Note", "Installation required before running."));
  }
  if (plan.fallbacks.length) {
    console.log(lbl("Alt", plan.fallbacks.join(", ")));
  }
  if (plan.warnings.length) {
    console.log(lbl("Notes", plan.warnings.join(" · ")));
  }
  if (plan.equivalentCommand) {
    console.log(lbl("CLI", plan.equivalentCommand));
  }
  console.log("");
}

async function printBackendHints(
  engine: MorphaseEngine,
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

  if (!engine.getConfig().allowPackageManagerDelegation) {
    throw new Error(
      "Package-manager delegation is disabled. Set allowPackageManagerDelegation=true in ~/.morphase/config.json before using --run."
    );
  }

  if (containsShellOperators(command)) {
    throw new Error(
      "Morphase will not execute compound install commands automatically. Run the printed command manually."
    );
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

  const tokens = tokenizeCommand(command);
  if (tokens.length === 0) {
    throw new Error(`Could not parse delegated ${mode} command: ${command}`);
  }

  const [file, ...args] = tokens;
  await execa(file, args, { stdio: "inherit" });
}

async function main() {
  const engine = await MorphaseEngine.create();
  const program = new Command();

  program.name("morphase").description("Local-first open-source conversion router for files, media, PDFs, and web content");

  collectCommonOptions(
    program.command("convert [args...]").description("Convert a file from one format to another")
  ).option("-o, --output <path>", "Output path")
    .option("--inputs <paths>", "Comma-separated input files")
    .action(async (args, options) => {
    try {
      let input: string | string[];
      let output: string | undefined;

      if (options.inputs) {
        input = (options.inputs as string).split(",").map((s: string) => s.trim());
        output = (options.output as string | undefined) ?? args[0];
      } else if (options.output) {
        input = args.length === 1 ? args[0] : args;
        output = options.output as string;
      } else if (args.length >= 2) {
        input = args.length === 2 ? args[0] : args.slice(0, -1);
        output = args[args.length - 1];
      } else {
        throw new Error("Missing output path. Usage: morphase convert <input> <output>");
      }

      if (!output) {
        throw new Error("Missing output path. Usage: morphase convert <input> <output>");
      }

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
    .option("--format <format>", "Transcript format for --to transcript: text or markdown")
    .action(async (url, options) => {
      try {
        const from: ResourceKind | undefined = isYoutubeUrl(url) ? "youtube-url" : isMediaUrl(url) ? "media-url" : "url";
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

  const image = program.command("image").description("Image operations");

  collectCommonOptions(
    image.command("compress <input>").option("-o, --output <path>", "Output path")
  )
    .action(async (input, options) => {
      try {
        const from = inferResourceKind(input) ?? "jpg";
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            from,
            operation: "compress",
            output: options.output as string | undefined
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  const video = program.command("video").description("Video operations");

  collectCommonOptions(
    video.command("compress <input>").option("-o, --output <path>", "Output path")
  )
    .action(async (input, options) => {
      try {
        const from = inferResourceKind(input) ?? "mp4";
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            from,
            operation: "compress",
            output: options.output as string | undefined
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  const pdf = program.command("pdf").description("PDF operations");

  collectCommonOptions(
    pdf.command("merge <inputs...>").requiredOption("-o, --output <path>", "Output PDF")
  )
    .action(async (inputs, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input: inputs,
            from: "pdf",
            operation: "merge",
            output: options.output as string
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(
    pdf
      .command("split <input>")
      .requiredOption("--pages <range>", "Page range to extract, for example 1-3,5")
      .requiredOption("-o, --output <path>", "Output PDF")
  )
    .action(async (input, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            from: "pdf",
            operation: "split",
            output: options.output as string,
            options: { pages: options.pages }
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(
    pdf.command("optimize <input>").requiredOption("-o, --output <path>", "Output PDF")
  )
    .action(async (input, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            from: "pdf",
            operation: "optimize",
            output: options.output as string
          }),
          { setExitCode: true }
        );
      } catch (error) {
        console.log(formatCliError(error));
      }
    });

  collectCommonOptions(
    pdf.command("extract-images <input>").option("-o, --output <path>", "Output directory or prefix")
  )
    .action(async (input, options) => {
      try {
        await handleJob(
          engine,
          buildRequest(options, {
            input,
            from: "pdf",
            operation: "extract-images",
            output: (options.output as string | undefined) ?? path.join(path.dirname(input), path.parse(input).name + "-images")
          }),
          { setExitCode: true }
        );
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
      const dim = "\x1b[2m";
      const yellow = "\x1b[33m";
      const green = "\x1b[32m";
      const red = "\x1b[31m";
      const reset = "\x1b[0m";
      console.log("");
      console.log(`${dim}Backends${reset}`);
      console.log("");
      for (const report of reports) {
        const icon = report.installed
          ? report.versionSupported
            ? `${green}✓${reset}`
            : `${yellow}⚠${reset}`
          : `${red}✗${reset}`;
        const ver = report.version ? ` ${dim}v${report.version}${reset}` : "";
        const versionNote = report.installed && !report.versionSupported && report.minimumVersion
          ? ` ${yellow}(needs ≥${report.minimumVersion})${reset}`
          : "";
        console.log(`  ${icon}  ${report.name}${ver}${versionNote}`);
      }
      console.log("");
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

  collectCommonOptions(program.command("explain <input>").description("Explain how morphase would route a request"))
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
    .description("[experimental] Start a local HTTP API server")
    .option("--host <host>", "Host to bind to")
    .option("--port <port>", "Port to bind to", (value) => Number(value))
    .option("--allow-remote", "Allow binding to a non-loopback host", false)
    .action(async (options) => {
      try {
        const { app } = await createMorphaseServer(engine);
        const host = validateServerHost(
          (options.host as string | undefined) ?? engine.getConfig().server.host,
          options.allowRemote as boolean
        );
        const port = (options.port as number | undefined) ?? engine.getConfig().server.port;
        await app.listen({ host, port });
        console.log(`morphase server listening on http://${host}:${port}`);
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
      if (plan.installNeeded) {
        const installed = await promptAndInstall(engine, plan.selectedPluginId);
        if (!installed) {
          return;
        }
      }

      const confirmation = await prompts({
        type: "confirm",
        name: "ok",
        message: "Run this now?",
        initial: true
      });

      if (!confirmation.ok) {
        console.log("Cancelled.");
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
