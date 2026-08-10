import { afterEach, describe, expect, it, vi } from "vitest";

import { normalizeAnnouncementText, segmentText } from "./segmenter.js";

describe("segmentText", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("keeps sentence fragments for the next delta", () => {
    expect(segmentText("The first sentence. The sec", "sentence")).toEqual({
      complete: ["The first sentence."],
      remainder: "The sec",
    });
  });

  it.each([
    "The value is 3.14. Next",
    "The price is $2.50. Next",
    "See https://example.com/docs. Next",
    "Email docs@example.com. Next",
    "Use v1.2.3 today. Next",
    "Dr. Smith arrived. Next",
  ])("does not split protected punctuation in %s", (text) => {
    const result = segmentText(text, "sentence");
    expect(result.complete).toHaveLength(1);
    expect(result.remainder).toBe("Next");
  });

  it("handles non-Latin terminators and closing punctuation", () => {
    expect(segmentText("終わりました。 次", "sentence")).toEqual({
      complete: ["終わりました。"],
      remainder: "次",
    });
    expect(segmentText("Finished!” Then", "sentence")).toEqual({
      complete: ["Finished!”"],
      remainder: "Then",
    });
  });

  it("extracts only complete paragraphs", () => {
    expect(segmentText("First paragraph.\n\nSecond", "paragraph")).toEqual({
      complete: ["First paragraph."],
      remainder: "Second",
    });
  });

  it("normalizes whitespace only at the announcement boundary", () => {
    expect(normalizeAnnouncementText("  one\n\t two  ")).toBe("one two");
  });

  it("keeps initials together in the fallback segmenter", () => {
    vi.stubGlobal("Intl", { Segmenter: undefined });

    expect(segmentText("U.S. policy changed. Next", "sentence")).toEqual({
      complete: ["U.S. policy changed."],
      remainder: "Next",
    });
    expect(segmentText("J. R. R. Tolkien wrote it. Next", "sentence")).toEqual({
      complete: ["J. R. R. Tolkien wrote it."],
      remainder: "Next",
    });
  });
});
