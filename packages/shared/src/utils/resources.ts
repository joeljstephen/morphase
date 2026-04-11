import path from "node:path";

import type { ResourceKind, Route } from "../types/index.js";

const extensionMap: Record<string, ResourceKind> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".html": "html",
  ".htm": "html",
  ".docx": "docx",
  ".pptx": "pptx",
  ".xlsx": "xlsx",
  ".odt": "odt",
  ".ods": "ods",
  ".odp": "odp",
  ".pdf": "pdf",
  ".txt": "txt",
  ".jpg": "jpg",
  ".jpeg": "jpg",
  ".png": "png",
  ".webp": "webp",
  ".heic": "heic",
  ".mp3": "mp3",
  ".wav": "wav",
  ".mp4": "mp4",
  ".mov": "mov",
  ".mkv": "mkv",
  ".srt": "subtitle",
  ".vtt": "subtitle"
};

export function isUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isYoutubeUrl(input: string): boolean {
  if (!isUrl(input)) {
    return false;
  }

  const host = new URL(input).hostname.replace(/^www\./, "");
  return host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com");
}

const mediaHostPatterns = [
  "instagram.com",
  "tiktok.com",
  "facebook.com",
  "fb.watch",
  "fb.com",
  "twitter.com",
  "x.com",
  "t.co",
  "reddit.com",
  "vimeo.com",
  "twitch.tv",
  "dailymotion.com",
  "streamable.com",
  "soundcloud.com",
  "pinterest.com",
  "tumblr.com",
  "bilibili.com",
  "rumble.com",
  "kick.com"
];

export function isMediaUrl(input: string): boolean {
  if (!isUrl(input)) {
    return false;
  }

  const host = new URL(input).hostname.replace(/^www\./, "");
  return mediaHostPatterns.some((pattern) => host === pattern || host.endsWith(`.${pattern}`));
}

export function inferResourceKind(input: string): ResourceKind | undefined {
  if (isYoutubeUrl(input)) {
    return "youtube-url";
  }

  if (isMediaUrl(input)) {
    return "media-url";
  }

  if (isUrl(input)) {
    return "url";
  }

  return extensionMap[path.extname(input).toLowerCase()];
}

export function routeKey(route: Route): string {
  return route.kind === "conversion"
    ? `${route.from}->${route.to}`
    : `${route.resource}:${route.action}`;
}

