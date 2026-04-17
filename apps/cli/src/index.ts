#!/usr/bin/env node
import path from "node:path";

import { Command } from "commander";
import { execa } from "execa";
import prompts from "prompts";

import { MorphaseEngine } from "@morphase/engine";
import { canAutoInstall, installHintSummary, inferResourceKind, isMediaUrl, isYoutubeUrl, type InstallHint, type JobRequest, type ResourceKind } from "@morphase/shared";

import { formatCliError, formatDoctorReport, formatJobResult } from "./format.js";
import { runWizard } from "./wizard.js";

function printCliError(error: unknown, options?: { setExitCode?: boolean }) {
  console.log(formatCliError(error));
  if (options?.setExitCode) {
    process.exitCode = 1;
  }
}

function collectCommonOptions(command: Command): Command {
  return command
    .option("--from <kind>", "Explicitly set the input resource kind")
    .option("--backend <backend>", "Prefer a specific backend")
    .option("--offline", "Require an offline-capable backend", false)
    .option("--debug", "Enable debug logging", false)
    .option("--dry-run", "Plan the job without executing it", false)
    .option("--force", "Overwrite an existing output path", false);
}

const COMMON_HELP_FLAGS = [
  "--from <kind>     Explicitly set the input resource kind",
  "--backend <name>  Prefer a specific backend",
  "--offline         Require an offline-capable backend",
  "--debug           Enable debug logging",
  "--dry-run         Plan the job without executing it",
  "--force           Overwrite an existing output path"
];

function styleHelpCommand(text: string): string {
  return process.stdout.isTTY ? `\x1b[36m\x1b[1m${text}\x1b[22m\x1b[39m` : text;
}

function commandLine(command: string, remainder = ""): string {
  return `${styleHelpCommand(command)}${remainder}`;
}

function formatHelpBlock(lines: string[]): string {
  return lines.map((line) => `  ${line}`).join("\n");
}

function buildTopLevelHelp(): string {
  return [
    "",
    "Overview",
    formatHelpBlock([
      "Morphase routes conversions across files, media, PDFs, and web content.",
      `Run ${commandLine("morphase <command>", " --help")} for command-specific details and examples.`
    ]),
    "",
    "General Syntax",
    formatHelpBlock([
      commandLine("morphase convert", " <input> <output> [common flags]"),
      commandLine("morphase extract", " <input> --to <format> [options] [common flags]"),
      commandLine("morphase fetch", " <url> --to <format> [options] [common flags]"),
      commandLine("morphase media", " <input> --to <format> [options] [common flags]")
    ]),
    "",
    "Core Conversion Commands",
    formatHelpBlock([
      commandLine("convert", " [args...]"),
      "  General file-to-file conversion. Accepts positional input/output or `--inputs`.",
      "  Flags: -o, --output <path>; --inputs <paths>",
      "",
      commandLine("extract", " <input>"),
      "  Extracts a source into another representation such as txt, markdown, transcript, or images.",
      "  Flags: --to <format> (required); -o, --output <path>",
      "",
      commandLine("fetch", " <url>"),
      "  Downloads or reads web content, then converts it to a target format.",
      "  Flags: --to <format> (required); -o, --output <path>; --format <text|markdown>; --quality <best|high|medium|low>",
      "",
      commandLine("media", " <input>"),
      "  Converts audio or video into another format.",
      "  Flags: --to <format> (required); -o, --output <path>",
      "",
      commandLine("explain", " <input>"),
      "  Shows how Morphase would route a request without executing it.",
      "  Flags: --to <format> (required)"
    ]),
    "",
    "Image And Video",
    formatHelpBlock([
      commandLine("image compress", " <input>"),
      "  Compress an image file.",
      "  Flags: -o, --output <path>",
      "",
      commandLine("video compress", " <input>"),
      "  Compress a video file.",
      "  Flags: -o, --output <path>"
    ]),
    "",
    "PDF",
    formatHelpBlock([
      commandLine("pdf merge", " <inputs...>"),
      "  Merge multiple PDFs into one file.",
      "  Flags: -o, --output <path> (required)",
      "",
      commandLine("pdf split", " <input>"),
      "  Extract specific page ranges into a new PDF.",
      "  Flags: --pages <range> (required); -o, --output <path> (required)",
      "",
      commandLine("pdf optimize", " <input>"),
      "  Optimize a PDF for size or structure.",
      "  Flags: -o, --output <path> (required)",
      "",
      commandLine("pdf extract-images", " <input>"),
      "  Extract embedded images from a PDF.",
      "  Flags: -o, --output <path>"
    ]),
    "",
    "Backend And Diagnostics",
    formatHelpBlock([
      commandLine("doctor"),
      "  Inspect all backend health and installation state.",
      "",
      commandLine("backend list"),
      "  Show installed and available backends at a glance.",
      "",
      commandLine("backend status"),
      "  Show detailed health for every backend.",
      "",
      commandLine("backend verify", " <backendId>"),
      "  Inspect one backend in detail.",
      "",
      commandLine("backend install", " <backendId>"),
      "  Show install hints for a backend.",
      "  Flags: --run",
      "",
      commandLine("backend update", " <backendId>"),
      "  Show update hints for a backend.",
      "  Flags: --run"
    ]),
    "",
    "Common Flags",
    formatHelpBlock(COMMON_HELP_FLAGS),
    "",
    "Examples",
    formatHelpBlock([
      styleHelpCommand("morphase convert ./notes.docx ./notes.pdf"),
      styleHelpCommand("morphase extract ./paper.pdf --to markdown -o ./paper.md"),
      styleHelpCommand("morphase fetch 'https://example.com/article' --to markdown -o article.md"),
      styleHelpCommand("morphase media ./podcast.mp3 --to transcript -o transcript.txt"),
      styleHelpCommand("morphase pdf split ./report.pdf --pages 1-3,5 --output ./excerpt.pdf"),
      styleHelpCommand("morphase backend verify ffmpeg")
    ])
  ].join("\n");
}

function configureHelpColors(command: Command): Command {
  return command.configureHelp({
    styleCommandText: styleHelpCommand,
    styleSubcommandText: styleHelpCommand
  });
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

function packageManagerDelegationDisabledMessage(): string {
  return "Package-manager delegation is disabled. Set allowPackageManagerDelegation=true in ~/.morphase/config.json before using --run.";
}

function primaryHintCommand(hint: InstallHint | undefined): string | undefined {
  return hint?.kind === "package-manager" ? hint.command : undefined;
}

function printManualGuidance(hint: InstallHint | undefined) {
  if (!hint) {
    console.log(`\n  No install guidance is available. Install the backend manually and try again.`);
    return;
  }

  console.log(`\n  ${installHintSummary(hint)}`);
  if (hint.notes?.length) {
    for (const note of hint.notes) {
      console.log(`  ${note}`);
    }
  }
}

function printResolvedHint(label: string, hint: InstallHint | undefined) {
  if (!hint) {
    console.log(`${label}: no guidance available.`);
    return;
  }

  console.log(`${label}: ${installHintSummary(hint)}`);
  if (hint.url) {
    console.log(`  Docs: ${hint.url}`);
  }
  if (hint.notes?.length) {
    for (const note of hint.notes) {
      console.log(`  Note: ${note}`);
    }
  }
}

async function promptAndInstall(engine: MorphaseEngine, backendId: string): Promise<boolean> {
  const report = await engine.doctorBackend(backendId);
  const hint = report.installHints[0];
  const command = primaryHintCommand(hint);
  const delegationEnabled = engine.getConfig().allowPackageManagerDelegation;

  if (!hint) {
    console.log(formatDoctorReport(report));
    console.log(`\n  No install guidance is available. Install manually and try again.`);
    return false;
  }

  if (command && !delegationEnabled) {
    console.log(formatDoctorReport(report));
    console.log(`\n  ${packageManagerDelegationDisabledMessage()}`);
    console.log(`  Run this command manually: ${command}`);
    return false;
  }

  if (!process.stdin.isTTY || !canAutoInstall(hint, {
    delegationEnabled,
    interactive: Boolean(process.stdin.isTTY)
  })) {
    console.log(formatDoctorReport(report));
    printManualGuidance(hint);
    return false;
  }

  console.log("");
  console.log(formatDoctorReport(report));
  console.log("");

  if (!command) {
    return false;
  }

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

  const cmd = hint.structuredCommand;
  if (!cmd) {
    console.log(`No structured command available for automatic execution. Run manually: ${command}`);
    return false;
  }

  try {
    await execa(cmd.file, cmd.args, { stdio: "inherit" });
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
  const hint = hints[0];

  if (!hint) {
    console.log(`No ${mode} hints are available for ${backendId}.`);
    return;
  }

  const command = primaryHintCommand(hint);
  printResolvedHint(`${mode} hint for ${backendId}`, hint);
  if (hints[1]) {
    console.log("");
    printResolvedHint("manual fallback", hints[1]);
  }

  if (!run || !command) {
    return;
  }

  if (!engine.getConfig().allowPackageManagerDelegation) {
    throw new Error(packageManagerDelegationDisabledMessage());
  }

  if (!canAutoInstall(hint, {
    delegationEnabled: engine.getConfig().allowPackageManagerDelegation,
    interactive: Boolean(process.stdin.isTTY)
  })) {
    throw new Error(
      "Morphase can only delegate install and update commands when a detected package manager is available in an interactive terminal."
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

  const cmd = hint.structuredCommand;
  if (!cmd) {
    throw new Error(`No structured command available for delegated ${mode}. Run the printed command manually.`);
  }

  await execa(cmd.file, cmd.args, { stdio: "inherit" });
}

async function main() {
  const engine = await MorphaseEngine.create();
  const program = configureHelpColors(new Command());

  program.configureOutput({
    getOutHasColors: () => Boolean(process.stdout.isTTY),
    getErrHasColors: () => Boolean(process.stderr.isTTY)
  });

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
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
      }
    });

  collectCommonOptions(program.command("fetch <url>").description("Fetch a URL into another format"))
    .requiredOption("--to <format>", "Desired output format")
    .option("-o, --output <path>", "Output path")
    .option("--format <format>", "Transcript format for --to transcript: text or markdown")
    .option("--quality <quality>", "Media quality: best, high, medium, or low")
    .action(async (url, options) => {
      try {
        const from: ResourceKind | undefined = isYoutubeUrl(url) ? "youtube-url" : isMediaUrl(url) ? "media-url" : "url";
        const mergedOptions: Record<string, unknown> = {
          ...(options.format ? { format: options.format } : {}),
          ...(options.quality ? { quality: options.quality } : {})
        };
        await handleJob(
          engine,
          buildRequest(options, {
            input: url,
            from,
            to: options.to as ResourceKind,
            output: options.output as string | undefined,
            options: Object.keys(mergedOptions).length > 0 ? mergedOptions : {}
          }),
          { setExitCode: true }
        );
      } catch (error) {
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
      }
    });

  const image = program.command("image").description("Image operations");

  collectCommonOptions(
    image.command("compress <input>").description("Compress an image file")
      .option("-o, --output <path>", "Output path")
  )
    .action(async (input, options) => {
      try {
        const from = inferResourceKind(input);
        if (!from || !["jpg", "png", "webp", "heic"].includes(from)) {
          throw new Error("Image compression expects an image input such as .jpg, .png, .webp, or .heic.");
        }
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
        printCliError(error, { setExitCode: true });
      }
    });

  const video = program.command("video").description("Video operations");

  collectCommonOptions(
    video.command("compress <input>").description("Compress a video file")
      .option("-o, --output <path>", "Output path")
  )
    .action(async (input, options) => {
      try {
        const from = inferResourceKind(input);
        if (!from || !["mp4", "mov", "mkv"].includes(from)) {
          throw new Error("Video compression expects a video input such as .mp4, .mov, or .mkv.");
        }
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
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
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
      printCliError(error, { setExitCode: true });
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
      printCliError(error, { setExitCode: true });
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
      printCliError(error, { setExitCode: true });
    }
  });

  backend.command("verify <backendId>").action(async (backendId) => {
    try {
      const report = await engine.doctorBackend(backendId);
      console.log(formatDoctorReport(report));
    } catch (error) {
      printCliError(error, { setExitCode: true });
    }
  });

  backend
    .command("install <backendId>")
    .option("--run", "Run the suggested package-manager command after confirmation", false)
    .action(async (backendId, options) => {
      try {
        await printBackendHints(engine, backendId, "install", options.run as boolean);
      } catch (error) {
        printCliError(error, { setExitCode: true });
      }
    });

  backend
    .command("update <backendId>")
    .option("--run", "Run the suggested package-manager command after confirmation", false)
    .action(async (backendId, options) => {
      try {
        await printBackendHints(engine, backendId, "update", options.run as boolean);
      } catch (error) {
        printCliError(error, { setExitCode: true });
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
        printCliError(error, { setExitCode: true });
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
      printCliError(error, { setExitCode: true });
    }

    return;
  }

  const topLevelArgs = process.argv.slice(2);
  if (
    topLevelArgs.length === 1 &&
    (topLevelArgs[0] === "--help" || topLevelArgs[0] === "-h" || topLevelArgs[0] === "help")
  ) {
    program.outputHelp();
    console.log(buildTopLevelHelp());
    return;
  }

  await program.parseAsync(process.argv);
}

main().catch((error) => {
  printCliError(error, { setExitCode: true });
});
