import { describe, expect, it } from "vitest";

describe("package entry point", () => {
  it("loads without side effects", async () => {
    await expect(import("./index.js")).resolves.toBeDefined();
  });
});
