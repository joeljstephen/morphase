import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { normalizeRequest } from "../packages/engine/src/planner/normalize-request.js";

describe("normalizeRequest", () => {
  const originalCwd = process.env.MORPHASE_CWD;
  const fixtureDir = fs.mkdtempSync(path.join(os.tmpdir(), "morphase-normalize-"));

  beforeAll(() => {
    process.env.MORPHASE_CWD = fixtureDir;
    fs.writeFileSync(path.join(fixtureDir, "slides.pptx"), "");
    fs.writeFileSync(path.join(fixtureDir, "notes.md"), "");
  });

  afterAll(() => {
    if (originalCwd === undefined) {
      delete process.env.MORPHASE_CWD;
    } else {
      process.env.MORPHASE_CWD = originalCwd;
    }
    fs.rmSync(fixtureDir, { recursive: true, force: true });
  });

  it("infers conversion routes from file extensions", () => {
    const normalized = normalizeRequest(
      {
        input: "slides.pptx",
        to: "pdf",
        output: "slides.pdf"
      },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "pptx",
      to: "pdf"
    });
  });

  it("infers youtube-url from a YouTube watch URL", () => {
    const normalized = normalizeRequest(
      {
        input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        to: "transcript"
      },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "youtube-url",
      to: "transcript"
    });
  });

  it("infers youtube-url from a youtu.be short URL", () => {
    const normalized = normalizeRequest(
      {
        input: "https://youtu.be/dQw4w9WgXcQ",
        to: "mp4"
      },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "youtube-url",
      to: "mp4"
    });
  });

  it("infers url for non-YouTube HTTP URLs", () => {
    const normalized = normalizeRequest(
      {
        input: "https://example.com/article",
        to: "markdown"
      },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "url",
      to: "markdown"
    });
  });

  it("derives output path for youtube-url input", () => {
    const normalized = normalizeRequest(
      {
        input: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        to: "transcript"
      },
      { offlineOnly: false }
    );

    expect(normalized.planRequest.output).toContain("dQw4w9WgXcQ");
    expect(normalized.planRequest.output.endsWith(".txt")).toBe(true);
  });

  it("respects explicit from override for youtube-url", () => {
    const normalized = normalizeRequest(
      {
        input: "https://www.youtube.com/watch?v=abc",
        from: "youtube-url",
        to: "mp3"
      },
      { offlineOnly: false }
    );

    expect(normalized.route).toEqual({
      kind: "conversion",
      from: "youtube-url",
      to: "mp3"
    });
  });

  it("treats an output without an extension as a file stem", () => {
    const normalized = normalizeRequest(
      {
        input: "notes.md",
        to: "docx",
        output: "release-notes"
      },
      { offlineOnly: false }
    );

    expect(normalized.planRequest.output).toBe(path.join(fixtureDir, "release-notes.docx"));
  });

  it("rejects missing local files early", () => {
    expect(() =>
      normalizeRequest(
        {
          input: "missing.pdf",
          to: "txt"
        },
        { offlineOnly: false }
      )
    ).toThrow(/Input file was not found/);
  });

  it("refuses to overwrite an existing output unless forced", () => {
    fs.writeFileSync(path.join(fixtureDir, "existing.docx"), "");

    expect(() =>
      normalizeRequest(
        {
          input: "notes.md",
          to: "docx",
          output: "existing.docx"
        },
        { offlineOnly: false }
      )
    ).toThrow(/Refusing to overwrite existing output/);
  });

  it("requires at least two inputs for PDF merge", () => {
    fs.writeFileSync(path.join(fixtureDir, "single.pdf"), "");

    expect(() =>
      normalizeRequest(
        {
          input: ["single.pdf"],
          from: "pdf",
          operation: "merge",
          output: "merged.pdf"
        },
        { offlineOnly: false }
      )
    ).toThrow(/requires at least two input files/);
  });

  it("rejects malformed PDF split ranges before invoking qpdf", () => {
    fs.writeFileSync(path.join(fixtureDir, "document.pdf"), "");

    expect(() =>
      normalizeRequest(
        {
          input: "document.pdf",
          from: "pdf",
          operation: "split",
          output: "split.pdf",
          options: { pages: "nope" }
        },
        { offlineOnly: false }
      )
    ).toThrow(/Invalid page range/);
  });
});
