import { describe, expect, it } from "vitest";

import { ManualClock } from "./clock.js";
import { createAnnouncementScheduler } from "./scheduler.js";
import type { AnnouncementDiagnostic, AnnouncementIntent } from "./types.js";

function setup(maxQueueSize = 10) {
  const clock = new ManualClock();
  const announcements: AnnouncementIntent[] = [];
  const diagnostics: AnnouncementDiagnostic[] = [];
  const scheduler = createAnnouncementScheduler({
    clock,
    minimumGapMs: 100,
    dedupeWindowMs: 1_000,
    maxQueueSize,
    onAnnouncement: (item) => announcements.push(item),
    onDiagnostic: (item) => diagnostics.push(item),
  });
  return { clock, announcements, diagnostics, scheduler };
}

describe("announcement scheduler", () => {
  it("delivers due assertive work before polite work", () => {
    const { scheduler, clock, announcements } = setup();
    scheduler.schedule({
      channel: "polite",
      text: "Normal",
      sourceType: "response.completed",
    });
    scheduler.schedule({
      channel: "assertive",
      text: "Urgent",
      sourceType: "approval.requested",
    });

    clock.runUntilIdle();

    expect(announcements.map(({ text }) => text)).toEqual(["Urgent", "Normal"]);
  });

  it("wakes for an assertive deadline during a polite minimum gap", () => {
    const { scheduler, clock, announcements } = setup();
    scheduler.schedule({
      channel: "polite",
      text: "First",
      sourceType: "response.completed",
    });
    clock.advanceBy(0);
    scheduler.schedule({
      channel: "polite",
      text: "Second",
      sourceType: "response.completed",
    });
    scheduler.schedule({
      channel: "assertive",
      text: "Urgent",
      sourceType: "approval.requested",
      delayMs: 25,
    });

    clock.advanceBy(25);

    expect(announcements.map(({ text, at }) => ({ text, at }))).toEqual([
      { text: "First", at: 0 },
      { text: "Urgent", at: 25 },
    ]);
    clock.advanceTo(125);
    expect(announcements.at(-1)?.text).toBe("Second");
  });

  it("coalesces queued candidates and suppresses delivered duplicates", () => {
    const { scheduler, clock, announcements, diagnostics } = setup();
    scheduler.schedule({
      channel: "polite",
      text: "25 percent",
      sourceType: "tool.progress",
      coalesceKey: "tool-1",
    });
    scheduler.schedule({
      channel: "polite",
      text: "50 percent",
      sourceType: "tool.progress",
      coalesceKey: "tool-1",
    });
    clock.runUntilIdle();
    scheduler.schedule({
      channel: "polite",
      text: "50 percent",
      sourceType: "tool.progress",
    });
    clock.runUntilIdle();

    expect(announcements.map(({ text }) => text)).toEqual(["50 percent"]);
    expect(diagnostics.some(({ reason }) => reason === "coalesced")).toBe(true);
    expect(diagnostics.some(({ reason }) => reason === "duplicate")).toBe(true);
  });

  it("cancels scopes and bounds the queue", () => {
    const { scheduler, diagnostics } = setup(2);
    scheduler.schedule({
      channel: "polite",
      text: "one",
      sourceType: "tool.started",
      delayMs: 1_000,
      scope: "one",
    });
    scheduler.schedule({
      channel: "polite",
      text: "two",
      sourceType: "tool.started",
      delayMs: 1_000,
      scope: "two",
    });
    scheduler.schedule({
      channel: "assertive",
      text: "three",
      sourceType: "response.failed",
      delayMs: 1_000,
      scope: "three",
    });
    scheduler.cancelScope("two");

    expect(scheduler.pendingCount()).toBe(1);
    expect(
      diagnostics.filter(({ disposition }) => disposition === "cancelled"),
    ).toHaveLength(2);
  });

  it("clears pending work on disposal", () => {
    const { scheduler, clock, announcements } = setup();
    scheduler.schedule({
      channel: "polite",
      text: "later",
      sourceType: "response.completed",
      delayMs: 100,
    });
    scheduler.dispose();
    clock.runUntilIdle();

    expect(announcements).toEqual([]);
    expect(clock.pendingCount()).toBe(0);
  });

  it("never evicts assertive work for an incoming polite item", () => {
    const { scheduler, clock, announcements, diagnostics } = setup(1);
    scheduler.schedule({
      channel: "assertive",
      text: "Urgent",
      sourceType: "approval.requested",
      delayMs: 10,
    });
    scheduler.schedule({
      channel: "polite",
      text: "Routine",
      sourceType: "tool.progress",
      delayMs: 10,
    });
    clock.runUntilIdle();

    expect(announcements.map(({ text }) => text)).toEqual(["Urgent"]);
    expect(diagnostics.at(-2)?.reason).toBe("queue-capacity");
  });

  it("retains content over lifecycle status at queue capacity", () => {
    const { scheduler, clock, announcements } = setup(1);
    scheduler.schedule({
      channel: "polite",
      text: "Response complete.",
      sourceType: "response.completed",
      priority: "status",
      delayMs: 10,
    });
    scheduler.schedule({
      channel: "polite",
      text: "The final answer",
      sourceType: "response.completed",
      priority: "content",
      delayMs: 10,
    });
    scheduler.schedule({
      channel: "polite",
      text: "Another status update",
      sourceType: "tool.progress",
      priority: "status",
      delayMs: 10,
    });
    clock.runUntilIdle();

    expect(announcements.map(({ text }) => text)).toEqual(["The final answer"]);
  });

  it("continues after a delivery callback throws", () => {
    const clock = new ManualClock();
    const announcements: string[] = [];
    const errors: unknown[] = [];
    let first = true;
    const scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 10,
      onAnnouncement: ({ text }) => {
        if (first) {
          first = false;
          throw new Error("driver failed");
        }
        announcements.push(text);
      },
      onDeliveryError: (error) => errors.push(error),
    });
    scheduler.schedule({
      channel: "polite",
      text: "first",
      sourceType: "tool.started",
    });
    scheduler.schedule({
      channel: "polite",
      text: "second",
      sourceType: "tool.completed",
    });
    clock.runUntilIdle();

    expect(announcements).toEqual(["second"]);
    expect(errors).toHaveLength(1);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("isolates throwing diagnostic observers", () => {
    const clock = new ManualClock();
    const announcements: string[] = [];
    const scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 10,
      onAnnouncement: ({ text }) => announcements.push(text),
      onDiagnostic: () => {
        throw new Error("observer failed");
      },
    });
    scheduler.schedule({
      channel: "polite",
      text: "still delivered",
      sourceType: "tool.completed",
    });
    clock.runUntilIdle();

    expect(announcements).toEqual(["still delivered"]);
  });

  it("replaces optional metadata when coalescing", () => {
    const { scheduler, clock, announcements } = setup();
    scheduler.schedule({
      channel: "polite",
      text: "old",
      sourceType: "tool.progress",
      sourceEventId: "old-event",
      locale: "fr",
      coalesceKey: "progress",
    });
    scheduler.schedule({
      channel: "polite",
      text: "new",
      sourceType: "tool.progress",
      coalesceKey: "progress",
    });
    clock.runUntilIdle();

    expect(announcements[0]).not.toHaveProperty("sourceEventId");
    expect(announcements[0]).not.toHaveProperty("locale");
  });

  it("validates scheduler bounds and candidate timing", () => {
    expect(() => setup(0)).toThrow(RangeError);
    const { scheduler } = setup();
    expect(() =>
      scheduler.schedule({
        channel: "polite",
        text: "later",
        sourceType: "tool.started",
        delayMs: Number.NaN,
      }),
    ).toThrow(RangeError);
  });
});
