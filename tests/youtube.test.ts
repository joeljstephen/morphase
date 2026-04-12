import { describe, expect, it } from "vitest";

import { Doctor } from "../packages/engine/src/doctor/doctor.js";
import { enrichError } from "../packages/engine/src/executor/executor.js";
import { ROUTE_PREFERENCES } from "../packages/shared/src/constants/routes.js";
import { isMediaUrl, isYoutubeUrl } from "../packages/shared/src/utils/resources.js";
import type { MuxoryError, MuxoryPlugin } from "../packages/shared/src/index.js";

describe("YouTube URL detection", () => {
  it("detects standard youtube.com watch URLs", () => {
    expect(isYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(true);
  });

  it("detects youtube.com without www", () => {
    expect(isYoutubeUrl("https://youtube.com/watch?v=abc")).toBe(true);
  });

  it("detects youtu.be short URLs", () => {
    expect(isYoutubeUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(true);
  });

  it("detects subdomains like m.youtube.com", () => {
    expect(isYoutubeUrl("https://m.youtube.com/watch?v=abc")).toBe(true);
  });

  it("rejects non-YouTube URLs", () => {
    expect(isYoutubeUrl("https://example.com")).toBe(false);
  });

  it("rejects non-URL strings", () => {
    expect(isYoutubeUrl("not a url")).toBe(false);
  });
});

describe("Media URL detection", () => {
  it("detects Instagram URLs", () => {
    expect(isMediaUrl("https://www.instagram.com/reel/abc123/")).toBe(true);
  });

  it("detects TikTok URLs", () => {
    expect(isMediaUrl("https://www.tiktok.com/@user/video/123456")).toBe(true);
  });

  it("detects Facebook URLs", () => {
    expect(isMediaUrl("https://www.facebook.com/watch/?v=123456")).toBe(true);
  });

  it("detects Twitter/X URLs", () => {
    expect(isMediaUrl("https://x.com/user/status/123456")).toBe(true);
    expect(isMediaUrl("https://twitter.com/user/status/123456")).toBe(true);
  });

  it("detects Reddit URLs", () => {
    expect(isMediaUrl("https://www.reddit.com/r/programming/comments/abc/")).toBe(true);
  });

  it("detects Vimeo URLs", () => {
    expect(isMediaUrl("https://vimeo.com/123456789")).toBe(true);
  });

  it("detects Twitch URLs", () => {
    expect(isMediaUrl("https://www.twitch.tv/videos/123456")).toBe(true);
  });

  it("detects SoundCloud URLs", () => {
    expect(isMediaUrl("https://soundcloud.com/artist/track")).toBe(true);
  });

  it("detects Dailymotion URLs", () => {
    expect(isMediaUrl("https://www.dailymotion.com/video/x123abc")).toBe(true);
  });

  it("does not flag YouTube URLs as media URLs", () => {
    expect(isMediaUrl("https://www.youtube.com/watch?v=abc")).toBe(false);
  });

  it("rejects generic URLs", () => {
    expect(isMediaUrl("https://example.com")).toBe(false);
  });

  it("rejects non-URL strings", () => {
    expect(isMediaUrl("not a url")).toBe(false);
  });
});

describe("Route preferences for media-url routes", () => {
  it("uses ytdlp for media-url->mp4", () => {
    expect(ROUTE_PREFERENCES["media-url->mp4"]).toEqual(["ytdlp"]);
  });

  it("uses ytdlp for media-url->mp3", () => {
    expect(ROUTE_PREFERENCES["media-url->mp3"]).toEqual(["ytdlp"]);
  });

  it("uses ytdlp for media-url->transcript", () => {
    expect(ROUTE_PREFERENCES["media-url->transcript"]).toEqual(["ytdlp"]);
  });
});

describe("Route preferences for YouTube routes", () => {
  it("prefers summarize for youtube-url->transcript", () => {
    const prefs = ROUTE_PREFERENCES["youtube-url->transcript"];
    expect(prefs).toBeDefined();
    expect(prefs[0]).toBe("summarize");
    expect(prefs).toContain("ytdlp");
  });

  it("uses ytdlp for youtube-url->mp4", () => {
    expect(ROUTE_PREFERENCES["youtube-url->mp4"]).toEqual(["ytdlp"]);
  });

  it("uses ytdlp for youtube-url->mp3", () => {
    expect(ROUTE_PREFERENCES["youtube-url->mp3"]).toEqual(["ytdlp"]);
  });
});

describe("Error enrichment for yt-dlp and summarize", () => {
  function makeError(partial: Partial<MuxoryError> = {}): MuxoryError {
    return {
      code: partial.code ?? "BACKEND_EXECUTION_FAILED",
      message: partial.message ?? "failed",
      ...partial
    };
  }

  it("enriches yt-dlp format not available error", () => {
    const enriched = enrichError("ytdlp", makeError(), "Requested format not available");
    expect(enriched.likelyCause).toContain("format");
    expect(enriched.suggestedFixes?.length).toBeGreaterThan(0);
  });

  it("enriches yt-dlp unavailable video error", () => {
    const enriched = enrichError("ytdlp", makeError(), "Video unavailable");
    expect(enriched.likelyCause).toContain("unavailable");
  });

  it("enriches yt-dlp bot detection error", () => {
    const enriched = enrichError("ytdlp", makeError(), "Sign in to confirm you are not a bot");
    expect(enriched.likelyCause).toContain("authentication");
    expect(enriched.suggestedFixes).toContainEqual(expect.stringContaining("Update yt-dlp"));
  });

  it("enriches yt-dlp ffmpeg missing error", () => {
    const enriched = enrichError("ytdlp", makeError(), "ffmpeg not found");
    expect(enriched.likelyCause).toContain("FFmpeg");
    expect(enriched.suggestedFixes).toContainEqual(expect.stringContaining("brew install ffmpeg"));
  });

  it("enriches yt-dlp missing subtitle file error", () => {
    const enriched = enrichError(
      "ytdlp",
      makeError({ message: "ENOENT: no such file or directory, rename '/tmp/video.en.vtt' -> '/tmp/video.txt'" }),
      ""
    );
    expect(enriched.message).toContain("subtitles");
    expect(enriched.likelyCause).toContain("subtitles");
    expect(enriched.suggestedFixes?.length).toBeGreaterThan(0);
  });

  it("enriches summarize Node version error", () => {
    const enriched = enrichError("summarize", makeError(), "unsupported Node version");
    expect(enriched.likelyCause).toContain("Node 22");
  });

  it("enriches summarize transcript extraction failure", () => {
    const enriched = enrichError("summarize", makeError(), "no transcript available");
    expect(enriched.likelyCause).toContain("transcript");
    expect(enriched.suggestedFixes).toContainEqual(expect.stringContaining("ytdlp"));
  });
});

describe("Doctor backend reports", () => {
  function createStubPlugin(id: string, installed: boolean): MuxoryPlugin {
    return {
      id,
      name: id,
      priority: 50,
      optional: true,
      capabilities: () => [],
      detect: async () => installed
        ? { installed: true, version: "1.0.0", command: id }
        : { installed: false, reason: `${id} not found` },
      verify: async () => installed
        ? { ok: true, issues: [], warnings: [] }
        : { ok: false, issues: ["not installed"], warnings: [] },
      getInstallHints: () => [{ manager: "brew", command: `brew install ${id}` }],
      getUpdateHints: () => [{ manager: "brew", command: `brew upgrade ${id}` }],
      plan: async () => null,
      explain: async () => id
    };
  }

  it("reports summarize not installed", async () => {
    const doctor = new Doctor();
    const report = await doctor.inspectBackend(createStubPlugin("summarize", false), "macos");
    expect(report.installed).toBe(false);
    expect(report.id).toBe("summarize");
    expect(report.installHints.length).toBeGreaterThan(0);
  });

  it("reports ytdlp installed and healthy", async () => {
    const doctor = new Doctor();
    const report = await doctor.inspectBackend(createStubPlugin("ytdlp", true), "macos");
    expect(report.installed).toBe(true);
    expect(report.verified).toBe(true);
    expect(report.version).toBe("1.0.0");
  });

  it("reports ffmpeg installed and healthy", async () => {
    const doctor = new Doctor();
    const report = await doctor.inspectBackend(createStubPlugin("ffmpeg", true), "macos");
    expect(report.installed).toBe(true);
    expect(report.verified).toBe(true);
  });
});
