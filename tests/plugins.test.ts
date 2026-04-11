import { describe, expect, it } from "vitest";

import { pandocPlugin, trafilaturaPlugin } from "../packages/plugins/src/index.js";

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
});
