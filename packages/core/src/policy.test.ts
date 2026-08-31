import { describe, expect, it } from "vitest";

import { presets, resolvePolicy } from "./policy.js";

describe("announcement policy", () => {
  it("returns deeply frozen policy snapshots", () => {
    const policy = resolvePolicy("balanced");
    expect(Object.isFrozen(policy)).toBe(true);
    expect(Object.isFrozen(policy.text)).toBe(true);
    expect(Object.isFrozen(policy.tools)).toBe(true);
    expect(Object.isFrozen(policy.workflows)).toBe(true);
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
    { workflows: { announceStepAfterMs: -1 } },
  ])("rejects malformed overrides: $minimumGapMs$maxQueueSize", (override) => {
    expect(() => resolvePolicy("balanced", override)).toThrow(RangeError);
  });

  it("uses quiet workflow defaults and an explicit verbose mode", () => {
    expect(resolvePolicy("balanced").workflows).toEqual({
      runs: "terminal",
      steps: "long-running",
      announceStepAfterMs: 2_000,
      announceProgress: false,
      announceNestedSteps: false,
    });
    expect(resolvePolicy("minimal").workflows.steps).toBe("silent");
    expect(resolvePolicy("completion-only").workflows.steps).toBe("silent");
    expect(resolvePolicy("verbose").workflows).toMatchObject({
      runs: "all",
      steps: "all",
      announceStepAfterMs: 0,
      announceProgress: true,
      announceNestedSteps: true,
    });
  });

  it("rejects unsupported workflow modes at the runtime boundary", () => {
    expect(() =>
      resolvePolicy("balanced", {
        workflows: { runs: "noisy" as never },
      }),
    ).toThrow(TypeError);
    expect(() =>
      resolvePolicy("balanced", {
        workflows: { steps: "everything" as never },
      }),
    ).toThrow(TypeError);
  });

  it.each(["announceProgress", "announceNestedSteps"] as const)(
    "rejects a non-boolean workflows.%s override",
    (field) => {
      expect(() =>
        resolvePolicy("balanced", {
          workflows: { [field]: "false" } as never,
        }),
      ).toThrow(TypeError);
    },
  );
});
