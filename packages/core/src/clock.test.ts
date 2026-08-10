import { describe, expect, it } from "vitest";

import { ManualClock } from "./clock.js";

describe("ManualClock", () => {
  it("orders equal-time tasks by insertion and supports cancellation", () => {
    const clock = new ManualClock(100);
    const calls: string[] = [];
    const cancelled = clock.setTimeout(() => calls.push("cancelled"), 5);
    clock.setTimeout(() => calls.push("first"), 10);
    clock.setTimeout(() => calls.push("second"), 10);
    clock.clearTimeout(cancelled);

    clock.advanceBy(10);

    expect(calls).toEqual(["first", "second"]);
    expect(clock.now()).toBe(110);
    expect(clock.pendingCount()).toBe(0);
  });

  it("guards against runaway recursively scheduled work", () => {
    const clock = new ManualClock();
    const repeat = () => clock.setTimeout(repeat, 0);
    repeat();

    expect(() => clock.runUntilIdle(5)).toThrow("task limit");
    expect(clock.pendingCount()).toBe(1);
  });

  it("does not permit time travel", () => {
    const clock = new ManualClock(10);
    expect(() => clock.advanceTo(9)).toThrow("backwards");
  });
});
