import { describe, expect, it } from "vitest";

import { normalizeRequest } from "../packages/engine/src/planner/normalize-request.js";

describe("normalizeRequest", () => {
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
});
