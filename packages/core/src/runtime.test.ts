import { describe, expect, it, vi } from "vitest";

import { ManualClock } from "./clock.js";
import { createGenerativeA11y } from "./index.js";
import { createAnnouncementRecorder } from "./recorder.js";
import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
  GenerativeA11yEvent,
  PresetName,
} from "./types.js";

function spoken(recorder: ReturnType<typeof createAnnouncementRecorder>) {
  return recorder.transcript().map(({ channel, text }) => ({ channel, text }));
}

describe("generative accessibility runtime", () => {
  it("produces the same completed sentence across every chunk split", () => {
    const text = "Dr. Smith measured 3.14 units. A fragment";
    for (let split = 0; split <= text.length; split += 1) {
      const recorder = createAnnouncementRecorder({
        policy: { text: { minimumCharacters: 1, maximumDelayMs: 10_000 } },
      });
      recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r1",
        delta: text.slice(0, split),
      });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r1",
        delta: text.slice(split),
      });
      recorder.clock.advanceBy(0);

      expect(spoken(recorder)).toEqual([
        { channel: "polite", text: "Dr. Smith measured 3.14 units." },
      ]);
      recorder.runtime.dispose();
    }
  });

  it("flushes one unfinished fragment and completion status", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1, maximumDelayMs: 10_000 } },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "An unfinished final thought",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r1" });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "An unfinished final thought" },
      { channel: "polite", text: "Response complete." },
    ]);
    expect(recorder.clock.pendingCount()).toBe(0);
  });

  it("retains a final content flush over completion status at queue capacity", () => {
    const recorder = createAnnouncementRecorder({
      policy: {
        maxQueueSize: 1,
        text: { minimumCharacters: 1, maximumDelayMs: 10_000 },
      },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "The final answer",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r1" });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "The final answer",
    ]);
  });

  it("cancels buffered and queued text when interrupted", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1, maximumDelayMs: 500 } },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "This was queued.",
    });
    recorder.runtime.dispatch({
      type: "response.interrupted",
      responseId: "r1",
    });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "Response stopped." },
    ]);
  });

  it("rejects late events from a replaced response instance", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "attempt-1",
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "attempt-2",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      responseInstanceId: "attempt-1",
      delta: "Stale sentence.",
    });

    expect(recorder.diagnosticTranscript().at(-1)?.reason).toBe(
      "stale-response",
    );
  });

  it("suppresses a fast tool start and announces completion", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Searching",
    });
    recorder.clock.advanceBy(500);
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "t1",
      label: "Search",
      summary: "Three sources found.",
    });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "Three sources found." },
    ]);
  });

  it("announces a slow tool start once without doubled punctuation", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Searching.",
    });
    recorder.clock.advanceBy(1_500);

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "Searching.",
    ]);
  });

  it("coalesces verbose progress into configured buckets", () => {
    const recorder = createAnnouncementRecorder({
      preset: "verbose",
      policy: { tools: { announceStart: false } },
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Upload",
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      label: "Upload",
      progress: 0.1,
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      label: "Upload",
      progress: 0.2,
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      label: "Upload",
      progress: 0.3,
    });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "Upload 30 percent." },
    ]);
  });

  it("uses maximum delay from the first pending delta instead of debouncing", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 100, maximumDelayMs: 100 } },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "a",
    });
    recorder.clock.advanceBy(99);
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "b",
    });
    recorder.clock.advanceBy(1);

    expect(spoken(recorder)).toEqual([{ channel: "polite", text: "ab" }]);
  });

  it("isolates identical announcements from concurrent responses", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1, maximumDelayMs: 10_000 } },
    });
    for (const responseId of ["r1", "r2"]) {
      recorder.runtime.dispatch({ type: "response.started", responseId });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId,
        delta: "Same sentence. Next",
      });
    }
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "Same sentence.",
      "Same sentence.",
      "Next",
      "Next",
    ]);
  });

  it("rotates response identity on retry and rejects old-attempt deltas", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1, maximumDelayMs: 10_000 } },
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "old",
    });
    recorder.runtime.dispatch({
      type: "response.retrying",
      responseId: "r1",
      responseInstanceId: "old",
      nextResponseInstanceId: "new",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      responseInstanceId: "old",
      delta: "Stale sentence. Next",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      responseInstanceId: "new",
      delta: "Fresh sentence. Next",
    });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "Retrying response.",
      "Fresh sentence.",
      "Next",
    ]);
    expect(
      recorder
        .diagnosticTranscript()
        .some(({ reason }) => reason === "stale-response"),
    ).toBe(true);
  });

  it("cancels queued terminal work when a response ID is reused", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "Old answer",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r1" });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "New answer",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r1" });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "New answer",
      "Response complete.",
    ]);
  });

  it("serializes a response restart dispatched by a completion diagnostic", () => {
    const clock = new ManualClock();
    const announcements: string[] = [];
    const diagnostics: Array<{ sourceType?: string; reason: string }> = [];
    let restarted = false;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      clock,
      policy: {
        maxQueueSize: 1,
        text: { minimumCharacters: 1, maximumDelayMs: 10_000 },
      },
      onAnnouncement: ({ text }) => announcements.push(text),
      onDiagnostic: (diagnostic) => {
        diagnostics.push({
          reason: diagnostic.reason,
          ...(diagnostic.sourceType
            ? { sourceType: diagnostic.sourceType }
            : {}),
        });
        if (
          !restarted &&
          diagnostic.sourceType === "response.completed" &&
          diagnostic.reason === "scheduled"
        ) {
          restarted = true;
          runtime.dispatch({
            type: "response.started",
            responseId: "r1",
            responseInstanceId: "new",
          });
        }
      },
    });

    runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "old",
    });
    diagnostics.length = 0;
    runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      responseInstanceId: "old",
      delta: "Old answer",
    });
    runtime.dispatch({
      type: "response.completed",
      responseId: "r1",
      responseInstanceId: "old",
    });
    const completionTransactionDiagnostics = [...diagnostics];
    runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      responseInstanceId: "new",
      delta: "New answer",
    });
    runtime.dispatch({
      type: "response.completed",
      responseId: "r1",
      responseInstanceId: "new",
    });
    clock.runUntilIdle();

    expect(announcements).toEqual(["New answer"]);
    const firstStartedDiagnostic = completionTransactionDiagnostics.findIndex(
      ({ sourceType }) => sourceType === "response.started",
    );
    expect(firstStartedDiagnostic).toBeGreaterThan(0);
    expect(
      completionTransactionDiagnostics
        .slice(firstStartedDiagnostic + 1)
        .some(({ sourceType }) => sourceType === "response.completed"),
    ).toBe(false);
  });

  it("bounds diagnostic-triggered nested dispatch and diagnoses overflow", () => {
    const diagnostics: AnnouncementDiagnostic[] = [];
    const nestedResults: boolean[] = [];
    let queuedBurst = false;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      policy: { maxQueueSize: 2 },
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic);
        if (!queuedBurst && diagnostic.sourceType === "response.started") {
          queuedBurst = true;
          for (const [responseId, eventId] of [
            ["r2", "e2"],
            ["r3", "e3"],
            ["r4", "e4"],
            ["r5", "e5"],
          ] as const) {
            nestedResults.push(
              runtime.dispatch({
                type: "response.started",
                responseId,
                eventId,
              }),
            );
          }
        }
      },
    });

    const outerResult = runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      eventId: "e1",
    });

    expect(
      diagnostics
        .filter(
          ({ reason }) =>
            reason === "policy-silent" || reason === "queue-capacity",
        )
        .map(({ reason, sourceEventId }) => ({ reason, sourceEventId })),
    ).toEqual([
      { reason: "policy-silent", sourceEventId: "e1" },
      { reason: "policy-silent", sourceEventId: "e2" },
      { reason: "policy-silent", sourceEventId: "e3" },
      { reason: "queue-capacity", sourceEventId: "e4" },
      { reason: "queue-capacity", sourceEventId: "e5" },
    ]);
    expect(diagnostics.some(({ reason }) => reason === "invalid-event")).toBe(
      false,
    );
    expect(outerResult).toBe(true);
    expect(nestedResults).toEqual([true, true, false, false]);
  });

  it("bounds a one-in one-out nested dispatch generation", () => {
    const diagnostics: AnnouncementDiagnostic[] = [];
    let nextEvent = 1;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      policy: { maxQueueSize: 2 },
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic);
        if (diagnostic.reason === "policy-silent" && nextEvent < 20) {
          const suffix = nextEvent++;
          runtime.dispatch({
            type: "response.started",
            responseId: `r${suffix}`,
            eventId: `e${suffix}`,
          });
        }
      },
    });

    runtime.dispatch({
      type: "response.started",
      responseId: "r0",
      eventId: "e0",
    });

    expect(
      diagnostics.map(({ reason, sourceEventId }) => ({
        reason,
        sourceEventId,
      })),
    ).toEqual([
      { reason: "policy-silent", sourceEventId: "e0" },
      { reason: "policy-silent", sourceEventId: "e1" },
      { reason: "policy-silent", sourceEventId: "e2" },
      { reason: "queue-capacity", sourceEventId: "e3" },
    ]);
  });

  it("aggregates overflow beyond diagnostic capacity without callback runaway", () => {
    const diagnostics: AnnouncementDiagnostic[] = [];
    const burstResults: boolean[] = [];
    const overflowResults: boolean[] = [];
    let dispatchedBurst = false;
    let overflowCallbackDispatches = 0;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      policy: { maxQueueSize: 2 },
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic);
        if (!dispatchedBurst && diagnostic.sourceEventId === "e0") {
          dispatchedBurst = true;
          const burst: GenerativeA11yEvent[] = [
            { type: "response.started", responseId: "r1", eventId: "e1" },
            { type: "response.started", responseId: "r2", eventId: "e2" },
            { type: "response.started", responseId: "r3", eventId: "e3" },
            {
              type: "tool.started",
              toolId: "t4",
              label: "Tool four",
              eventId: "e4",
            },
            { type: "connection.lost", eventId: "e5" },
            { type: "response.started", responseId: "r6", eventId: "e6" },
            {
              type: "tool.started",
              toolId: "t7",
              label: "Tool seven",
              eventId: "e7",
            },
            { type: "connection.restored", eventId: "e8" },
            { type: "response.started", responseId: "r9", eventId: "e9" },
            {
              type: "tool.started",
              toolId: "t10",
              label: "Tool ten",
              eventId: "e10",
            },
          ];
          for (const event of burst) {
            burstResults.push(runtime.dispatch(event));
          }
        }
        if (diagnostic.reason === "queue-capacity") {
          overflowCallbackDispatches += 1;
          overflowResults.push(
            runtime.dispatch({
              type: "response.started",
              responseId: `overflow-${overflowCallbackDispatches}`,
              eventId: `overflow-${overflowCallbackDispatches}`,
            }),
          );
        }
      },
    });

    runtime.dispatch({
      type: "response.started",
      responseId: "r0",
      eventId: "e0",
    });

    expect(
      diagnostics.map(({ reason, sourceEventId, sourceType, count }) => ({
        reason,
        ...(sourceEventId === undefined ? {} : { sourceEventId }),
        ...(sourceType === undefined ? {} : { sourceType }),
        ...(count === undefined ? {} : { count }),
      })),
    ).toEqual([
      {
        reason: "policy-silent",
        sourceEventId: "e0",
        sourceType: "response.started",
      },
      {
        reason: "policy-silent",
        sourceEventId: "e1",
        sourceType: "response.started",
      },
      {
        reason: "policy-silent",
        sourceEventId: "e2",
        sourceType: "response.started",
      },
      {
        reason: "queue-capacity",
        sourceEventId: "e3",
        sourceType: "response.started",
      },
      {
        reason: "queue-capacity",
        sourceEventId: "e4",
        sourceType: "tool.started",
      },
      { reason: "queue-capacity", count: 6 },
    ]);
    expect(overflowCallbackDispatches).toBe(3);
    expect(burstResults).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(overflowResults).toEqual([false, false, false]);
  });

  it("does not retain terminal response state after diagnostic disposal", () => {
    const mapSet = vi.spyOn(Map.prototype, "set");
    let setCountAfterDispose: number | undefined;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    try {
      runtime = createGenerativeA11y({
        policy: { text: { minimumCharacters: 1 } },
        onAnnouncement: () => undefined,
        onDiagnostic: (diagnostic) => {
          if (
            diagnostic.sourceType === "response.completed" &&
            diagnostic.reason === "scheduled"
          ) {
            runtime.dispose();
            setCountAfterDispose = mapSet.mock.calls.length;
          }
        },
      });
      runtime.dispatch({ type: "response.started", responseId: "r1" });
      runtime.dispatch({
        type: "response.text.delta",
        responseId: "r1",
        delta: "Final answer",
      });

      runtime.dispatch({ type: "response.completed", responseId: "r1" });

      expect(setCountAfterDispose).toBeDefined();
      expect(mapSet.mock.calls).toHaveLength(setCountAfterDispose ?? 0);
    } finally {
      mapSet.mockRestore();
    }
  });

  it("clears nested dispatch work when disposed during a diagnostic", () => {
    const seenSourceTypes: string[] = [];
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      onAnnouncement: () => undefined,
      onDiagnostic: (diagnostic) => {
        if (diagnostic.sourceType) seenSourceTypes.push(diagnostic.sourceType);
        if (diagnostic.sourceType === "response.started") {
          runtime.dispatch({ type: "connection.restored" });
          runtime.dispose();
        }
      },
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });

    expect(seenSourceTypes).not.toContain("connection.restored");
  });

  it("inherits the response locale and tolerates malformed locales", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1 } },
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      locale: "fr",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "Bonjour. Suite",
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r2",
      locale: "not_a_locale",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r2",
      delta: "Still works. Next",
    });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript()[0]?.locale).toBe("fr");
    expect(recorder.transcript().map(({ text }) => text)).toContain(
      "Still works.",
    );
  });

  it("propagates locale metadata introduced by later response and tool events", () => {
    const recorder = createAnnouncementRecorder({
      preset: "verbose",
      policy: { text: { minimumCharacters: 1 } },
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      locale: "en",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      locale: "fr",
      delta: "Bonjour.",
    });
    recorder.runtime.dispatch({
      type: "response.completed",
      responseId: "r1",
      locale: "fr",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Recherche",
    });
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "t1",
      locale: "de",
      label: "Recherche",
    });
    recorder.clock.runUntilIdle();

    expect(
      recorder
        .transcript()
        .filter(({ responseId }) => responseId === "r1")
        .map(({ locale }) => locale),
    ).toEqual(["en", "fr", "fr"]);
    expect(
      recorder.transcript().find(({ toolId }) => toolId === "t1")?.locale,
    ).toBe("de");
  });

  it("does not let stale tool events overwrite the active locale", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      toolInstanceId: "one",
      locale: "en",
      label: "Search",
    });
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "t1",
      toolInstanceId: "two",
      locale: "fr",
      label: "Search",
    });
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "t1",
      toolInstanceId: "one",
      label: "Search",
    });
    recorder.clock.runUntilIdle();

    expect(
      recorder.transcript().find(({ text }) => text === "Search complete.")
        ?.locale,
    ).toBe("en");
  });

  it("does not adopt the locale from invalid tool progress", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      toolInstanceId: "one",
      locale: "en",
      label: "Search",
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      toolInstanceId: "one",
      locale: "fr",
      label: "Search",
      progress: 2,
    });
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "t1",
      toolInstanceId: "one",
      label: "Search",
    });
    recorder.clock.runUntilIdle();

    expect(
      recorder.transcript().find(({ text }) => text === "Search complete.")
        ?.locale,
    ).toBe("en");
    expect(
      recorder
        .diagnosticTranscript()
        .some(({ reason }) => reason === "invalid-event"),
    ).toBe(true);
  });

  it("enforces tool lifecycle ordering and safe failure announcements", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "tool.completed",
      toolId: "unknown",
      label: "Unknown",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      toolInstanceId: "one",
      label: "Search.",
    });
    recorder.runtime.dispatch({
      type: "tool.failed",
      toolId: "t1",
      toolInstanceId: "one",
      label: "Search",
      error: "secret backend trace",
      announcement: "Search could not finish.",
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      toolInstanceId: "one",
      label: "Search",
      progress: 0.5,
    });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toEqual([
      "Search could not finish.",
    ]);
    expect(recorder.diagnosticTranscript().map(({ reason }) => reason)).toEqual(
      expect.arrayContaining(["unknown-tool", "terminal-tool"]),
    );
  });

  it("reports policy suppression and counts owned flush timers", () => {
    const recorder = createAnnouncementRecorder({ preset: "completion-only" });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({ type: "connection.lost" });
    expect(
      recorder
        .diagnosticTranscript()
        .some(({ reason }) => reason === "policy-silent"),
    ).toBe(true);

    const buffered = createAnnouncementRecorder();
    buffered.runtime.dispatch({ type: "response.started", responseId: "r1" });
    buffered.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "fragment",
    });
    expect(buffered.runtime.pendingCount()).toBe(1);
  });

  it("announces safe response failures, connection changes, and citations", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      locale: "fr",
    });
    recorder.runtime.dispatch({
      type: "response.failed",
      responseId: "r1",
      error: "private stack trace",
      announcement: "The response could not be generated.",
    });
    recorder.runtime.dispatch({ type: "connection.lost" });
    recorder.runtime.dispatch({ type: "connection.restored" });
    recorder.runtime.dispatch({ type: "citation.available", count: 2 });
    recorder.clock.runUntilIdle();

    const text = recorder.transcript().map((item) => item.text);
    expect(text).not.toContain("private stack trace");
    expect(text).toEqual([
      "The response could not be generated.",
      "Connection lost. Reconnecting.",
      "Connection restored.",
      "2 sources available.",
    ]);
    expect(recorder.transcript()[0]?.locale).toBe("fr");
  });

  it("rejects invalid progress and bounds active entity tracking", () => {
    const recorder = createAnnouncementRecorder({
      preset: "verbose",
      policy: { maxActiveEntities: 1 },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r2" });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Upload",
    });
    recorder.runtime.dispatch({
      type: "tool.progress",
      toolId: "t1",
      label: "Upload",
      progress: 1.1,
    });

    expect(
      recorder
        .diagnosticTranscript()
        .filter(({ reason }) => reason === "invalid-event"),
    ).toHaveLength(2);
  });

  it("shares the active entity ceiling across responses and tools", () => {
    const recorder = createAnnouncementRecorder({
      preset: "verbose",
      policy: { maxActiveEntities: 1 },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Search",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      label: "Search",
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r2" });

    expect(
      recorder
        .diagnosticTranscript()
        .filter(({ reason }) => reason === "invalid-event")
        .map(({ sourceType }) => sourceType),
    ).toEqual(["tool.started", "response.started"]);
  });

  it("allows active response and tool identities to be replaced at the ceiling", () => {
    const recorder = createAnnouncementRecorder({
      preset: "verbose",
      policy: { maxActiveEntities: 1 },
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "old",
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r1",
      responseInstanceId: "new",
    });
    recorder.runtime.dispatch({
      type: "response.completed",
      responseId: "r1",
      responseInstanceId: "new",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      toolInstanceId: "old",
      label: "Search",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t1",
      toolInstanceId: "new",
      label: "Search",
    });

    expect(
      recorder
        .diagnosticTranscript()
        .filter(({ reason }) => reason === "invalid-event"),
    ).toEqual([]);
  });

  it("prioritizes an urgent interaction over queued polite output", () => {
    const recorder = createAnnouncementRecorder({
      policy: { text: { minimumCharacters: 1, maximumDelayMs: 10_000 } },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "A queued sentence.",
    });
    recorder.runtime.dispatch({
      type: "interaction.requested",
      interactionId: "i1",
      kind: "approval",
      label: "Approval required.",
      urgent: true,
    });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "assertive", text: "Approval required." },
      { channel: "polite", text: "A queued sentence." },
    ]);
  });

  it.each([
    ["minimal", ["A complete answer"]],
    ["balanced", ["A complete answer", "Response complete."]],
    [
      "verbose",
      ["Assistant is responding.", "A complete answer", "Response complete."],
    ],
    ["completion-only", ["A complete answer"]],
  ] satisfies Array<[PresetName, string[]]>)(
    'matches the "%s" preset transcript',
    (preset, expected) => {
      const recorder = createAnnouncementRecorder({ preset });
      recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r1",
        delta: "A complete answer",
      });
      recorder.runtime.dispatch({
        type: "response.completed",
        responseId: "r1",
      });
      recorder.clock.runUntilIdle();

      expect(recorder.transcript().map(({ text }) => text)).toEqual(expected);
    },
  );

  it("cleans all timers and returns false for dispatch after disposal", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "unfinished",
    });
    recorder.runtime.dispose();

    expect(recorder.clock.pendingCount()).toBe(0);
    expect(
      recorder.runtime.dispatch({ type: "response.started", responseId: "r2" }),
    ).toBe(false);
  });

  it("delivers announcements to subscribed listeners until they unsubscribe", () => {
    const clock = new ManualClock();
    const initial: AnnouncementIntent[] = [];
    const subscribed: AnnouncementIntent[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: (announcement) => initial.push(announcement),
    });
    const unsubscribe = runtime.subscribeAnnouncements((announcement) =>
      subscribed.push(announcement),
    );

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({
      type: "response.interrupted",
      responseId: "r1",
    });
    clock.runUntilIdle();
    unsubscribe();
    unsubscribe();
    runtime.dispatch({ type: "response.started", responseId: "r2" });
    runtime.dispatch({
      type: "response.interrupted",
      responseId: "r2",
    });
    clock.runUntilIdle();

    expect(initial.map(({ text }) => text)).toEqual([
      "Response stopped.",
      "Response stopped.",
    ]);
    expect(subscribed.map(({ text }) => text)).toEqual(["Response stopped."]);
  });

  it("supports attaching the first announcement listener after construction", () => {
    const clock = new ManualClock();
    const diagnostics: AnnouncementDiagnostic[] = [];
    const delivered: string[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    const unsubscribe = runtime.subscribeAnnouncements(({ text }) =>
      delivered.push(text),
    );
    runtime.dispatch({ type: "response.started", responseId: "r2" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r2" });
    clock.runUntilIdle();
    unsubscribe();

    expect(delivered).toEqual(["Response stopped."]);
    expect(
      diagnostics
        .filter(
          ({ reason }) => reason === "delivery-error" || reason === "delivered",
        )
        .map(({ reason }) => reason),
    ).toEqual(["delivery-error", "delivered"]);
  });

  it("keeps identical listener registrations independent", () => {
    const clock = new ManualClock();
    const delivered: string[] = [];
    const listener = ({ text }: AnnouncementIntent) => delivered.push(text);
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: listener,
    });
    const unsubscribe = runtime.subscribeAnnouncements(listener);

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();
    unsubscribe();
    runtime.dispatch({ type: "response.started", responseId: "r2" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r2" });
    clock.runUntilIdle();

    expect(delivered).toEqual([
      "Response stopped.",
      "Response stopped.",
      "Response stopped.",
    ]);
  });

  it("uses a listener snapshot when subscriptions change during delivery", () => {
    const clock = new ManualClock();
    const delivered: string[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
      policy: { tools: { announceStartAfterMs: 500 } },
    });
    let unsubscribeSecond: () => void = () => undefined;
    runtime.subscribeAnnouncements(() => {
      delivered.push("first");
      unsubscribeSecond();
    });
    unsubscribeSecond = runtime.subscribeAnnouncements(() =>
      delivered.push("second"),
    );

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();
    runtime.dispatch({ type: "response.started", responseId: "r2" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r2" });
    clock.runUntilIdle();

    expect(delivered).toEqual(["first", "second", "first"]);
  });

  it("isolates announcement listener failures and reports each delivery error", () => {
    const clock = new ManualClock();
    const delivered: string[] = [];
    const errors: Array<{ error: unknown; text: string }> = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => {
        throw new Error("initial listener failed");
      },
      onDeliveryError: (error, announcement) =>
        errors.push({ error, text: announcement.text }),
    });
    runtime.subscribeAnnouncements(() => {
      throw new Error("subscriber failed");
    });
    runtime.subscribeAnnouncements(({ text }) => delivered.push(text));

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(delivered).toEqual(["Response stopped."]);
    expect(errors).toHaveLength(2);
    expect(errors.map(({ text }) => text)).toEqual([
      "Response stopped.",
      "Response stopped.",
    ]);
  });

  it("keeps the delivery-error diagnostic when every listener fails", () => {
    const clock = new ManualClock();
    const reasons: string[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => {
        throw new Error("delivery failed");
      },
      onDiagnostic: ({ reason }) => reasons.push(reason),
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(reasons).toContain("delivery-error");
    expect(reasons).not.toContain("delivered");
  });

  it("keeps the delivery-error diagnostic when a listener throws undefined", () => {
    const clock = new ManualClock();
    const reasons: string[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => {
        throw undefined;
      },
      onDiagnostic: ({ reason }) => reasons.push(reason),
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(reasons).toContain("delivery-error");
    expect(reasons).not.toContain("delivered");
  });

  it("emits the terminal delivery diagnostic when an error observer disposes reentrantly", () => {
    const clock = new ManualClock();
    const reasons: string[] = [];
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => {
        throw new Error("delivery failed");
      },
      onDeliveryError: () => runtime.dispose(),
    });
    runtime.subscribeDiagnostics(({ reason }) => reasons.push(reason));

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(reasons).toContain("delivery-error");
    expect(reasons).not.toContain("delivered");
    expect(clock.pendingCount()).toBe(0);
    expect(() => runtime.subscribeDiagnostics(() => undefined)).toThrow(
      "disposed",
    );
  });

  it("preserves the outer terminal diagnostic across nested delivery and disposal", () => {
    const clock = new ManualClock();
    const terminalDiagnostics: string[] = [];
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      clock,
      onAnnouncement: ({ text }) => {
        if (text !== "Response stopped.") return;
        runtime.dispatch({ type: "connection.restored", label: "Nested." });
        clock.runUntilIdle();
      },
    });
    runtime.subscribeAnnouncements(({ text }) => {
      if (text === "Response stopped.") runtime.dispose();
    });
    runtime.subscribeDiagnostics((diagnostic) => {
      if (
        diagnostic.reason === "delivered" ||
        diagnostic.reason === "delivery-error"
      ) {
        terminalDiagnostics.push(diagnostic.announcement?.text ?? "missing");
      }
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(terminalDiagnostics).toEqual(["Nested.", "Response stopped."]);
    expect(clock.pendingCount()).toBe(0);
  });

  it("preserves the outer terminal diagnostic when nested delivery disposes", () => {
    const clock = new ManualClock();
    const terminalDiagnostics: string[] = [];
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      clock,
      onAnnouncement: ({ text }) => {
        if (text !== "Response stopped.") return;
        runtime.dispatch({ type: "connection.restored", label: "Nested." });
        clock.runUntilIdle();
      },
    });
    runtime.subscribeAnnouncements(({ text }) => {
      if (text === "Nested.") runtime.dispose();
    });
    runtime.subscribeDiagnostics((diagnostic) => {
      if (
        diagnostic.reason === "delivered" ||
        diagnostic.reason === "delivery-error"
      ) {
        terminalDiagnostics.push(diagnostic.announcement?.text ?? "missing");
      }
    });

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(terminalDiagnostics).toEqual(["Nested.", "Response stopped."]);
    expect(clock.pendingCount()).toBe(0);
  });

  it("subscribes to diagnostics and rejects new subscriptions after disposal", () => {
    const clock = new ManualClock();
    const diagnostics: AnnouncementDiagnostic[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
    });
    const unsubscribe = runtime.subscribeDiagnostics((diagnostic) =>
      diagnostics.push(diagnostic),
    );

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();
    unsubscribe();
    unsubscribe();

    expect(diagnostics.map(({ disposition }) => disposition)).toEqual([
      "suppressed",
      "queued",
      "announced",
    ]);

    runtime.dispose();
    expect(() => runtime.subscribeAnnouncements(() => undefined)).toThrow(
      "disposed",
    );
    expect(() => runtime.subscribeDiagnostics(() => undefined)).toThrow(
      "disposed",
    );
  });

  it("isolates diagnostic failures and emits disposal cancellations before clearing listeners", () => {
    const clock = new ManualClock();
    const diagnostics: AnnouncementDiagnostic[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
      onDiagnostic: () => {
        throw new Error("diagnostic listener failed");
      },
    });
    runtime.subscribeDiagnostics((diagnostic) => diagnostics.push(diagnostic));
    runtime.dispatch({
      type: "tool.started",
      toolId: "tool-1",
      label: "Search",
    });

    runtime.dispose();

    expect(diagnostics.map(({ reason }) => reason)).toContain(
      "runtime-disposed",
    );
  });

  it("emits a versioned source event before decisions and exposes a content-free snapshot", () => {
    const clock = new ManualClock(100);
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
      policy: { tools: { announceStartAfterMs: 500 } },
    });
    const events: unknown[] = [];
    runtime.subscribeDiagnosticEvents((event) => events.push(event));

    runtime.dispatch({
      type: "tool.started",
      toolId: "search-17",
      label: "Search confidential notes",
    });

    expect(events).toMatchObject([
      {
        schemaVersion: 1,
        sequence: 0,
        at: 100,
        kind: "event-observed",
        event: { type: "tool.started", toolId: "search-17" },
      },
      {
        schemaVersion: 1,
        sequence: 1,
        at: 100,
        kind: "decision",
        decision: { disposition: "queued", reason: "scheduled" },
      },
    ]);
    expect(runtime.getDiagnosticSnapshot()).toMatchObject({
      schemaVersion: 1,
      at: 100,
      pending: {
        announcements: [
          {
            sourceType: "tool.started",
            toolId: "search-17",
            dueAt: 600,
            delayMs: 500,
          },
        ],
      },
      tools: [{ toolId: "search-17", status: "active" }],
    });
    expect(JSON.stringify(runtime.getDiagnosticSnapshot())).not.toContain(
      "confidential",
    );
  });

  it("does not report source evidence for a rejected reentrant dispatch", () => {
    const sourceEventIds: string[] = [];
    let nested = false;
    let runtime: ReturnType<typeof createGenerativeA11y>;
    runtime = createGenerativeA11y({
      onAnnouncement: () => undefined,
      policy: { maxQueueSize: 1 },
      onDiagnostic: (diagnostic) => {
        if (nested || diagnostic.reason !== "scheduled") return;
        nested = true;
        expect(
          runtime.dispatch({
            type: "connection.restored",
            eventId: "accepted-reentrant",
          }),
        ).toBe(true);
        expect(
          runtime.dispatch({
            type: "connection.lost",
            eventId: "rejected-reentrant",
          }),
        ).toBe(false);
      },
    });
    runtime.subscribeDiagnosticEvents((event) => {
      if (event.kind === "event-observed" && event.event.eventId) {
        sourceEventIds.push(event.event.eventId);
      }
    });

    runtime.dispatch({ type: "connection.restored", eventId: "outer" });

    expect(sourceEventIds).toEqual(["outer", "accepted-reentrant"]);
  });

  it("isolates diagnostic-event listeners and rejects subscriptions after disposal", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    runtime.subscribeDiagnosticEvents(() => {
      throw new Error("observer failed");
    });

    expect(() =>
      runtime.dispatch({ type: "response.started", responseId: "r1" }),
    ).not.toThrow();

    runtime.dispose();
    expect(() => runtime.subscribeDiagnosticEvents(() => undefined)).toThrow(
      "disposed",
    );
  });

  it("tracks nested and concurrent workflow entities without announcing internal churn", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({
      type: "run.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
      label: "Research run",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "collect",
      stepInstanceId: "collect-1",
      label: "Collect sources",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "analyze-a",
      stepInstanceId: "a-1",
      parentStepId: "collect",
      parentStepInstanceId: "collect-1",
      label: "Analyze source A",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "analyze-b",
      stepInstanceId: "b-1",
      parentStepId: "collect",
      parentStepInstanceId: "collect-1",
      label: "Analyze source B",
    });

    expect(recorder.runtime.getDiagnosticSnapshot().runs).toEqual([
      expect.objectContaining({
        runId: "run-1",
        instanceId: "attempt-1",
        status: "active",
      }),
    ]);
    expect(recorder.runtime.getDiagnosticSnapshot().steps).toEqual([
      expect.objectContaining({ stepId: "analyze-a", parentStepId: "collect" }),
      expect.objectContaining({ stepId: "analyze-b", parentStepId: "collect" }),
      expect.objectContaining({ stepId: "collect" }),
    ]);
    expect(
      recorder.runtime.getDiagnosticSnapshot().steps?.at(-1),
    ).not.toHaveProperty("parentStepId");
    recorder.clock.advanceBy(0);
    expect(recorder.transcript()).toEqual([]);
  });

  it("announces only long-running top-level steps and summarizes a completed run", () => {
    const recorder = createAnnouncementRecorder({
      policy: { workflows: { announceStepAfterMs: 100 } },
    });
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      stepId: "fast",
      label: "Fast step",
    });
    recorder.clock.advanceBy(50);
    recorder.runtime.dispatch({
      type: "step.completed",
      runId: "run-1",
      stepId: "fast",
      label: "Fast step",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      stepId: "slow",
      label: "Slow step",
    });
    recorder.clock.advanceBy(100);
    recorder.runtime.dispatch({
      type: "step.completed",
      runId: "run-1",
      stepId: "slow",
      label: "Slow step",
    });
    recorder.runtime.dispatch({ type: "run.completed", runId: "run-1" });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "Slow step started." },
      { channel: "polite", text: "Slow step complete." },
      { channel: "polite", text: "Run complete. 2 steps completed." },
    ]);
  });

  it("does not repeat a completed response boundary as an empty run summary", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "response-1",
      runId: "run-1",
    });
    recorder.runtime.dispatch({
      type: "response.completed",
      responseId: "response-1",
      runId: "run-1",
    });
    recorder.runtime.dispatch({ type: "run.completed", runId: "run-1" });
    recorder.clock.runUntilIdle();

    expect(spoken(recorder)).toEqual([
      { channel: "polite", text: "Response complete." },
    ]);
    expect(recorder.diagnosticTranscript()).toContainEqual(
      expect.objectContaining({
        sourceType: "run.completed",
        reason: "policy-silent",
      }),
    );
  });

  it("keeps concurrent siblings active when one step fails", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    for (const stepId of ["one", "two"]) {
      recorder.runtime.dispatch({
        type: "step.started",
        runId: "run-1",
        stepId,
        label: `Step ${stepId}`,
      });
    }
    recorder.runtime.dispatch({
      type: "step.failed",
      runId: "run-1",
      stepId: "one",
      label: "Step one",
      announcement: "Step one could not finish.",
    });

    expect(recorder.runtime.getDiagnosticSnapshot().steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stepId: "one", status: "failed" }),
        expect.objectContaining({ stepId: "two", status: "active" }),
      ]),
    );
    recorder.clock.runUntilIdle();
    expect(spoken(recorder)).toContainEqual({
      channel: "assertive",
      text: "Step one could not finish.",
    });
  });

  it("rejects stale child events after a step retry", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "run.started",
      runId: "run-1",
      runInstanceId: "run-attempt",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      runInstanceId: "run-attempt",
      stepId: "draft",
      stepInstanceId: "draft-1",
      label: "Draft",
    });
    recorder.runtime.dispatch({
      type: "step.retrying",
      runId: "run-1",
      runInstanceId: "run-attempt",
      stepId: "draft",
      stepInstanceId: "draft-1",
      nextStepInstanceId: "draft-2",
      attempt: 2,
      label: "Draft",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "late-tool",
      toolInstanceId: "tool-1",
      runId: "run-1",
      runInstanceId: "run-attempt",
      stepId: "draft",
      stepInstanceId: "draft-1",
      label: "Late tool",
    });

    expect(recorder.diagnosticTranscript().at(-1)).toMatchObject({
      reason: "stale-step",
      toolId: "late-tool",
      runId: "run-1",
      stepId: "draft",
    });
  });

  it("refuses successful run completion while identified child work remains open", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      stepId: "open",
      label: "Open step",
    });
    recorder.runtime.dispatch({ type: "run.completed", runId: "run-1" });

    expect(recorder.diagnosticTranscript().at(-1)).toMatchObject({
      reason: "open-children",
      runId: "run-1",
    });
    expect(recorder.runtime.getDiagnosticSnapshot().runs?.[0]?.status).toBe(
      "active",
    );
  });

  it("observes anonymous step evidence without manufacturing identity", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      label: "Protocol step name",
    });

    expect(recorder.diagnosticTranscript().at(-1)).toMatchObject({
      reason: "partial-identity",
      runId: "run-1",
    });
    expect(recorder.runtime.getDiagnosticSnapshot().steps).toEqual([]);
  });

  it("cancels direct and nested child output when a run attempt is replaced", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "run.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "direct-tool",
      toolInstanceId: "tool-1",
      runId: "run-1",
      runInstanceId: "attempt-1",
      label: "Direct tool",
    });
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "direct-response",
      responseInstanceId: "response-1",
      runId: "run-1",
      runInstanceId: "attempt-1",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "direct-response",
      responseInstanceId: "response-1",
      runId: "run-1",
      runInstanceId: "attempt-1",
      delta: "Stale queued sentence.",
    });
    recorder.runtime.dispatch({
      type: "run.retrying",
      runId: "run-1",
      runInstanceId: "attempt-1",
      nextRunInstanceId: "attempt-2",
    });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).not.toEqual(
      expect.arrayContaining(["Direct tool.", "Stale queued sentence."]),
    );
    expect(recorder.clock.pendingCount()).toBe(0);
  });

  it("isolates descendants when a new run.started replaces an active attempt", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    recorder.runtime.dispatch({
      type: "run.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "draft",
      stepInstanceId: "draft-1",
      label: "Draft",
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "old-tool",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "draft",
      stepInstanceId: "draft-1",
      label: "Old tool",
    });
    recorder.runtime.dispatch({
      type: "run.started",
      runId: "run-1",
      runInstanceId: "attempt-2",
    });

    expect(recorder.runtime.getDiagnosticSnapshot()).toMatchObject({
      runs: [{ runId: "run-1", instanceId: "attempt-2", status: "active" }],
      steps: [
        {
          runId: "run-1",
          stepId: "draft",
          instanceId: "draft-1",
          status: "interrupted",
        },
      ],
      tools: [{ toolId: "old-tool", status: "failed" }],
    });

    recorder.runtime.dispatch({
      type: "step.completed",
      runId: "run-1",
      runInstanceId: "attempt-1",
      stepId: "draft",
      stepInstanceId: "draft-1",
      label: "Draft",
    });
    expect(recorder.diagnosticTranscript().at(-1)).toMatchObject({
      reason: "stale-run",
      runId: "run-1",
      stepId: "draft",
    });

    recorder.runtime.dispatch({
      type: "run.completed",
      runId: "run-1",
      runInstanceId: "attempt-2",
    });
    expect(recorder.runtime.getDiagnosticSnapshot().runs?.[0]).toMatchObject({
      instanceId: "attempt-2",
      status: "completed",
    });
  });

  it("does not complete a parent step while an identified nested step is active", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "run.started", runId: "run-1" });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      stepId: "parent",
      label: "Parent",
    });
    recorder.runtime.dispatch({
      type: "step.started",
      runId: "run-1",
      stepId: "child",
      parentStepId: "parent",
      label: "Child",
    });
    recorder.runtime.dispatch({
      type: "step.completed",
      runId: "run-1",
      stepId: "parent",
      label: "Parent",
    });

    expect(recorder.diagnosticTranscript().at(-1)).toMatchObject({
      reason: "open-children",
      runId: "run-1",
      stepId: "parent",
    });
    expect(
      recorder.runtime
        .getDiagnosticSnapshot()
        .steps?.find(({ stepId }) => stepId === "parent")?.status,
    ).toBe("active");
  });

  it("diagnoses malformed workflow identities without throwing", () => {
    const recorder = createAnnouncementRecorder();
    expect(() =>
      recorder.runtime.dispatch({
        type: "run.started",
        runId: 42,
      } as never),
    ).not.toThrow();
    expect(recorder.diagnosticTranscript().at(-1)?.reason).toBe(
      "invalid-event",
    );
  });
});
