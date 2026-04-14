import { describe, expect, it } from "vitest";

import { Planner } from "../packages/engine/src/planner/planner.js";
import { PluginRegistry } from "../packages/engine/src/registry/plugin-registry.js";
import type { MorphaseConfig, MorphasePlugin, PlanRequest } from "../packages/shared/src/index.js";

const baseConfig: MorphaseConfig = {
  offlineOnly: false,
  preferredBackends: {},
  debug: false,
  allowPackageManagerDelegation: false
};

function createPlugin(plugin: Partial<MorphasePlugin> & Pick<MorphasePlugin, "id" | "name" | "priority">): MorphasePlugin {
  return {
    id: plugin.id,
    name: plugin.name,
    priority: plugin.priority,
    minimumVersion: plugin.minimumVersion,
    capabilities: plugin.capabilities ?? (() => []),
    detect: plugin.detect ?? (async () => ({ installed: true, command: plugin.id })),
    verify: plugin.verify ?? (async () => ({ ok: true, issues: [], warnings: [] })),
    getInstallHints: plugin.getInstallHints ?? (() => []),
    plan:
      plugin.plan ??
      (async () => ({
        command: plugin.id,
        args: [],
        expectedOutputs: ["/tmp/out.pdf"]
      })),
    explain: plugin.explain ?? (async () => `${plugin.name}`)
  };
}

describe("Planner", () => {
  it("prefers the route recommendation when multiple plugins match", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "fallback",
        name: "Fallback",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "docx",
            to: "pdf",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ]
      }),
      createPlugin({
        id: "libreoffice",
        name: "LibreOffice",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "docx",
            to: "pdf",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ]
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "demo.docx",
      from: "docx",
      to: "pdf",
      output: "demo.pdf",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "docx",
        to: "pdf"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("libreoffice");
  });

  it("can use a curated pipeline when no direct candidate exists", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "pandoc",
        name: "Pandoc",
        priority: 10,
        capabilities: () => [
          {
            kind: "convert",
            from: "markdown",
            to: "txt",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "pandoc",
          args: [String(request.input), "-o", request.output ?? "out.txt"],
          expectedOutputs: [request.output ?? "out.txt"]
        })
      }),
      createPlugin({
        id: "markitdown",
        name: "MarkItDown",
        priority: 10,
        capabilities: () => [
          {
            kind: "extract",
            from: "pdf",
            to: "markdown",
            quality: "medium",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "markitdown",
          args: [String(request.input), "-o", request.output ?? "out.md"],
          expectedOutputs: [request.output ?? "out.md"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "demo.pdf",
      from: "pdf",
      to: "txt",
      output: "demo.txt",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "pdf",
        to: "txt"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("pipeline:pdf-to-txt-via-markdown");
    expect(plan.steps).toHaveLength(2);
  });

  it("prefers summarize over ytdlp for youtube-url->transcript", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "summarize",
        name: "summarize",
        priority: 70,
        capabilities: () => [
          {
            kind: "extract",
            from: "youtube-url",
            to: "transcript",
            quality: "high",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "summarize",
          args: ["--format", "text", "--transcript", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/transcript.txt"],
          stdoutFile: request.output ?? "/tmp/transcript.txt"
        })
      }),
      createPlugin({
        id: "ytdlp",
        name: "yt-dlp",
        priority: 60,
        capabilities: () => [
          {
            kind: "fetch",
            from: "youtube-url",
            to: "transcript",
            quality: "medium",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "yt-dlp",
          args: ["--write-auto-subs", "--skip-download", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/transcript.txt"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
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
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("summarize");
    expect(plan.explanation).toContain("preferred");
  });

  it("falls back to ytdlp when summarize is not installed for transcript route", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "summarize",
        name: "summarize",
        priority: 70,
        capabilities: () => [
          {
            kind: "extract",
            from: "youtube-url",
            to: "transcript",
            quality: "high",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: false, reason: "summarize not found" }),
        plan: async () => null
      }),
      createPlugin({
        id: "ytdlp",
        name: "yt-dlp",
        priority: 60,
        capabilities: () => [
          {
            kind: "fetch",
            from: "youtube-url",
            to: "transcript",
            quality: "medium",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "yt-dlp",
          args: ["--write-auto-subs", "--skip-download", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/transcript.txt"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
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
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("ytdlp");
  });

  it("selects ytdlp for youtube-url->mp4", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "ytdlp",
        name: "yt-dlp",
        priority: 60,
        capabilities: () => [
          {
            kind: "fetch",
            from: "youtube-url",
            to: "mp4",
            quality: "medium",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "yt-dlp",
          args: ["--remux-video", "mp4", "-o", request.output ?? "/tmp/out.mp4", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/out.mp4"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
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
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("ytdlp");
  });

  it("reports installNeeded when no backend is installed for youtube transcript", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "summarize",
        name: "summarize",
        priority: 70,
        capabilities: () => [
          {
            kind: "extract",
            from: "youtube-url",
            to: "transcript",
            quality: "high",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: false, reason: "summarize not found" }),
        verify: async () => ({ ok: false, issues: ["not installed"], warnings: [] }),
        getInstallHints: () => [{ manager: "brew", command: "npm i -g @steipete/summarize" }],
        plan: async () => null
      }),
      createPlugin({
        id: "ytdlp",
        name: "yt-dlp",
        priority: 60,
        capabilities: () => [
          {
            kind: "fetch",
            from: "youtube-url",
            to: "transcript",
            quality: "medium",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: false, reason: "yt-dlp not found" }),
        verify: async () => ({ ok: false, issues: ["not installed"], warnings: [] }),
        getInstallHints: () => [{ manager: "brew", command: "brew install yt-dlp" }],
        plan: async () => null
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
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
    };

    const plan = await planner.plan(request);
    expect(plan.installNeeded).toBe(true);
    expect(plan.selectedPluginId).toBe("summarize");
  });

  it("generates equivalent command using morphase fetch for youtube-url routes", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "ytdlp",
        name: "yt-dlp",
        priority: 60,
        capabilities: () => [
          {
            kind: "fetch",
            from: "youtube-url",
            to: "mp4",
            quality: "medium",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "yt-dlp",
          args: ["--remux-video", "mp4", "-o", request.output ?? "/tmp/out.mp4", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/out.mp4"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "https://www.youtube.com/watch?v=abc123",
      from: "youtube-url",
      to: "mp4",
      output: "abc123.mp4",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "youtube-url",
        to: "mp4"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.equivalentCommand).toContain("morphase fetch");
    expect(plan.equivalentCommand).toContain("--to mp4");
  });

  it("generates equivalent command using morphase fetch for url routes", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "trafilatura",
        name: "Trafilatura",
        priority: 90,
        capabilities: () => [
          {
            kind: "extract",
            from: "url",
            to: "markdown",
            quality: "high",
            offline: false,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "trafilatura",
          args: ["--output-format", "markdown", String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/out.md"],
          stdoutFile: request.output ?? "/tmp/out.md"
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "https://example.com/article",
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
    };

    const plan = await planner.plan(request);
    expect(plan.equivalentCommand).toContain("morphase fetch");
    expect(plan.equivalentCommand).toContain("--to markdown");
  });

  it("downgrades a backend whose version is below minimumVersion", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "ffmpeg-old",
        name: "FFmpeg Old",
        priority: 100,
        minimumVersion: "6.0.0",
        capabilities: () => [
          {
            kind: "convert",
            from: "wav",
            to: "mp3",
            quality: "medium",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: true, version: "4.2.1", command: "ffmpeg" }),
        verify: async () => ({ ok: true, issues: [], warnings: [] }),
        plan: async (request) => ({
          command: "ffmpeg",
          args: ["-i", String(request.input), request.output ?? "/tmp/out.mp3"],
          expectedOutputs: [request.output ?? "/tmp/out.mp3"]
        })
      }),
      createPlugin({
        id: "ffmpeg-new",
        name: "FFmpeg New",
        priority: 90,
        minimumVersion: "6.0.0",
        capabilities: () => [
          {
            kind: "convert",
            from: "wav",
            to: "mp3",
            quality: "medium",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: true, version: "7.0.0", command: "ffmpeg" }),
        verify: async () => ({ ok: true, issues: [], warnings: [] }),
        plan: async (request) => ({
          command: "ffmpeg",
          args: ["-i", String(request.input), request.output ?? "/tmp/out.mp3"],
          expectedOutputs: [request.output ?? "/tmp/out.mp3"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "audio.wav",
      from: "wav",
      to: "mp3",
      output: "audio.mp3",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "wav",
        to: "mp3"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("ffmpeg-new");
  });

  it("falls back to a below-minimum backend when no alternative exists", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "ffmpeg",
        name: "FFmpeg",
        priority: 100,
        minimumVersion: "6.0.0",
        capabilities: () => [
          {
            kind: "convert",
            from: "wav",
            to: "mp3",
            quality: "medium",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        detect: async () => ({ installed: true, version: "4.2.1", command: "ffmpeg" }),
        verify: async () => ({ ok: true, issues: [], warnings: [] }),
        plan: async (request) => ({
          command: "ffmpeg",
          args: ["-i", String(request.input), request.output ?? "/tmp/out.mp3"],
          expectedOutputs: [request.output ?? "/tmp/out.mp3"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const request: PlanRequest = {
      input: "audio.wav",
      from: "wav",
      to: "mp3",
      output: "audio.mp3",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "conversion",
        from: "wav",
        to: "mp3"
      }
    };

    const plan = await planner.plan(request);
    expect(plan.selectedPluginId).toBe("ffmpeg");
    expect(plan.explanation).toContain("below minimum");
  });

  it("uses the image command shape for image compression equivalents", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "jpegoptim",
        name: "jpegoptim",
        priority: 100,
        capabilities: () => [
          {
            kind: "transform",
            from: "jpg",
            to: null,
            operation: "compress",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "jpegoptim",
          args: [String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/out.jpg"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "photo.jpg",
      from: "jpg",
      operation: "compress",
      output: "photo-compressed.jpg",
      options: {},
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "operation",
        resource: "jpg",
        action: "compress"
      }
    });

    expect(plan.equivalentCommand).toBe("morphase image compress photo.jpg -o photo-compressed.jpg");
  });

  it("uses the pdf command shape for pdf operations", async () => {
    const registry = new PluginRegistry([
      createPlugin({
        id: "qpdf",
        name: "qpdf",
        priority: 100,
        capabilities: () => [
          {
            kind: "transform",
            from: "pdf",
            to: null,
            operation: "split",
            quality: "high",
            offline: true,
            platforms: ["macos", "windows", "linux"]
          }
        ],
        plan: async (request) => ({
          command: "qpdf",
          args: [String(request.input)],
          expectedOutputs: [request.output ?? "/tmp/out.pdf"]
        })
      })
    ]);

    const planner = new Planner(registry, baseConfig);
    const plan = await planner.plan({
      input: "report.pdf",
      from: "pdf",
      operation: "split",
      output: "excerpt.pdf",
      options: { pages: "1-3" },
      platform: "macos",
      offlineOnly: false,
      route: {
        kind: "operation",
        resource: "pdf",
        action: "split"
      }
    });

    expect(plan.equivalentCommand).toBe("morphase pdf split report.pdf --pages 1-3 -o excerpt.pdf");
  });
});
