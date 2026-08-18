import { describe, expect, it } from "vitest";

import { resolvePlaywrightPort } from "../playwright.config";

describe("Playwright server port", () => {
  it.each([undefined, "", "abc", "0", "-1", "1.5", "65536"])(
    "falls back for invalid value %s",
    (value) => {
      expect(resolvePlaywrightPort(value)).toBe(3001);
    },
  );

  it.each([
    ["1", 1],
    ["3002", 3002],
    ["65535", 65535],
  ])("accepts valid value %s", (value, expected) => {
    expect(resolvePlaywrightPort(value)).toBe(expected);
  });
});
