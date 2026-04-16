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

function defaultWorkingDirectory(): string {
  return process.env.MORPHASE_CWD || process.env.INIT_CWD || process.cwd();
}

function decodeUrlComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sanitizeDerivedStem(value: string, fallback = "output"): string {
  const decoded = decodeUrlComponent(value);
  const tail = decoded.split(/[\\/]+/).filter(Boolean).pop() ?? fallback;
  const sanitized = tail
    .replace(/[<>:"|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/^\.+/, "")
    .replace(/\.+$/, "")
    .replace(/-+/g, "-")
    .trim();

  if (!sanitized || sanitized === "." || sanitized === "..") {
    return fallback;
  }

  return sanitized.slice(0, 120);
}

export function deriveUrlOutputStem(input: string, ext?: string, fallback = "output"): string {
  try {
    const parsed = new URL(input);
    const candidate = parsed.searchParams.get("v")
      || parsed.pathname.split("/").filter(Boolean).pop()
      || fallback;
    const sanitized = sanitizeDerivedStem(candidate, fallback);

    if (ext && sanitized.toLowerCase().endsWith(ext.toLowerCase())) {
      const trimmed = sanitized.slice(0, -ext.length).replace(/[.\s-]+$/, "");
      return trimmed || fallback;
    }

    return sanitized;
  } catch {
    return fallback;
  }
}

export function extensionForResourceKind(kind: ResourceKind): string {
  return extensionByKind[kind];
}

export function deriveOutputPath(input: string | string[], to: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const ext = extensionForResourceKind(to);

  if (isUrl(first)) {
    return path.join(defaultWorkingDirectory(), `${deriveUrlOutputStem(first, ext)}${ext}`);
  }

  const filePath = path.parse(first);
  return path.join(filePath.dir || defaultWorkingDirectory(), `${filePath.name}${ext}`);
}

export function deriveOperationOutputPath(input: string | string[], from: ResourceKind): string {
  const first = Array.isArray(input) ? input[0] : input;
  const ext = extensionForResourceKind(from);

  if (isUrl(first)) {
    return deriveOutputPath(input, from);
  }

  const filePath = path.parse(first);
  return path.join(filePath.dir || defaultWorkingDirectory(), `${filePath.name}_compressed${ext}`);
}

export async function ensureDirectoryExists(directory: string): Promise<void> {
  await fs.mkdir(directory, { recursive: true });
}

export function replaceExtension(filePath: string, extension: string): string {
  const parsed = path.parse(filePath);
  return path.join(parsed.dir, `${parsed.name}${extension}`);
}
