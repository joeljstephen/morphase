import { describe, expect, it } from "vitest";

import { libreOfficePlugin, pandocPlugin, trafilaturaPlugin, summarizePlugin, ytdlpPlugin } from "../packages/plugins/src/index.js";

describe("builtin plugins", () => {
  it("builds a pandoc plan for markdown to docx", async () => {
    const plan = await pandocPlugin.plan({
      input: "notes.md",
      from: "markdown",
      to: "docx",
      output: "notes.docx",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "markdown",
        to: "docx"
      }
    });

    expect(plan?.command).toBe("pandoc");
    expect(plan?.expectedOutputs).toContain("notes.docx");
  });

  it("writes Trafilatura output through stdout capture", async () => {
    const plan = await trafilaturaPlugin.plan({
      input: "https://example.com",
      from: "url",
      to: "markdown",
      output: "article.md",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "url",
        to: "markdown"
      }
    });

    expect(plan?.stdoutFile).toBe("article.md");
  });

  it("uses the PDF import filter for LibreOffice pdf to docx conversion", async () => {
    const plan = await libreOfficePlugin.plan({
      input: "report.pdf",
      from: "pdf",
      to: "docx",
      output: "report-converted.docx",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "pdf",
        to: "docx"
      }
    });

    expect(plan?.command).toBe("soffice");
    expect(plan?.args).toContain("--infilter=writer_pdf_import");
    expect(plan?.args).toContain("docx:MS Word 2007 XML");
  });
});

describe("summarize plugin", () => {
  it("declares youtube-url->transcript capability", () => {
    const caps = summarizePlugin.capabilities();
    const transcriptCap = caps.find((c) => c.from === "youtube-url" && c.to === "transcript");
    expect(transcriptCap).toBeDefined();
    expect(transcriptCap?.kind).toBe("extract");
    expect(transcriptCap?.quality).toBe("high");
  });

  it("declares url->markdown capability", () => {
    const caps = summarizePlugin.capabilities();
    const mdCap = caps.find((c) => c.from === "url" && c.to === "markdown");
    expect(mdCap).toBeDefined();
    expect(mdCap?.kind).toBe("extract");
  });

  it("builds a plan for youtube-url->transcript", async () => {
    const plan = await summarizePlugin.plan({
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      from: "youtube-url",
      to: "transcript",
      output: "/tmp/transcript.txt",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "transcript"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("summarize");
    expect(plan?.args).toContain("--extract");
    expect(plan?.args).toContain("--plain");
    expect(plan?.stdoutFile).toBe("/tmp/transcript.txt");
    expect(plan?.expectedOutputs).toContain("/tmp/transcript.txt");
  });

  it("builds a plan for youtube-url->transcript with markdown format", async () => {
    const plan = await summarizePlugin.plan({
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      from: "youtube-url",
      to: "transcript",
      output: "/tmp/transcript.md",
      options: { format: "markdown" },
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "transcript"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("summarize");
    expect(plan?.args).toContain("--extract");
    expect(plan?.args).toContain("--format");
    expect(plan?.args).toContain("md");
    expect(plan?.args).toContain("--plain");
    expect(plan?.stdoutFile).toBe("/tmp/transcript.md");
  });

  it("builds a plan for url->markdown", async () => {
    const plan = await summarizePlugin.plan({
      input: "https://example.com/article",
      from: "url",
      to: "markdown",
      output: "/tmp/article.md",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "url",
        to: "markdown"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("summarize");
    expect(plan?.args).toContain("--extract");
    expect(plan?.args).toContain("--format");
    expect(plan?.args).toContain("md");
  });

  it("returns null for unsupported routes", async () => {
    const plan = await summarizePlugin.plan({
      input: "https://www.youtube.com/watch?v=abc",
      from: "youtube-url",
      to: "mp4",
      output: "/tmp/out.mp4",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "mp4"
      }
    });

    expect(plan).toBeNull();
  });

  it("returns install hints for macOS", () => {
    const hints = summarizePlugin.getInstallHints("macos");
    expect(hints.length).toBeGreaterThan(0);
    expect(hints[0]?.command).toContain("npm");
  });
});

describe("yt-dlp plugin", () => {
  it("declares youtube-url->transcript capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const transcriptCap = caps.find((c) => c.from === "youtube-url" && c.to === "transcript");
    expect(transcriptCap).toBeDefined();
    expect(transcriptCap?.kind).toBe("fetch");
    expect(transcriptCap?.quality).toBe("medium");
  });

  it("declares youtube-url->mp4 capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const mp4Cap = caps.find((c) => c.from === "youtube-url" && c.to === "mp4");
    expect(mp4Cap).toBeDefined();
  });

  it("declares youtube-url->mp3 capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const mp3Cap = caps.find((c) => c.from === "youtube-url" && c.to === "mp3");
    expect(mp3Cap).toBeDefined();
  });

  it("builds a plan for youtube-url->mp4", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.youtube.com/watch?v=abc123",
      from: "youtube-url",
      to: "mp4",
      output: "/tmp/abc123.mp4",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "mp4"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("yt-dlp");
    expect(plan?.args).toContain("--remux-video");
    expect(plan?.args).toContain("mp4");
  });

  it("builds a plan for youtube-url->transcript using subtitle download", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.youtube.com/watch?v=abc123",
      from: "youtube-url",
      to: "transcript",
      output: "/tmp/abc123.txt",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "transcript"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("yt-dlp");
    expect(plan?.args).toContain("--write-auto-subs");
    expect(plan?.args).toContain("--skip-download");
    expect(plan?.outputMapping).toBeDefined();
    expect(plan?.outputMapping?.length).toBe(1);
  });

  it("returns null for unsupported routes", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.youtube.com/watch?v=abc",
      from: "youtube-url",
      to: "pdf",
      output: "/tmp/out.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "pdf"
      }
    });

    expect(plan).toBeNull();
  });

  it("has common problems including ffmpeg note", () => {
    expect(ytdlpPlugin.commonProblems).toContainEqual(
      expect.stringContaining("ffmpeg")
    );
  });

  it("explain returns meaningful text for transcript route", async () => {
    const explanation = await ytdlpPlugin.explain({
      input: "https://youtube.com/watch?v=abc",
      from: "youtube-url",
      to: "transcript",
      output: "/tmp/out.txt",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "transcript"
      }
    });

    expect(explanation).toContain("transcript");
    expect(explanation).toContain("summarize");
  });

  it("declares media-url->mp4 capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const mp4Cap = caps.find((c) => c.from === "media-url" && c.to === "mp4");
    expect(mp4Cap).toBeDefined();
    expect(mp4Cap?.kind).toBe("fetch");
  });

  it("declares media-url->mp3 capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const mp3Cap = caps.find((c) => c.from === "media-url" && c.to === "mp3");
    expect(mp3Cap).toBeDefined();
  });

  it("declares media-url->transcript capability", () => {
    const caps = ytdlpPlugin.capabilities();
    const transcriptCap = caps.find((c) => c.from === "media-url" && c.to === "transcript");
    expect(transcriptCap).toBeDefined();
  });

  it("builds a plan for media-url->mp4 (Instagram)", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.instagram.com/reel/abc123/",
      from: "media-url",
      to: "mp4",
      output: "/tmp/abc123.mp4",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "media-url",
        to: "mp4"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("yt-dlp");
    expect(plan?.args).toContain("--remux-video");
    expect(plan?.args).toContain("mp4");
  });

  it("builds a plan for media-url->mp3 (TikTok)", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.tiktok.com/@user/video/123456",
      from: "media-url",
      to: "mp3",
      output: "/tmp/123456.mp3",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "media-url",
        to: "mp3"
      }
    });

    expect(plan).not.toBeNull();
    expect(plan?.command).toBe("yt-dlp");
    expect(plan?.args).toContain("--audio-format");
    expect(plan?.args).toContain("mp3");
  });

  it("explain returns multi-platform text for media-url", async () => {
    const explanation = await ytdlpPlugin.explain({
      input: "https://x.com/user/status/123",
      from: "media-url",
      to: "mp4",
      output: "/tmp/out.mp4",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "media-url",
        to: "mp4"
      }
    });

    expect(explanation).toContain("Instagram");
    expect(explanation).toContain("TikTok");
    expect(explanation).toContain("1800+");
  });

  it("returns null for unsupported media-url routes", async () => {
    const plan = await ytdlpPlugin.plan({
      input: "https://www.tiktok.com/@user/video/123",
      from: "media-url",
      to: "pdf",
      output: "/tmp/out.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "media-url",
        to: "pdf"
      }
    });

    expect(plan).toBeNull();
  });
});
