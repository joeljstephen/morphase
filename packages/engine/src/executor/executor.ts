import fs from "node:fs/promises";
import path from "node:path";

import { execa } from "execa";

import { inferResourceKind, type JobRequest, type JobResult, type MorphaseError, type PlannedExecution, type ResourceKind, type Route } from "@morphase/shared";

import { createError } from "../errors/morphase-error.js";
import { Logger } from "../logging/logger.js";

const friendlyResourceNames: Record<string, string> = {
  markdown: "Markdown (.md)",
  html: "HTML (.html)",
  docx: "Word document (.docx)",
  pptx: "PowerPoint (.pptx)",
  xlsx: "Excel (.xlsx)",
  odt: "OpenDocument text (.odt)",
  ods: "OpenDocument spreadsheet (.ods)",
  odp: "OpenDocument presentation (.odp)",
  pdf: "PDF (.pdf)",
  txt: "plain text (.txt)",
  jpg: "JPEG image (.jpg)",
  png: "PNG image (.png)",
  webp: "WebP image (.webp)",
  heic: "HEIC image (.heic)",
  mp3: "MP3 audio (.mp3)",
  wav: "WAV audio (.wav)",
  mp4: "MP4 video (.mp4)",
  mov: "MOV video (.mov)",
  mkv: "MKV video (.mkv)",
  url: "web URL",
  "youtube-url": "YouTube URL",
  "media-url": "media URL",
  subtitle: "subtitle file",
  transcript: "transcript file"
};

function friendlyKind(kind: ResourceKind | undefined): string {
  return kind ? (friendlyResourceNames[kind] ?? kind) : "unknown format";
}

function detectInputMismatch(input: string, route: Route): string | null {
  if (route.kind !== "conversion") {
    return null;
  }

  const inferred = inferResourceKind(input);
  if (!inferred || inferred === "url" || inferred === "youtube-url" || inferred === "media-url") {
    return null;
  }

  if (inferred !== route.from) {
    return `The input file appears to be ${friendlyKind(inferred)}, but this route expects ${friendlyKind(route.from)} as input.`;
  }

  return null;
}

export function enrichError(
  pluginId: string,
  error: MorphaseError,
  stderr: string,
  input?: string,
  route?: Route
): MorphaseError {
  const mismatch = input && route ? detectInputMismatch(input, route) : null;
  if (mismatch) {
    return {
      ...error,
      message: mismatch,
      likelyCause: "The input file format does not match what this backend can process.",
      suggestedFixes: [
        `Use a ${friendlyKind(route?.kind === "conversion" ? route.from : undefined)} file as input instead.`,
        "Run morphase without arguments to use the interactive wizard, which matches routes to file types."
      ]
    };
  }

  if (pluginId === "pandoc") {
    if (/getopt|unknown option|unrecognized option/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Pandoc received an unsupported option or flag.",
        suggestedFixes: ["Update pandoc to the latest version (morphase backend update pandoc)."]
      };
    }

    if (/could not parse|parse failure|not a valid|failed to parse/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Pandoc could not parse the input file. The file may be corrupted, empty, or in a different format than expected.",
        suggestedFixes: [
          "Verify the input file opens correctly in its native application.",
          "Make sure the file extension matches the actual content.",
          "Try opening the file and re-saving it before converting."
        ]
      };
    }

    if (/pdf engine|pdflatex|xelatex|lualatex/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Pandoc needs a PDF engine installed to produce PDF output.",
        suggestedFixes: [
          "Install a LaTeX distribution (e.g. BasicTeX or MacTeX on macOS).",
          "Alternatively, convert to DOCX first, then use LibreOffice for PDF output."
        ]
      };
    }

    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Pandoc could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "Pandoc failed to convert the file. The input format may not match the file contents, or the file may be corrupted.",
        suggestedFixes: [
          "Verify the input file is a valid " + (route?.kind === "conversion" ? friendlyKind(route.from) : "document") + ".",
          "Try a different output format.",
          "Run morphase doctor to verify pandoc is healthy."
        ]
      };
    }
  }

  if (pluginId === "libreoffice") {
    if (/no such file|not found|ENOENT|could not stat/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "LibreOffice could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "LibreOffice failed to convert the file. The input may not be a supported document format.",
        suggestedFixes: [
          "Verify the input file is a valid " + (route?.kind === "conversion" ? friendlyKind(route.from) : "document") + ".",
          "Try opening the file in LibreOffice directly to check if it is valid.",
          "Run morphase doctor to verify LibreOffice is healthy."
        ]
      };
    }
  }

  if (pluginId === "imagemagick") {
    if (/no decode delegate|not authorized|unrecognized/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "ImageMagick cannot read this image format. It may not have the required delegate installed.",
        suggestedFixes: [
          "Verify the input file is a valid image.",
          "HEIC or WebP support may require additional delegates in your ImageMagick installation.",
          "Try converting to a more common format first (e.g. PNG or JPEG)."
        ]
      };
    }

    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "ImageMagick could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "ImageMagick failed to convert the image. The input may not be a valid or supported image file.",
        suggestedFixes: [
          "Verify the input file is a valid " + (route?.kind === "conversion" ? friendlyKind(route.from) : "image") + ".",
          "Run morphase doctor to check for delegate warnings."
        ]
      };
    }
  }

  if (pluginId === "ffmpeg") {
    if (/does not contain any stream/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The input file does not contain the expected audio or video stream.",
        suggestedFixes: [
          "Verify the input file has the expected media track.",
          "The video may have been recorded without sound."
        ]
      };
    }

    if (/invalid data found|not found any stream|cannot find/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "FFmpeg could not read the input file. It may not be a valid media file.",
        suggestedFixes: [
          "Verify the input file is a valid " + (route?.kind === "conversion" ? friendlyKind(route.from) : "media file") + ".",
          "Try playing the file in a media player to check if it works."
        ]
      };
    }

    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "FFmpeg could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "FFmpeg failed to process the file. The input format may not match the file contents.",
        suggestedFixes: [
          "Verify the input file is a valid " + (route?.kind === "conversion" ? friendlyKind(route.from) : "media file") + ".",
          "Run morphase doctor to verify ffmpeg is healthy."
        ]
      };
    }
  }

  if (pluginId === "qpdf") {
    if (/not a PDF file|does not look like a PDF/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The input file is not a valid PDF.",
        suggestedFixes: [
          "Verify the input file is a PDF document.",
          "The file may be corrupted or have the wrong extension."
        ]
      };
    }

    if (/no such file|not found|ENOENT|unable to open/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "qpdf could not find or open the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (/password/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The PDF is password-protected.",
        suggestedFixes: ["Morphase does not support encrypted or password-protected PDFs."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "qpdf failed to process the PDF. The file may be corrupted or not a valid PDF.",
        suggestedFixes: [
          "Verify the input file is a valid PDF.",
          "Try opening it in a PDF reader to check."
        ]
      };
    }
  }

  if (pluginId === "trafilatura") {
    if (/no content|could not (fetch|download|extract)/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Trafilatura could not extract content from the URL.",
        suggestedFixes: [
          "Check that the URL is correct and accessible.",
          "The page may require JavaScript or be behind a paywall."
        ]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "Trafilatura failed to extract content from the URL.",
        suggestedFixes: [
          "Verify the URL points to a page with article or text content.",
          "The page may require JavaScript rendering which trafilatura does not support."
        ]
      };
    }
  }

  if (pluginId === "ytdlp") {
    if (/requested format not available/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The requested format is not available for this video.",
        suggestedFixes: [
          "Try a different output format.",
          "The video may not support the requested quality or format."
        ]
      };
    }

    if (/video unavailable|private/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The YouTube video is unavailable, private, or region-locked.",
        suggestedFixes: [
          "Verify the URL is correct.",
          "The video may be private, deleted, or geo-restricted."
        ]
      };
    }

    if (/sign in|bot/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "YouTube is requiring authentication or blocking the request.",
        suggestedFixes: [
          "Update yt-dlp to the latest version (morphase backend update ytdlp).",
          "YouTube may be rate-limiting or blocking automated requests."
        ]
      };
    }

    if (/ffmpeg/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "FFmpeg is required for this operation but is not installed.",
        suggestedFixes: [
          "Install ffmpeg (brew install ffmpeg on macOS).",
          "MP3 extraction requires ffmpeg for audio conversion."
        ]
      };
    }

    if (/ENOENT.*\.vtt/i.test(error.message)) {
      return {
        ...error,
        message: "No subtitles were found for this video.",
        likelyCause: "The video does not have subtitles or auto-generated captions in the requested language.",
        suggestedFixes: [
          "This platform or video may not provide subtitles.",
          "Try saving as MP4 instead: morphase fetch \"<url>\" --to mp4"
        ]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "yt-dlp failed to download or process the media.",
        suggestedFixes: [
          "Verify the URL is correct.",
          "The content may be private, region-locked, or removed.",
          "Update yt-dlp (morphase backend update ytdlp)."
        ]
      };
    }
  }

  if (pluginId === "summarize") {
    if (/node.*version|unsupported/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "summarize requires Node 22 or later.",
        suggestedFixes: [
          "Upgrade Node.js to version 22 or later.",
          "Run `node --version` to check your current version."
        ]
      };
    }

    if (/transcript|subtitle/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "summarize could not extract a transcript from this content.",
        suggestedFixes: [
          "The video may not have subtitles or transcript data available.",
          "Try the yt-dlp fallback: morphase fetch \"<url>\" --to transcript --backend ytdlp"
        ]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "summarize failed to process the content.",
        suggestedFixes: [
          "Verify the URL is correct.",
          "Try the yt-dlp fallback: morphase fetch \"<url>\" --to transcript --backend ytdlp"
        ]
      };
    }
  }

  if (pluginId === "markitdown") {
    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "MarkItDown could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "MarkItDown failed to extract content from the file. The format may not be supported.",
        suggestedFixes: [
          "Verify the input file is a supported format (PDF, DOCX, PPTX, HTML, or XLSX).",
          "The file may be corrupted or contain unsupported content."
        ]
      };
    }
  }

  if (pluginId === "jpegoptim" || pluginId === "optipng") {
    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: `${pluginId} could not find the input file.`,
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (/not a (JPEG|PNG)|corrupt|invalid/i.test(stderr)) {
      return {
        ...error,
        likelyCause: `The input file is not a valid ${pluginId === "jpegoptim" ? "JPEG" : "PNG"} image.`,
        suggestedFixes: [
          `Verify the input is a valid ${pluginId === "jpegoptim" ? "JPEG" : "PNG"} file.`,
          "The file may have the wrong extension."
        ]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: `${pluginId} failed to optimize the image.`,
        suggestedFixes: [
          `Verify the input file is a valid ${pluginId === "jpegoptim" ? "JPEG" : "PNG"} image.`,
          "Run morphase doctor to verify the backend is healthy."
        ]
      };
    }
  }

  if (pluginId === "whisper") {
    if (/no such file|not found|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Whisper could not find the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "Whisper failed to transcribe the audio. The file may not be a valid audio or video file.",
        suggestedFixes: [
          "Verify the input file is a valid audio or video file.",
          "Whisper also requires FFmpeg to decode media files."
        ]
      };
    }
  }

  if (pluginId === "img2pdf") {
    if (/not found|no such file|ENOENT/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "img2pdf could not find one or more input files.",
        suggestedFixes: ["Check that all input file paths are correct and the files exist."]
      };
    }

    if (/unsupported|not a valid|cannot.*image|unrecognized/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "img2pdf cannot process one or more of the input files. Only JPEG and PNG images are supported.",
        suggestedFixes: [
          "Ensure all input files are JPEG or PNG images.",
          "WebP images are not supported by img2pdf. Convert them to PNG or JPEG first.",
          "Check that no corrupted or zero-byte files are included."
        ]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "img2pdf failed to create the PDF from the provided images.",
        suggestedFixes: [
          "Verify all input files are valid JPEG or PNG images.",
          "Run morphase doctor to verify img2pdf is healthy."
        ]
      };
    }
  }

  if (pluginId === "poppler") {
    if (/not a PDF|does not look like a PDF|syntax error/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The input file is not a valid PDF.",
        suggestedFixes: [
          "Verify the input file is a PDF document.",
          "The file may be corrupted or have the wrong extension."
        ]
      };
    }

    if (/no such file|not found|ENOENT|unable to open/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "Poppler could not find or open the input file.",
        suggestedFixes: ["Check that the file path is correct and the file exists."]
      };
    }

    if (/password|encrypted/i.test(stderr)) {
      return {
        ...error,
        likelyCause: "The PDF is encrypted or password-protected.",
        suggestedFixes: ["Morphase does not support encrypted or password-protected PDFs."]
      };
    }

    if (error.code === "BACKEND_EXECUTION_FAILED" && !error.likelyCause) {
      return {
        ...error,
        likelyCause: "Poppler failed to process the PDF.",
        suggestedFixes: [
          "Verify the input file is a valid PDF.",
          "Run morphase doctor to verify poppler is healthy."
        ]
      };
    }
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

async function ensureParentDirectory(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function moveOutput(source: string, target: string): Promise<void> {
  await ensureParentDirectory(target);

  try {
    await fs.rename(source, target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }

    await fs.copyFile(source, target);
    await fs.unlink(source);
  }
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

      let dirSnapshot: Set<string> | null = null;
      if (step.plan.collectFromDir) {
        dirSnapshot = new Set();
        try {
          const existing = await fs.readdir(step.plan.collectFromDir);
          for (const entry of existing) dirSnapshot.add(entry);
        } catch {}
      }

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

        if (step.plan.stdoutFile) {
          await ensureParentDirectory(step.plan.stdoutFile);
          await fs.writeFile(step.plan.stdoutFile, result.stdout ?? "", "utf8");
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
            await moveOutput(mapping.source, mapping.target);
            outputPaths.add(mapping.target);
          }
        }

        for (const output of step.plan.expectedOutputs ?? []) {
          outputPaths.add(output);
        }

        if (step.plan.collectFromDir && dirSnapshot !== null) {
          try {
            const entries = await fs.readdir(step.plan.collectFromDir);
            for (const entry of entries) {
              if (dirSnapshot.has(entry)) continue;
              const fullPath = path.join(step.plan.collectFromDir, entry);
              try {
                const stat = await fs.stat(fullPath);
                if (stat.isFile()) {
                  outputPaths.add(fullPath);
                }
              } catch {}
            }
          } catch {}
        }

        if (step.plan.stdoutFile) {
          outputPaths.add(step.plan.stdoutFile);
        }
      } catch (error) {
        const baseError: MorphaseError =
          error instanceof Error && "details" in error
            ? (error as { details: MorphaseError }).details
            : {
                code: "BACKEND_EXECUTION_FAILED",
                message: error instanceof Error ? error.message : String(error),
                backendId: step.pluginId
              };

        const stepInput = typeof step.plan.args.find((arg, i) => {
          const prev = step.plan.args[i - 1];
          return prev !== "-o" && prev !== "--output" && prev !== "--dest" && prev !== "--out" && !arg.startsWith("-");
        }) === "string" && !step.plan.args[0]?.startsWith("-")
          ? step.plan.args[0]
          : Array.isArray(request.input) ? request.input[0] : request.input;

        const enrichedError = enrichError(
          step.pluginId,
          baseError,
          baseError.rawStderr ?? (error instanceof Error ? error.message : ""),
          stepInput,
          step.route
        );

        return {
          jobId,
          status: "failed",
          backendId: execution.selectedPluginId,
          outputPaths: [...outputPaths],
          logs,
          warnings,
          error: enrichedError,
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
          message: "The backend completed but morphase could not find the expected output files.",
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
