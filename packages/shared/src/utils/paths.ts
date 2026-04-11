import fs from "node:fs/promises";
import path from "node:path";

import type { ResourceKind } from "../types/index.js";
import { isUrl } from "./resources.js";

const extensionByKind: Record<ResourceKind, string> = {
  markdown: ".md",
  html: ".html",
  docx: ".docx",
  pptx: ".pptx",
  xlsx: ".xlsx",
  odt: ".odt",
  ods: ".ods",
  odp: ".odp",
  pdf: ".pdf",
  txt: ".txt",
  jpg: ".jpg",
  png: ".png",
  webp: ".webp",
  heic: ".heic",
  mp3: ".mp3",
  wav: ".wav",
  mp4: ".mp4",
  mov: ".mov",
  mkv: ".mkv",
  url: ".txt",
  "youtube-url": ".txt",
  "media-url": ".txt",
  subtitle: ".srt",
  transcript: ".txt"
};

export function extensionForResourceKind(kind: ResourceKind): string {
  return extensionByKind[kind];
}

export function deriveOutputPath(input: string | string[], to: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const ext = extensionForResourceKind(to);

  if (isUrl(first)) {
    try {
      const parsed = new URL(first);
      const videoId = parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop() || "output";
      return path.join(process.cwd(), `${videoId}${ext}`);
    } catch {
      return path.join(process.cwd(), `output${ext}`);
    }
  }

  const filePath = path.parse(first);
  return path.join(filePath.dir || process.cwd(), `${filePath.name}${ext}`);
}

export function deriveOperationOutputPath(input: string | string[], from: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const ext = extensionForResourceKind(from);

  if (isUrl(first)) {
    return deriveOutputPath(input, from);
  }

  const filePath = path.parse(first);
  return path.join(filePath.dir || process.cwd(), `${filePath.name}_compressed${ext}`);
}

export async function ensureDirectoryExists(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}
