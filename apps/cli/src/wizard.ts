import path from "node:path";

import prompts from "prompts";

import { deriveOperationOutputPath, deriveOutputPath, inferResourceKind, isMediaUrl, isUrl, isYoutubeUrl, type JobRequest, type ResourceKind } from "@morphase/shared";

const BACK = "__back__" as const;

type WizardStepResult = JobRequest | null | typeof BACK;

const categories = [
  { title: "Documents", description: "Convert markdown, HTML, Word, slides, and spreadsheets", value: "documents" },
  { title: "PDFs", description: "Merge, split, optimize, and convert PDFs", value: "pdf" },
  { title: "Images", description: "Convert and compress JPG, PNG, and WEBP", value: "images" },
  { title: "Audio & Video", description: "Convert audio/video formats and compress video", value: "media" },
  { title: "Web & URLs", description: "Save media or extract content from supported URLs", value: "web-url" }
] as const;

const documentRoutes = [
  { title: "Markdown → PDF", from: "markdown", to: "pdf" },
  { title: "Markdown → DOCX", from: "markdown", to: "docx" },
  { title: "HTML → PDF", from: "html", to: "pdf" },
  { title: "HTML → Markdown", from: "html", to: "markdown" },
  { title: "DOCX → PDF", from: "docx", to: "pdf" },
  { title: "PDF → DOCX", from: "pdf", to: "docx" },
  { title: "PPTX → PDF", from: "pptx", to: "pdf" },
  { title: "XLSX → PDF", from: "xlsx", to: "pdf" }
] as const;

const imageRoutes = [
  { title: "JPG → PNG", from: "jpg", to: "png" },
  { title: "PNG → JPG", from: "png", to: "jpg" },
  { title: "WEBP → PNG", from: "webp", to: "png" },
  { title: "WEBP → JPG", from: "webp", to: "jpg" },
  { title: "Images → PDF", hint: "JPG, PNG · one or many", from: "jpg", to: "pdf", multiImage: true },
  { title: "Compress JPEG", from: "jpg", to: undefined, operation: "compress" },
  { title: "Compress PNG", from: "png", to: undefined, operation: "compress" }
] as const;

const mediaRoutes = [
  { title: "MP4 → MP3", from: "mp4", to: "mp3" },
  { title: "MOV → MP4", from: "mov", to: "mp4" },
  { title: "MKV → MP4", from: "mkv", to: "mp4" },
  { title: "WAV → MP3", from: "wav", to: "mp3" },
  { title: "MP3 → WAV", from: "mp3", to: "wav" },
  { title: "Compress video", from: undefined, to: undefined, operation: "compress" }
] as const;

function backChoice<T>() {
  return { title: "Back", value: BACK as T };
}

function stripQuotes(value: string): string {
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

async function askOutputPath(suggestedPath: string): Promise<string | typeof BACK | undefined> {
  const answer = await prompts({
    type: "text",
    name: "output",
    message: "Save to:",
    initial: suggestedPath
  });
  return answer.output ? stripQuotes(answer.output) : undefined;
}

async function handlePdfCategory(): Promise<WizardStepResult> {
  const operationAnswer = await prompts({
    type: "select",
    name: "operation",
    message: "Choose a PDF task:",
    choices: [
      backChoice(),
      { title: "Merge PDFs", value: "merge" },
      { title: "Split or extract pages", value: "split" },
      { title: "Optimize or compress PDF", value: "optimize" },
      { title: "PDF → PNG pages", value: "pdf-to-png" },
      { title: "PDF → JPG pages", value: "pdf-to-jpg" },
      { title: "Extract embedded images", value: "extract-images" }
    ]
  });

  if (operationAnswer.operation === BACK || !operationAnswer.operation) {
    return BACK;
  }

  if (operationAnswer.operation === "merge") {
    const mergeAnswers = await prompts([
      {
        type: "list",
        name: "inputs",
        message: "Input PDF paths (comma-separated):",
        separator: ","
      },
      {
        type: "text",
        name: "output",
        message: "Save merged PDF to:"
      }
    ]);

    if (!mergeAnswers.inputs || !mergeAnswers.output) {
      return null;
    }

    return {
      input: mergeAnswers.inputs.map((p: string) => stripQuotes(p)),
      from: "pdf",
      operation: "merge",
      output: stripQuotes(mergeAnswers.output)
    };
  }

  if (operationAnswer.operation === "pdf-to-png" || operationAnswer.operation === "pdf-to-jpg") {
    const toFormat: ResourceKind = operationAnswer.operation === "pdf-to-png" ? "png" : "jpg";

    const inputAnswer = await prompts({
      type: "text",
      name: "input",
      message: "Input PDF path:"
    });

    if (!inputAnswer.input) {
      return null;
    }

    const inputPath = stripQuotes(inputAnswer.input);
    const suggestedOutput = path.resolve(deriveOutputPath(inputPath, toFormat));
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: inputPath,
      from: "pdf",
      to: toFormat,
      output
    };
  }

  if (operationAnswer.operation === "extract-images") {
    const inputAnswer = await prompts({
      type: "text",
      name: "input",
      message: "Input PDF path:"
    });

    if (!inputAnswer.input) {
      return null;
    }

    const inputPath = stripQuotes(inputAnswer.input);
    const parsed = path.parse(path.resolve(inputPath));
    const suggestedOutput = path.join(parsed.dir, `${parsed.name}-images`);
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: inputPath,
      from: "pdf",
      operation: "extract-images",
      output
    };
  }

  const splitAnswers = await prompts([
    {
      type: "text",
      name: "input",
      message: "Input PDF path:"
    },
    {
      type: "text",
      name: "pages",
      message: "Page range (e.g. 1-3,5):"
    },
    {
      type: "text",
      name: "output",
      message: "Save to:"
    }
  ]);

  if (!splitAnswers.input || !splitAnswers.output) {
    return null;
  }

  return {
    input: stripQuotes(splitAnswers.input),
    from: "pdf",
    operation: operationAnswer.operation,
    output: stripQuotes(splitAnswers.output),
    options: splitAnswers.pages ? { pages: splitAnswers.pages } : {}
  };
}

async function handleWebUrlCategory(): Promise<WizardStepResult> {
  const opAnswer = await prompts({
    type: "select",
    name: "operation",
    message: "What do you want to do with the URL?",
    choices: [
      backChoice(),
      { title: "Save video from URL as MP4", value: "save-video-mp4" },
      { title: "Save audio from URL as MP3", value: "save-audio-mp3" },
      { title: "Extract transcript from video URL", value: "extract-transcript" },
      { title: "Extract web page as Markdown", value: "extract-markdown" },
      { title: "Extract web page as plain text", value: "extract-text" }
    ]
  });

  if (opAnswer.operation === BACK || opAnswer.operation === undefined) {
    return BACK;
  }

  const operation = opAnswer.operation as string;

  if (
    operation === "save-video-mp4" ||
    operation === "save-audio-mp3" ||
    operation === "extract-transcript"
  ) {
    let hintMessage: string;
    let toFormat: ResourceKind;

    switch (operation) {
      case "save-video-mp4":
        hintMessage = "Paste a video URL from YouTube, Instagram, TikTok, or other supported sites";
        toFormat = "mp4";
        break;
      case "save-audio-mp3":
        hintMessage = "Paste a video or audio URL from YouTube, SoundCloud, or other supported sites";
        toFormat = "mp3";
        break;
      default:
        hintMessage = "Paste a video URL from YouTube or another supported site";
        toFormat = "transcript";
        break;
    }

    console.log("");
    console.log(`  ${"\x1b[2m"}${hintMessage}${"\x1b[0m"}`);
    console.log("");

    const urlAnswer = await prompts({
      type: "text",
      name: "input",
      message: "URL:"
    });

    if (!urlAnswer.input) {
      return null;
    }

    const rawUrl = stripQuotes(urlAnswer.input);
    const isYT = isYoutubeUrl(rawUrl);
    const isMedia = isMediaUrl(rawUrl);
    if (!isYT && !isMedia) {
      return null;
    }

    const from: ResourceKind = isYT ? "youtube-url" : "media-url";

    let format: string | undefined;
    if (operation === "extract-transcript") {
      const formatAnswer = await prompts({
        type: "select",
        name: "format",
        message: "Choose transcript format:",
        choices: [
          backChoice(),
          { title: "Plain text", value: "text" },
          { title: "Markdown", value: "markdown" }
        ]
      });

      if (formatAnswer.format === BACK || formatAnswer.format === undefined) {
        return BACK;
      }

      format = formatAnswer.format;
    }

    const inferredOutput = path.resolve(deriveOutputPath(rawUrl, toFormat));
    const suggestedOutput =
      format === "markdown" && toFormat === "transcript"
        ? inferredOutput.replace(/\.txt$/, ".md")
        : inferredOutput;
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: rawUrl,
      from,
      to: toFormat,
      output,
      options: format && format !== "text" ? { format } : {}
    };
  }

  let toFormat: ResourceKind;
  let hintMessage: string;

  if (operation === "extract-markdown") {
    toFormat = "markdown";
    hintMessage = "Paste a web page URL to extract as Markdown";
  } else {
    toFormat = "txt";
    hintMessage = "Paste a web page URL to extract as plain text";
  }

  console.log("");
  console.log(`  ${"\x1b[2m"}${hintMessage}${"\x1b[0m"}`);
  console.log("");

  const urlAnswer = await prompts({
    type: "text",
    name: "input",
    message: "URL:"
  });

  if (!urlAnswer.input) {
    return null;
  }

  const rawUrl = stripQuotes(urlAnswer.input);

  if (!isUrl(rawUrl)) {
    return null;
  }

  const suggestedOutput = deriveOutputPath(rawUrl, toFormat);
  const output = await askOutputPath(suggestedOutput);

  if (!output) {
    return null;
  }

  return {
    input: rawUrl,
    from: "url",
    to: toFormat,
    output
  };
}

async function handleRouteCategory(
  category: "documents" | "images" | "media"
): Promise<WizardStepResult> {
  const routeChoices =
    category === "documents"
      ? documentRoutes
      : category === "images"
        ? imageRoutes
        : mediaRoutes;

  const messageMap: Record<string, string> = {
    documents: "Choose a document conversion:",
    images: "Choose an image task:",
    media: "Choose a media task:"
  };

  const routeAnswer = await prompts({
    type: "select",
    name: "routeIndex",
    message: messageMap[category] ?? "Which operation?",
    choices: [
      backChoice(),
      ...routeChoices.map((route, index) => ({
        title: route.title,
        description: (route as { hint?: string }).hint,
        value: index
      }))
    ]
  });

  if (routeAnswer.routeIndex === BACK || routeAnswer.routeIndex === undefined) {
    return BACK;
  }

  const selected = routeChoices[routeAnswer.routeIndex] as {
    from: ResourceKind | undefined;
    to: ResourceKind | undefined;
    operation?: string;
    multiImage?: boolean;
  };

  if (selected.multiImage) {
    const imagesAnswer = await prompts({
      type: "list",
      name: "inputs",
      message: "Image path(s) — separate multiple with commas (JPG, PNG):",
      separator: ","
    });

    if (!imagesAnswer.inputs || imagesAnswer.inputs.length === 0) {
      return null;
    }

    const inputs = imagesAnswer.inputs.map((p: string) => stripQuotes(p));
    const suggestedOutput = path.resolve(deriveOutputPath(inputs[0], selected.to!));
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: inputs,
      from: selected.from ?? inferResourceKind(inputs[0]),
      to: selected.to,
      output
    };
  }

  const inputAnswer = await prompts({
    type: "text",
    name: "input",
    message: "Input file:"
  });

  if (!inputAnswer.input) {
    return null;
  }

  const inputPath = stripQuotes(inputAnswer.input);
  const from = selected.from ?? inferResourceKind(inputPath);

  if (selected.from) {
    const inferred = inferResourceKind(inputPath);
    if (inferred && inferred !== selected.from) {
      const ext = path.extname(inputPath);
      console.log(`  \x1b[33mWarning: Input looks like ${inferred} (${ext || "URL"}) but this route expects ${selected.from}.\x1b[0m`);
      const confirmAnswer = await prompts({
        type: "confirm",
        name: "proceed",
        message: "Continue anyway?",
        initial: false
      });
      if (!confirmAnswer.proceed) {
        return BACK;
      }
    }
  }

  if (selected.operation === "compress") {
    const resourceFrom = from ?? inferResourceKind(inputPath) ?? "mp4";
    const suggestedOutput = path.resolve(deriveOperationOutputPath(inputPath, resourceFrom));
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: inputPath,
      from: resourceFrom,
      operation: "compress",
      output
    };
  }

  const to = selected.to!;
  const suggestedOutput = path.resolve(deriveOutputPath(inputPath, to));
  const output = await askOutputPath(suggestedOutput);

  if (!output) {
    return null;
  }

  return {
    input: inputPath,
    from: from ?? inferResourceKind(inputPath),
    to,
    output
  };
}

export async function runWizard(): Promise<JobRequest | null> {
  const dim = "\x1b[2m";
  const bold = "\x1b[1m";
  const reset = "\x1b[0m";

  console.log("");
  console.log(`  ${bold}morphase${reset}`);
  console.log(`  ${dim}Convert, download, and transform files on your machine.${reset}`);
  console.log("");

  while (true) {
    const categoryAnswer = await prompts({
      type: "select",
      name: "category",
      message: "What do you want to do?",
      choices: categories.map((item) => ({
        title: item.title,
        description: item.description,
        value: item.value
      }))
    });

    const category = categoryAnswer.category as string | undefined;
    if (!category) {
      return null;
    }

    let result: WizardStepResult;

    switch (category) {
      case "pdf":
        result = await handlePdfCategory();
        break;
      case "web-url":
        result = await handleWebUrlCategory();
        break;
      default:
        result = await handleRouteCategory(category as "documents" | "images" | "media");
        break;
    }

    if (result === BACK) {
      continue;
    }

    return result;
  }
}
