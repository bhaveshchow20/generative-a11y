import { describe, expect, it } from "vitest";

import { createAnnouncementRecorder } from "./recorder.js";
import type { PresetName } from "./types.js";

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

  it("cleans all timers and rejects dispatch after disposal", () => {
    const recorder = createAnnouncementRecorder();
    recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r1",
      delta: "unfinished",
    });
    recorder.runtime.dispose();

    expect(recorder.clock.pendingCount()).toBe(0);
    expect(() =>
      recorder.runtime.dispatch({ type: "response.started", responseId: "r2" }),
    ).toThrow("disposed");
  });
});
