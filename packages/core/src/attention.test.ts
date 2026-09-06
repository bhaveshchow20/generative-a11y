import { describe, expect, it } from "vitest";
import { createRecorder } from "./recorder.js";
import { resolvePolicy } from "./policy.js";
import { createRuntime } from "./runtime.js";
import { ManualClock } from "./clock.js";
import type { RuntimeEvent, PresetName } from "./types.js";

function setup(preset: PresetName = "verbose") {
  return createRecorder({
    preset,
    policy: {
      attention: { enabled: true },
      minimumGapMs: 0,
      text: { minimumCharacters: 1, maximumDelayMs: 100 },
    },
  });
}

function text(recorder: ReturnType<typeof setup>) {
  return recorder.transcript().map((entry) => entry.text);
}

describe("attention policy", () => {
  it.each(["sentence", "paragraph"] as const)(
    "does not discard fresh %s content after inter-unit quiet whitespace",
    (strategy) => {
      for (const beforeQuiet of [false, true]) {
        const recorder = createRecorder({
          policy: {
            attention: { enabled: true },
            text: { strategy, minimumCharacters: 1, maximumDelayMs: 100 },
          },
        });
        recorder.runtime.dispatch({
          type: "response.started",
          responseId: "r",
        });
        if (beforeQuiet)
          recorder.runtime.dispatch({
            type: "response.text.delta",
            responseId: "r",
            delta: " \n",
          });
        recorder.runtime.dispatch({
          type: "attention.override",
          mode: "quiet",
        });
        if (!beforeQuiet) {
          recorder.runtime.dispatch({
            type: "response.text.delta",
            responseId: "r",
            delta: strategy === "sentence" ? "Suppressed. " : "Suppressed\n\n",
          });
          recorder.runtime.dispatch({
            type: "response.text.delta",
            responseId: "r",
            delta: " \n",
          });
        }
        recorder.runtime.dispatch({
          type: "attention.override",
          mode: "normal",
        });
        recorder.runtime.dispatch({
          type: "response.text.delta",
          responseId: "r",
          delta:
            strategy === "sentence"
              ? "Fresh sentence. "
              : "Fresh paragraph\n\n",
        });
        recorder.clock.runUntilIdle();
        expect(text(recorder)).toEqual([
          strategy === "sentence" ? "Fresh sentence." : "Fresh paragraph",
        ]);
        recorder.runtime.dispose();
      }
    },
  );

  it("rejects sparse triggers and partially scoped controls", () => {
    expect(() =>
      resolvePolicy("balanced", {
        attention: { enabled: true, quietWhen: new Array(1) },
      }),
    ).toThrow();
    const recorder = setup();
    recorder.runtime.dispatch({
      type: "attention.override",
      mode: "quiet",
      runInstanceId: "attempt",
    } as never);
    expect(recorder.runtime.getDiagnosticSnapshot().attention?.effective).toBe(
      "normal",
    );
    expect(recorder.diagnosticTranscript().at(-1)?.reason).toBe(
      "invalid-event",
    );
    recorder.runtime.dispose();
  });

  it("ignores a cancelled flush callback after quiet mode ends", () => {
    const manual = new ManualClock();
    const callbacks: Array<() => void> = [];
    const announcements: string[] = [];
    const runtime = createRuntime({
      policy: {
        attention: { enabled: true },
        text: { minimumCharacters: 1, maximumDelayMs: 100 },
      },
      clock: {
        now: () => manual.now(),
        clearTimeout: (timer) => manual.clearTimeout(timer),
        setTimeout: (callback, delay) => {
          callbacks.push(callback);
          return manual.setTimeout(callback, delay);
        },
      },
      onAnnouncement: (intent) => announcements.push(intent.text),
    });
    runtime.dispatch({ type: "response.started", responseId: "r" });
    runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "Discarded fragment",
    });
    const cancelledFlush = callbacks[0];
    runtime.dispatch({ type: "attention.override", mode: "quiet" });
    runtime.dispatch({ type: "attention.override", mode: "normal" });
    cancelledFlush?.();
    manual.runUntilIdle();
    expect(announcements).toEqual([]);
    runtime.dispose();
  });
  it("accepts only explicit quiet triggers and valid control enums", () => {
    for (const attention of [
      { enabled: 1 },
      { quietWhen: ["unknown"] },
      { quietWhen: "background" },
    ]) {
      expect(() =>
        resolvePolicy("balanced", { attention: attention as never }),
      ).toThrow();
    }
    const recorder = createRecorder({
      policy: {
        attention: { enabled: true, quietWhen: ["reading-history", "away"] },
      },
    });
    recorder.runtime.dispatch({
      type: "attention.changed",
      mode: "reading-history",
    });
    expect(recorder.runtime.getDiagnosticSnapshot().attention?.effective).toBe(
      "quiet",
    );
    recorder.runtime.dispatch({ type: "attention.changed", mode: "unknown" });
    expect(recorder.runtime.getDiagnosticSnapshot().attention?.effective).toBe(
      "normal",
    );
    const state = recorder.runtime.getDiagnosticSnapshot().attention;
    recorder.runtime.dispatch({
      type: "attention.changed",
      mode: "imagined",
    } as never);
    recorder.runtime.dispatch({
      type: "attention.override",
      mode: "foreground",
    } as never);
    expect(recorder.runtime.getDiagnosticSnapshot().attention).toBe(state);
    expect(
      recorder
        .diagnosticTranscript()
        .filter((item) => item.reason === "invalid-event"),
    ).toHaveLength(2);
    recorder.runtime.dispose();
  });

  it("does not replay bulk text already queued by a terminal event", () => {
    const recorder = setup("completion-only");
    recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "Full response",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r" });
    recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
    recorder.runtime.dispatch({ type: "attention.override", mode: "normal" });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual([]);
    recorder.runtime.dispose();
  });

  it("resets text suppression for a fresh retry attempt and rejects stale text", () => {
    const recorder = setup("completion-only");
    recorder.runtime.dispatch({
      type: "response.started",
      responseId: "r",
      responseInstanceId: "old",
    });
    recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      responseInstanceId: "old",
      delta: "Old text",
    });
    recorder.runtime.dispatch({ type: "attention.override", mode: "normal" });
    recorder.runtime.dispatch({
      type: "response.retrying",
      responseId: "r",
      responseInstanceId: "old",
      nextResponseInstanceId: "new",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      responseInstanceId: "old",
      delta: "Stale text",
    });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      responseInstanceId: "new",
      delta: "New text",
    });
    recorder.runtime.dispatch({
      type: "response.completed",
      responseId: "r",
      responseInstanceId: "new",
    });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(["New text"]);
    recorder.runtime.dispose();
  });

  it("drops long quiet text and resumes complete paragraph units", () => {
    const recorder = createRecorder({
      policy: {
        attention: { enabled: true },
        text: { strategy: "paragraph", minimumCharacters: 1 },
      },
    });
    recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
    recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
    for (let index = 0; index < 50; index++)
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r",
        delta: "x".repeat(1000),
      });
    expect(recorder.clock.pendingCount()).toBe(0);
    recorder.runtime.dispatch({ type: "attention.override", mode: "auto" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: " tail\n\nFresh paragraph\n\n",
    });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(["Fresh paragraph"]);
    expect(
      JSON.stringify(recorder.runtime.getDiagnosticSnapshot()),
    ).not.toContain("xxxx");
    recorder.runtime.dispose();
  });

  it("serializes reentrant overrides and clears all remaining work on disposal", () => {
    const recorder = setup();
    let once = false;
    recorder.runtime.subscribeDiagnostics((diagnostic) => {
      if (diagnostic.reason === "attention-quiet" && !once) {
        once = true;
        recorder.runtime.dispatch({
          type: "attention.override",
          mode: "normal",
        });
      }
    });
    recorder.runtime.dispatch({
      type: "tool.started",
      toolId: "t",
      label: "Tool",
    });
    recorder.runtime.dispatch({
      type: "attention.changed",
      mode: "background",
    });
    expect(recorder.runtime.getDiagnosticSnapshot().attention?.effective).toBe(
      "normal",
    );
    expect(recorder.runtime.pendingCount()).toBe(0);
    recorder.runtime.dispose();
    expect(recorder.clock.pendingCount()).toBe(0);
    expect(
      recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" }),
    ).toBe(false);
  });

  it("is opt-in and freezes a copied trigger list", () => {
    expect(resolvePolicy().attention).toEqual({
      enabled: false,
      quietWhen: ["background"],
    });
    const quietWhen = ["background" as const];
    const policy = resolvePolicy("balanced", {
      attention: { enabled: true, quietWhen },
    });
    quietWhen.length = 0;
    expect(policy.attention?.quietWhen).toEqual(["background"]);
    expect(Object.isFrozen(policy.attention)).toBe(true);
    expect(Object.isFrozen(policy.attention?.quietWhen)).toBe(true);
  });

  it("cancels queued text and starts while preserving a short completion notice", () => {
    const recorder = setup();
    recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "Pending sentence. ",
    });
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r" });
    recorder.runtime.dispatch({
      type: "attention.changed",
      mode: "background",
    });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(["Response complete."]);
    expect(recorder.diagnosticTranscript()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          disposition: "cancelled",
          reason: "attention-quiet",
        }),
      ]),
    );
    expect(recorder.runtime.getDiagnosticSnapshot().responses[0]?.status).toBe(
      "completed",
    );
    recorder.runtime.dispose();
  });

  it("keeps observation and user override independent, with stable snapshots", () => {
    const { runtime } = setup();
    const initial = runtime.getDiagnosticSnapshot().attention;
    expect(runtime.getDiagnosticSnapshot().attention).toBe(initial);
    runtime.dispatch({ type: "attention.changed", mode: "background" });
    expect(runtime.getDiagnosticSnapshot().attention).toEqual({
      observed: "background",
      override: "auto",
      effective: "quiet",
    });
    runtime.dispatch({ type: "attention.override", mode: "normal" });
    runtime.dispatch({ type: "attention.changed", mode: "reading-history" });
    expect(runtime.getDiagnosticSnapshot().attention?.effective).toBe("normal");
    runtime.dispatch({ type: "attention.override", mode: "quiet" });
    runtime.dispatch({ type: "attention.changed", mode: "foreground" });
    expect(runtime.getDiagnosticSnapshot().attention?.effective).toBe("quiet");
    runtime.dispatch({ type: "attention.override", mode: "auto" });
    expect(runtime.getDiagnosticSnapshot().attention?.effective).toBe("normal");
    runtime.dispose();
  });

  it.each(["away", "reading-history", "unknown", "foreground"] as const)(
    "does not automatically quiet %s",
    (mode) => {
      const recorder = setup();
      recorder.runtime.dispatch({ type: "attention.changed", mode });
      expect(
        recorder.runtime.getDiagnosticSnapshot().attention?.effective,
      ).toBe("normal");
      recorder.runtime.dispose();
    },
  );

  it("drops partial text across quiet intervals and resumes at a fresh sentence", () => {
    const recorder = setup("balanced");
    recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "Before quiet",
    });
    recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
    expect(recorder.runtime.pendingCount()).toBe(0);
    expect(recorder.clock.pendingCount()).toBe(0);
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: " and during",
    });
    recorder.runtime.dispatch({ type: "attention.override", mode: "normal" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: " and crossing. Fresh sentence. ",
    });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(["Fresh sentence."]);
    recorder.runtime.dispose();
  });

  it("does not flush an orphaned fragment on maximum delay or completion", () => {
    const recorder = setup("balanced");
    recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
    recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "Suppressed beginning",
    });
    recorder.runtime.dispatch({ type: "attention.override", mode: "normal" });
    recorder.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: " and an orphaned ending",
    });
    expect(recorder.clock.pendingCount()).toBe(0);
    recorder.clock.advanceBy(1000);
    recorder.runtime.dispatch({ type: "response.completed", responseId: "r" });
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(["Response complete."]);
    recorder.runtime.dispose();
  });

  it.each(["minimal", "completion-only"] as const)(
    "does not replay suppressed completion text in %s",
    (preset) => {
      const recorder = setup(preset);
      recorder.runtime.dispatch({ type: "response.started", responseId: "r" });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r",
        delta: "Earlier text. ",
      });
      recorder.runtime.dispatch({ type: "attention.override", mode: "quiet" });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r",
        delta: "Quiet text. ",
      });
      recorder.runtime.dispatch({ type: "attention.override", mode: "normal" });
      recorder.runtime.dispatch({
        type: "response.text.delta",
        responseId: "r",
        delta: "Later text. ",
      });
      recorder.runtime.dispatch({
        type: "response.completed",
        responseId: "r",
      });
      recorder.clock.runUntilIdle();
      expect(text(recorder)).toEqual([]);
      recorder.runtime.dispose();
    },
  );

  it("preserves failures, interactions, connection and terminal workflow notices", () => {
    const recorder = setup();
    const events: RuntimeEvent[] = [
      { type: "run.started", runId: "run" },
      { type: "step.started", runId: "run", stepId: "s", label: "Step" },
      { type: "tool.started", toolId: "t", label: "Tool" },
      { type: "attention.override", mode: "quiet" },
      {
        type: "step.progress",
        runId: "run",
        stepId: "s",
        label: "Step",
        progress: 0.5,
      },
      { type: "tool.progress", toolId: "t", label: "Tool", progress: 0.5 },
      {
        type: "interaction.requested",
        interactionId: "i",
        kind: "approval",
        label: "Approve?",
        urgent: true,
      },
      { type: "tool.failed", toolId: "t", label: "Tool" },
      { type: "step.completed", runId: "run", stepId: "s", label: "Step" },
      { type: "run.completed", runId: "run" },
      { type: "connection.lost" },
    ];
    events.forEach((event) => recorder.runtime.dispatch(event));
    recorder.clock.runUntilIdle();
    expect(text(recorder)).toEqual(
      expect.arrayContaining([
        "Approve?",
        "Tool failed.",
        "Step complete.",
        "Connection lost. Reconnecting.",
      ]),
    );
    expect(
      text(recorder).some(
        (value) => value.includes("started") || value.includes("50%"),
      ),
    ).toBe(false);
    expect(
      recorder.transcript().find((entry) => entry.text === "Approve?")?.channel,
    ).toBe("assertive");
    recorder.runtime.dispose();
    expect(recorder.clock.pendingCount()).toBe(0);
  });

  it.each(["minimal", "balanced", "verbose", "completion-only"] as const)(
    "preserves default-off behavior in %s",
    (preset) => {
      const left = createRecorder({ preset });
      const right = createRecorder({ preset });
      left.runtime.dispatch({ type: "attention.changed", mode: "background" });
      left.runtime.dispatch({ type: "attention.override", mode: "quiet" });
      for (const recorder of [left, right]) {
        recorder.runtime.dispatch({
          type: "response.started",
          responseId: "r",
        });
        recorder.runtime.dispatch({
          type: "response.text.delta",
          responseId: "r",
          delta: "Same response. ",
        });
        recorder.runtime.dispatch({
          type: "response.completed",
          responseId: "r",
        });
        recorder.clock.runUntilIdle();
      }
      expect(left.transcript()).toEqual(right.transcript());
      expect(left.runtime.getDiagnosticSnapshot().attention).toBeUndefined();
      left.runtime.dispose();
      right.runtime.dispose();
    },
  );
});
