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
      capacityPriority: "status",
      delayMs: 10,
    });
    scheduler.schedule({
      channel: "polite",
      text: "The final answer",
      sourceType: "response.completed",
      capacityPriority: "content",
      delayMs: 10,
    });
    scheduler.schedule({
      channel: "polite",
      text: "Another status update",
      sourceType: "tool.progress",
      capacityPriority: "status",
      delayMs: 10,
    });
    clock.runUntilIdle();

    expect(announcements.map(({ text }) => text)).toEqual(["The final answer"]);
  });

  it("replaces a capacity victim atomically before diagnostics reenter", () => {
    const clock = new ManualClock();
    const diagnostics: Array<{ id?: string; reason: string; text?: string }> =
      [];
    const announcements: string[] = [];
    let nested = false;
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: ({ text }) => announcements.push(text),
      onDiagnostic: (diagnostic) => {
        diagnostics.push({
          reason: diagnostic.reason,
          ...(diagnostic.announcement
            ? {
                id: diagnostic.announcement.id,
                text: diagnostic.announcement.text,
              }
            : {}),
        });
        if (
          !nested &&
          diagnostic.reason === "queue-capacity" &&
          diagnostic.announcement?.text === "Old status"
        ) {
          nested = true;
          scheduler.schedule({
            channel: "polite",
            text: "Nested status",
            sourceType: "tool.progress",
            capacityPriority: "status",
            delayMs: 10,
          });
        }
      },
    });
    scheduler.schedule({
      channel: "polite",
      text: "Old status",
      sourceType: "tool.progress",
      capacityPriority: "status",
      delayMs: 10,
    });

    const incomingId = scheduler.schedule({
      channel: "polite",
      text: "Answer content",
      sourceType: "response.completed",
      capacityPriority: "content",
      delayMs: 10,
    });

    expect(scheduler.pendingCount()).toBe(1);
    clock.runUntilIdle();
    expect(announcements).toEqual(["Answer content"]);
    expect(incomingId).toBe("announcement-2");
    expect(
      diagnostics
        .filter(
          ({ text }) => text === "Old status" || text === "Answer content",
        )
        .map(({ id, reason, text }) => ({ id, reason, text })),
    ).toEqual([
      { id: "announcement-1", reason: "scheduled", text: "Old status" },
      {
        id: "announcement-1",
        reason: "queue-capacity",
        text: "Old status",
      },
      {
        id: "announcement-2",
        reason: "scheduled",
        text: "Answer content",
      },
      { id: "announcement-2", reason: "delivered", text: "Answer content" },
    ]);
  });

  it("reports accepted scheduling before a stronger nested eviction", () => {
    const clock = new ManualClock();
    const diagnostics: Array<{ reason: string; text?: string }> = [];
    const announcements: string[] = [];
    let nestedId: string | undefined;
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: ({ text }) => announcements.push(text),
      onDiagnostic: (diagnostic) => {
        diagnostics.push({
          reason: diagnostic.reason,
          ...(diagnostic.announcement
            ? { text: diagnostic.announcement.text }
            : {}),
        });
        if (
          nestedId === undefined &&
          diagnostic.reason === "queue-capacity" &&
          diagnostic.announcement?.text === "Old status"
        ) {
          nestedId = scheduler.schedule({
            channel: "assertive",
            text: "Urgent action",
            sourceType: "interaction.requested",
            capacityPriority: "content",
            delayMs: 10,
          });
        }
      },
    });
    scheduler.schedule({
      channel: "polite",
      text: "Old status",
      sourceType: "tool.progress",
      capacityPriority: "status",
      delayMs: 10,
    });

    const incomingId = scheduler.schedule({
      channel: "polite",
      text: "Answer content",
      sourceType: "response.completed",
      capacityPriority: "content",
      delayMs: 10,
    });

    expect(incomingId).toBe("announcement-2");
    expect(nestedId).toBe("announcement-3");
    expect(scheduler.pendingCount()).toBe(1);
    expect(diagnostics.map(({ reason, text }) => ({ reason, text }))).toEqual([
      { reason: "scheduled", text: "Old status" },
      { reason: "queue-capacity", text: "Old status" },
      { reason: "scheduled", text: "Answer content" },
      { reason: "queue-capacity", text: "Answer content" },
      { reason: "scheduled", text: "Urgent action" },
    ]);
    clock.runUntilIdle();
    expect(announcements).toEqual(["Urgent action"]);
  });

  it("returns an accepted coalesced ID before reentrant eviction", () => {
    const clock = new ManualClock();
    let nestedId: string | undefined;
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        if (nestedId === undefined && diagnostic.reason === "coalesced") {
          nestedId = scheduler.schedule({
            channel: "assertive",
            text: "Urgent action",
            sourceType: "interaction.requested",
            capacityPriority: "content",
            delayMs: 10,
          });
        }
      },
    });
    scheduler.schedule({
      channel: "polite",
      text: "Old progress",
      sourceType: "tool.progress",
      capacityPriority: "status",
      coalesceKey: "progress",
      delayMs: 10,
    });

    const replacementId = scheduler.schedule({
      channel: "polite",
      text: "New progress",
      sourceType: "tool.progress",
      capacityPriority: "status",
      coalesceKey: "progress",
      delayMs: 10,
    });

    expect(replacementId).toBe("announcement-1");
    expect(nestedId).toBe("announcement-2");
    expect(scheduler.pendingCount()).toBe(1);
  });

  it("queues the complete outer sequence before same-key nested coalescing", () => {
    const clock = new ManualClock();
    const diagnostics: Array<{ reason: string; text?: string }> = [];
    let nestedId: string | undefined;
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push({
          reason: diagnostic.reason,
          ...(diagnostic.announcement
            ? { text: diagnostic.announcement.text }
            : {}),
        });
        if (
          nestedId === undefined &&
          diagnostic.reason === "queue-capacity" &&
          diagnostic.announcement?.text === "Old status"
        ) {
          nestedId = scheduler.schedule({
            channel: "polite",
            text: "Refined answer",
            sourceType: "response.completed",
            capacityPriority: "content",
            coalesceKey: "answer",
            delayMs: 10,
          });
        }
      },
    });
    scheduler.schedule({
      channel: "polite",
      text: "Old status",
      sourceType: "tool.progress",
      capacityPriority: "status",
      delayMs: 10,
    });

    const incomingId = scheduler.schedule({
      channel: "polite",
      text: "Answer content",
      sourceType: "response.completed",
      capacityPriority: "content",
      coalesceKey: "answer",
      delayMs: 10,
    });

    expect(incomingId).toBe("announcement-2");
    expect(nestedId).toBe("announcement-2");
    expect(
      diagnostics
        .filter(({ text }) =>
          ["Old status", "Answer content", "Refined answer"].includes(
            text ?? "",
          ),
        )
        .map(({ reason, text }) => ({ reason, text })),
    ).toEqual([
      { reason: "scheduled", text: "Old status" },
      { reason: "queue-capacity", text: "Old status" },
      { reason: "scheduled", text: "Answer content" },
      { reason: "coalesced", text: "Refined answer" },
    ]);
  });

  it("allows a scheduled observer to re-coalesce after acceptance", () => {
    const clock = new ManualClock();
    const diagnostics: Array<{ reason: string; text?: string }> = [];
    let nestedId: string | undefined;
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push({
          reason: diagnostic.reason,
          ...(diagnostic.announcement
            ? { text: diagnostic.announcement.text }
            : {}),
        });
        if (nestedId === undefined && diagnostic.reason === "scheduled") {
          nestedId = scheduler.schedule({
            channel: "polite",
            text: "New progress",
            sourceType: "tool.progress",
            coalesceKey: "progress",
            delayMs: 10,
          });
        }
      },
    });

    const outerId = scheduler.schedule({
      channel: "polite",
      text: "Old progress",
      sourceType: "tool.progress",
      coalesceKey: "progress",
      delayMs: 10,
    });

    expect(outerId).toBe("announcement-1");
    expect(nestedId).toBe("announcement-1");
    expect(diagnostics.map(({ reason, text }) => ({ reason, text }))).toEqual([
      { reason: "scheduled", text: "Old progress" },
      { reason: "coalesced", text: "New progress" },
    ]);
  });

  it("returns an accepted ID when a scheduled observer delivers it", () => {
    const clock = new ManualClock();
    const reasons: string[] = [];
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        reasons.push(diagnostic.reason);
        if (diagnostic.reason === "scheduled") clock.runUntilIdle();
      },
    });

    const id = scheduler.schedule({
      channel: "polite",
      text: "Deliver now",
      sourceType: "response.completed",
    });

    expect(id).toBe("announcement-1");
    expect(reasons).toEqual(["scheduled", "delivered"]);
    expect(scheduler.pendingCount()).toBe(0);
  });

  it("bounds diagnostic observer self-chains", () => {
    const clock = new ManualClock();
    const diagnostics: AnnouncementDiagnostic[] = [];
    let scheduler: ReturnType<typeof createAnnouncementScheduler>;
    scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      maxQueueSize: 1,
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic);
        if (diagnostics.length < 50) {
          scheduler.schedule({
            channel: "polite",
            text: `Nested ${diagnostics.length}`,
            sourceType: "tool.progress",
            delayMs: 10,
          });
        }
      },
    });

    scheduler.schedule({
      channel: "polite",
      text: "Initial",
      sourceType: "tool.progress",
      delayMs: 10,
    });

    expect(diagnostics.length).toBeLessThan(50);
    expect(
      diagnostics.some(
        ({ reason, count }) => reason === "queue-capacity" && (count ?? 0) > 1,
      ),
    ).toBe(true);
    expect(scheduler.pendingCount()).toBe(1);
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
