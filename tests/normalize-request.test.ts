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
});

