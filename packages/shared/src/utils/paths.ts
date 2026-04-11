import fs from "node:fs/promises";
import path from "node:path";

import type { ResourceKind } from "../types/index.js";

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
  subtitle: ".srt",
  transcript: ".txt"
};

export function extensionForResourceKind(kind: ResourceKind): string {
  return extensionByKind[kind];
}

export function deriveOutputPath(input: string | string[], to: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const parsed = path.parse(first);
  return path.join(parsed.dir || process.cwd(), `${parsed.name}${extensionForResourceKind(to)}`);
}

export async function ensureDirectoryExists(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}
