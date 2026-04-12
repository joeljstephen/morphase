import path from "node:path";

import prompts from "prompts";

import { deriveOutputPath, inferResourceKind, isMediaUrl, isUrl, isYoutubeUrl, type JobRequest, type ResourceKind } from "@morphase/shared";

const BACK = "__back__" as const;

type WizardStepResult = JobRequest | null | typeof BACK;

const categories = [
  { title: "Documents", description: "Convert between Markdown, HTML, DOCX, PDF, PPTX, XLSX", value: "documents" },
  { title: "PDF", description: "Merge, split, and optimize PDFs", value: "pdf" },
  { title: "Images", description: "Convert and compress JPG, PNG, WEBP", value: "images" },
  { title: "Audio & Video", description: "Convert between MP4, MP3, WAV, MOV, MKV", value: "media" },
  { title: "Download", description: "Save video & audio from any URL", value: "download" },
  { title: "Web pages", description: "Extract text from web pages", value: "web" }
] as const;

const documentRoutes = [
  { title: "Markdown to PDF", from: "markdown", to: "pdf" },
  { title: "Markdown to DOCX", from: "markdown", to: "docx" },
  { title: "HTML to PDF", from: "html", to: "pdf" },
  { title: "HTML to Markdown", from: "html", to: "markdown" },
  { title: "DOCX to PDF", from: "docx", to: "pdf" },
  { title: "PDF to Word (DOCX)", from: "pdf", to: "docx" },
  { title: "PPTX to PDF", from: "pptx", to: "pdf" },
  { title: "XLSX to PDF", from: "xlsx", to: "pdf" }
] as const;

const imageRoutes = [
  { title: "JPG to PNG", from: "jpg", to: "png" },
  { title: "PNG to JPG", from: "png", to: "jpg" },
  { title: "WEBP to PNG", from: "webp", to: "png" },
  { title: "WEBP to JPG", from: "webp", to: "jpg" },
  { title: "Compress JPEG", from: "jpg", to: undefined, operation: "compress" },
  { title: "Compress PNG", from: "png", to: undefined, operation: "compress" }
] as const;

const mediaRoutes = [
  { title: "MP4 to MP3", from: "mp4", to: "mp3" },
  { title: "MOV to MP4", from: "mov", to: "mp4" },
  { title: "MKV to MP4", from: "mkv", to: "mp4" },
  { title: "WAV to MP3", from: "wav", to: "mp3" },
  { title: "MP3 to WAV", from: "mp3", to: "wav" },
  { title: "Compress video", from: undefined, to: undefined, operation: "compress" }
] as const;

const downloadOperations = [
  { title: "Save as MP4", to: "mp4" as ResourceKind },
  { title: "Save as MP3", to: "mp3" as ResourceKind },
  { title: "Extract transcript", to: "transcript" as ResourceKind }
] as const;

const supportedPlatformsHint = "  Supported: YouTube, Instagram, TikTok, X, Facebook, Reddit, Vimeo, SoundCloud, and 1800+ more";

function backChoice<T>() {
  return { title: "Back", value: BACK as T };
}

async function askOutputPath(suggestedPath: string): Promise<string | typeof BACK | undefined> {
  const answer = await prompts({
    type: "text",
    name: "output",
    message: "Save to:",
    initial: suggestedPath
  });
  return answer.output;
}

async function handlePdfCategory(): Promise<WizardStepResult> {
  const operationAnswer = await prompts({
    type: "select",
    name: "operation",
    message: "PDF operation:",
    choices: [
      backChoice(),
      { title: "Merge PDFs", value: "merge" },
      { title: "Split / extract pages", value: "split" },
      { title: "Optimize / compress", value: "optimize" }
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
      input: mergeAnswers.inputs,
      from: "pdf",
      operation: "merge",
      output: mergeAnswers.output
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
    input: splitAnswers.input,
    from: "pdf",
    operation: operationAnswer.operation,
    output: splitAnswers.output,
    options: splitAnswers.pages ? { pages: splitAnswers.pages } : {}
  };
}

async function handleDownloadCategory(): Promise<WizardStepResult> {
  const opAnswer = await prompts({
    type: "select",
    name: "opIndex",
    message: "What do you want to save?",
    choices: [
      backChoice(),
      ...downloadOperations.map((op, index) => ({ title: op.title, value: index }))
    ]
  });

  if (opAnswer.opIndex === BACK || opAnswer.opIndex === undefined) {
    return BACK;
  }

  const selected = downloadOperations[opAnswer.opIndex];

  console.log("");
  console.log(`  ${"\x1b[2m"}${supportedPlatformsHint}${"\x1b[0m"}`);
  console.log("");

  const urlAnswer = await prompts({
    type: "text",
    name: "input",
    message: "Paste a URL:"
  });

  if (!urlAnswer.input) {
    return null;
  }

  const isYT = isYoutubeUrl(urlAnswer.input);
  const isMedia = isMediaUrl(urlAnswer.input);
  if (!isYT && !isMedia && !isUrl(urlAnswer.input)) {
    return null;
  }

  const from: ResourceKind = isYT ? "youtube-url" : "media-url";

  let format: string | undefined;
  if (selected.to === "transcript") {
    const formatAnswer = await prompts({
      type: "select",
      name: "format",
      message: "Transcript format:",
      choices: [
        { title: "Plain text", value: "text" },
        { title: "Markdown", value: "markdown" }
      ]
    });
    format = formatAnswer.format;
  }

  const inferredOutput = path.resolve(deriveOutputPath(urlAnswer.input, selected.to));
  const suggestedOutput = format === "markdown" && selected.to === "transcript"
    ? inferredOutput.replace(/\.txt$/, ".md")
    : inferredOutput;
  const output = await askOutputPath(suggestedOutput);

  if (!output) {
    return null;
  }

  return {
    input: urlAnswer.input,
    from,
    to: selected.to,
    output,
    options: format && format !== "text" ? { format } : {}
  };
}

async function handleWebCategory(): Promise<WizardStepResult> {
  const fetchAnswers = await prompts({
    type: "select",
    name: "to",
    message: "Output format:",
    choices: [
      backChoice(),
      { title: "Markdown", value: "markdown" },
      { title: "Plain text", value: "txt" }
    ]
  });

  if (fetchAnswers.to === BACK || fetchAnswers.to === undefined) {
    return BACK;
  }

  const urlAnswer = await prompts({
    type: "text",
    name: "input",
    message: "URL to extract:"
  });

  if (!urlAnswer.input) {
    return null;
  }

  const suggestedOutput = deriveOutputPath(urlAnswer.input, fetchAnswers.to as ResourceKind);
  const output = await askOutputPath(suggestedOutput);

  if (!output) {
    return null;
  }

  return {
    input: urlAnswer.input,
    from: "url",
    to: fetchAnswers.to,
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
    documents: "Convert what?",
    images: "Image operation:",
    media: "Media operation:"
  };

  const routeAnswer = await prompts({
    type: "select",
    name: "routeIndex",
    message: messageMap[category] ?? "Which operation?",
    choices: [
      backChoice(),
      ...routeChoices.map((route, index) => ({ title: route.title, value: index }))
    ]
  });

  if (routeAnswer.routeIndex === BACK || routeAnswer.routeIndex === undefined) {
    return BACK;
  }

  const selected = routeChoices[routeAnswer.routeIndex] as {
    from: ResourceKind | undefined;
    to: ResourceKind | undefined;
    operation?: string;
  };

  const inputAnswer = await prompts({
    type: "text",
    name: "input",
    message: "Input file:"
  });

  if (!inputAnswer.input) {
    return null;
  }

  const from = selected.from ?? inferResourceKind(inputAnswer.input);

  if (selected.from) {
    const inferred = inferResourceKind(inputAnswer.input);
    if (inferred && inferred !== selected.from) {
      const ext = path.extname(inputAnswer.input);
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
    const resourceFrom = from ?? inferResourceKind(inputAnswer.input) ?? "mp4";
    const suggestedOutput = path.resolve(deriveOutputPath(inputAnswer.input, resourceFrom));
    const output = await askOutputPath(suggestedOutput);

    if (!output) {
      return null;
    }

    return {
      input: inputAnswer.input,
      from: resourceFrom,
      operation: "compress",
      output
    };
  }

  const to = selected.to!;
  const suggestedOutput = path.resolve(deriveOutputPath(inputAnswer.input, to));
  const output = await askOutputPath(suggestedOutput);

  if (!output) {
    return null;
  }

  return {
    input: inputAnswer.input,
    from: from ?? inferResourceKind(inputAnswer.input),
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
      case "download":
        result = await handleDownloadCategory();
        break;
      case "web":
        result = await handleWebCategory();
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
