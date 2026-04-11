import path from "node:path";

import prompts from "prompts";

import { deriveOutputPath, inferResourceKind, type JobRequest, type ResourceKind } from "@muxory/shared";

const categories = [
  { title: "Documents and markup", value: "documents" },
  { title: "PDF operations", value: "pdf" },
  { title: "Images", value: "images" },
  { title: "Audio and video", value: "media" },
  { title: "Website extraction", value: "web" }
] as const;

const documentRoutes = [
  { title: "Markdown to PDF", from: "markdown", to: "pdf" },
  { title: "Markdown to DOCX", from: "markdown", to: "docx" },
  { title: "HTML to PDF", from: "html", to: "pdf" },
  { title: "HTML to Markdown", from: "html", to: "markdown" },
  { title: "DOCX to PDF", from: "docx", to: "pdf" },
  { title: "PPTX to PDF", from: "pptx", to: "pdf" },
  { title: "XLSX to PDF", from: "xlsx", to: "pdf" }
] as const;

const imageRoutes = [
  { title: "JPG to PNG", from: "jpg", to: "png" },
  { title: "PNG to JPG", from: "png", to: "jpg" },
  { title: "WEBP to PNG", from: "webp", to: "png" },
  { title: "WEBP to JPG", from: "webp", to: "jpg" }
] as const;

const mediaRoutes = [
  { title: "MP4 to MP3", from: "mp4", to: "mp3" },
  { title: "MOV to MP4", from: "mov", to: "mp4" },
  { title: "MKV to MP4", from: "mkv", to: "mp4" },
  { title: "WAV to MP3", from: "wav", to: "mp3" },
  { title: "MP3 to WAV", from: "mp3", to: "wav" }
] as const;

export async function runWizard(): Promise<JobRequest | null> {
  const categoryAnswer = await prompts({
    type: "select",
    name: "category",
    message: "What do you want to do?",
    choices: categories.map((item) => ({ title: item.title, value: item.value }))
  });

  const category = categoryAnswer.category as string | undefined;
  if (!category) {
    return null;
  }

  if (category === "pdf") {
    const operationAnswer = await prompts({
      type: "select",
      name: "operation",
      message: "Which PDF operation do you want?",
      choices: [
        { title: "Merge PDFs", value: "merge" },
        { title: "Split/extract page range", value: "split" },
        { title: "Optimize PDF", value: "optimize" }
      ]
    });

    if (!operationAnswer.operation) {
      return null;
    }

    if (operationAnswer.operation === "merge") {
      const mergeAnswers = await prompts([
        {
          type: "list",
          name: "inputs",
          message: "Enter the input PDF paths (comma-separated).",
          separator: ","
        },
        {
          type: "text",
          name: "output",
          message: "Where should the merged PDF be written?"
        }
      ]);

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
        message: "Where is the input PDF?"
      },
      {
        type: "text",
        name: "pages",
        message: "Which page range should be extracted? Example: 1-3,5"
      },
      {
        type: "text",
        name: "output",
        message: "Where should the output PDF be written?"
      }
    ]);

    return {
      input: splitAnswers.input,
      from: "pdf",
      operation: operationAnswer.operation,
      output: splitAnswers.output,
      options: splitAnswers.pages ? { pages: splitAnswers.pages } : {}
    };
  }

  if (category === "web") {
    const fetchAnswers = await prompts([
      {
        type: "select",
        name: "to",
        message: "Which outcome do you want?",
        choices: [
          { title: "Markdown", value: "markdown" },
          { title: "Plain text", value: "txt" }
        ]
      },
      {
        type: "text",
        name: "input",
        message: "What URL should Muxory fetch?"
      }
    ]);

    if (!fetchAnswers.input) {
      return null;
    }

    const output = deriveOutputPath(fetchAnswers.input, fetchAnswers.to as ResourceKind);
    const outputAnswer = await prompts({
      type: "text",
      name: "output",
      message: "Suggested output path:",
      initial: output
    });

    if (!outputAnswer.output) {
      return null;
    }

    return {
      input: fetchAnswers.input,
      from: "url",
      to: fetchAnswers.to,
      output: outputAnswer.output
    };
  }

  const routeChoices =
    category === "documents"
      ? documentRoutes
      : category === "images"
        ? imageRoutes
        : mediaRoutes;

  const routeAnswer = await prompts({
    type: "select",
    name: "routeIndex",
    message: "Which outcome do you want?",
    choices: routeChoices.map((route, index) => ({ title: route.title, value: index }))
  });

  if (routeAnswer.routeIndex === undefined) {
    return null;
  }

  const selected = routeChoices[routeAnswer.routeIndex] as {
    from: ResourceKind;
    to: ResourceKind;
  };

  const inputAnswer = await prompts({
    type: "text",
    name: "input",
    message: "Where is the input file?"
  });

  if (!inputAnswer.input) {
    return null;
  }

  const inferredOutput = path.resolve(
    deriveOutputPath(inputAnswer.input, selected.to)
  );
  const outputAnswer = await prompts({
    type: "text",
    name: "output",
    message: "Suggested output path:",
    initial: inferredOutput
  });

  return {
    input: inputAnswer.input,
    from: selected.from ?? inferResourceKind(inputAnswer.input),
    to: selected.to,
    output: outputAnswer.output
  };
}

