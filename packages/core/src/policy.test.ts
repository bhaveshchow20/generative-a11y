import { describe, expect, it } from "vitest";

import { presets, resolvePolicy } from "./policy.js";

describe("announcement policy", () => {
  it("returns deeply frozen policy snapshots", () => {
    const policy = resolvePolicy("balanced");
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.text)).toBe(true);
    expect(Object.isFrozen(policy.tools)).toBe(true);
    expect(Object.isFrozen(presets)).toBe(true);
    expect(() => {
      (policy.text as { maximumDelayMs: number }).maximumDelayMs = 1;
    }).toThrow();
  });

  it.each([
    { minimumGapMs: Number.NaN },
    { maxQueueSize: 0 },
    { maxActiveEntities: 0 },
    { text: { maximumDelayMs: -1 } },
    { tools: { progressEveryPercent: 0 } },
  ])("rejects malformed overrides: $minimumGapMs$maxQueueSize", (override) => {
    expect(() => resolvePolicy("balanced", override)).toThrow(RangeError);
  });
});
