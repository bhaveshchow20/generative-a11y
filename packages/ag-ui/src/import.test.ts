import { describe, expect, it } from "vitest";

describe("AG-UI package imports", () => {
  it("is SSR-safe", async () => {
    const module = await import("./index.js");
    expect(typeof module.bindAgent).toBe("function");
  });
});
