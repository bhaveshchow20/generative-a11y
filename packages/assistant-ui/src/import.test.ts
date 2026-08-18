import { describe, expect, it } from "vitest";

describe("assistant-ui package imports", () => {
  it("is SSR-safe", async () => {
    const esm = await import("@generative-a11y/assistant-ui");
    expect(typeof esm.bindThreadRuntime).toBe("function");
  });
});
