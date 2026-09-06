import { describe, expect, it } from "vitest";

import { ManualClock, createRecorder } from "./index.js";
import {
  createReplayFixture,
  matchesPartial,
  recordRuntime,
  replayEvents,
} from "./testing.js";

describe("core testing utilities", () => {
  it("records and replays attention observations and user overrides", () => {
    const source = createRecorder({
      policy: { attention: { enabled: true }, minimumGapMs: 0 },
    });
    const recording = recordRuntime({
      runtime: source.runtime,
      clock: source.clock,
    });
    const events = [
      { type: "response.started", responseId: "r" },
      { type: "attention.changed", mode: "background" },
      {
        type: "response.text.delta",
        responseId: "r",
        delta: "Quiet sentence. ",
      },
      { type: "attention.override", mode: "normal" },
      {
        type: "response.text.delta",
        responseId: "r",
        delta: "Fresh sentence is announced. ",
      },
      { type: "response.completed", responseId: "r" },
    ] as const;
    for (const event of events) {
      source.clock.advanceBy(1);
      recording.runtime.dispatch(event);
    }
    source.clock.runUntilIdle();
    const target = createRecorder({
      policy: { attention: { enabled: true }, minimumGapMs: 0 },
    });
    replayEvents(
      target.runtime,
      target.clock,
      JSON.parse(JSON.stringify(recording.fixture())),
    );
    target.clock.runUntilIdle();
    expect(target.transcript()).toEqual(source.transcript());
    expect(target.diagnosticTranscript()).toEqual(
      source.diagnosticTranscript(),
    );
    expect(target.runtime.getDiagnosticSnapshot().attention).toEqual(
      source.runtime.getDiagnosticSnapshot().attention,
    );
    source.runtime.dispose();
    target.runtime.dispose();
  });

  it("rejects malformed or workflow-scoped attention controls", () => {
    for (const event of [
      { type: "attention.changed", mode: "reading" },
      { type: "attention.override", mode: "foreground" },
      { type: "attention.changed" },
      { type: "attention.override", mode: "quiet", runId: "r" },
      { type: "attention.override", mode: "quiet", runInstanceId: "attempt" },
    ]) {
      expect(() =>
        createReplayFixture([{ at: 0, event: event as never }]),
      ).toThrow(/attention/);
    }
  });

  it("matches only the requested top-level semantic fields", () => {
    expect(
      matchesPartial(
        { disposition: "suppressed", reason: "policy-silent", sequence: 3 },
        { reason: "policy-silent" },
      ),
    ).toBe(true);
    expect(
      matchesPartial(
        { disposition: "suppressed", reason: "policy-silent" },
        { reason: "scope-cancelled" },
      ),
    ).toBe(false);
  });

  it("records only forwarded events as relative, immutable fixture entries", () => {
    const clock = new ManualClock(100);
    const recorder = createRecorder({ startAt: 100 });
    const recording = recordRuntime({ runtime: recorder.runtime, clock });
    const event = {
      type: "response.started" as const,
      responseId: "r1",
    };

    recording.runtime.dispatch(event);
    clock.advanceBy(20);
    recording.runtime.dispatch({
      type: "response.interrupted",
      responseId: "r1",
    });
    event.responseId = "mutated-after-dispatch";

    expect(recording.events()).toEqual([
      { at: 0, event: { type: "response.started", responseId: "r1" } },
      { at: 20, event: { type: "response.interrupted", responseId: "r1" } },
    ]);
    expect(recording.fixture()).toEqual({
      format: "generative-a11y/replay",
      version: 1,
      startAt: 100,
      events: recording.events(),
    });
  });

  it("returns dispatch acceptance and excludes rejected runtime events", () => {
    const recorder = createRecorder();
    const recording = recordRuntime({
      runtime: recorder.runtime,
      clock: recorder.clock,
    });
    recorder.runtime.dispose();

    expect(
      recording.runtime.dispatch({
        type: "response.started",
        responseId: "discarded",
      }),
    ).toBe(false);
    expect(recording.events()).toEqual([]);
  });

  it("replays stable same-time ordering without settling caller-controlled timers", () => {
    const target = createRecorder({ startAt: 10 });
    const fixture = createReplayFixture(
      [
        {
          at: 0,
          event: { type: "response.started", responseId: "r1" },
        },
        {
          at: 0,
          event: {
            type: "response.text.delta",
            responseId: "r1",
            delta: "An unfinished fragment",
          },
        },
        {
          at: 10,
          event: { type: "response.completed", responseId: "r1" },
        },
      ],
      { startAt: 10 },
    );

    replayEvents(target.runtime, target.clock, fixture);

    expect(target.clock.now()).toBe(20);
    expect(target.transcript()).toEqual([]);
    target.clock.runUntilIdle();
    expect(target.transcript().map(({ text }) => text)).toEqual([
      "An unfinished fragment",
      "Response complete.",
    ]);
  });

  it("fails with the fixture entry index when the target rejects an event", () => {
    const target = createRecorder();
    const fixture = createReplayFixture([
      {
        at: 0,
        event: { type: "response.started", responseId: "r1" },
      },
    ]);
    target.runtime.dispose();

    expect(() => replayEvents(target.runtime, target.clock, fixture)).toThrow(
      "entry 0",
    );
  });

  it("rejects malformed and backwards fixtures before dispatching", () => {
    const target = createRecorder();
    expect(() =>
      replayEvents(target.runtime, target.clock, {
        format: "generative-a11y/replay",
        version: 1,
        startAt: 0,
        events: [
          { at: 1, event: { type: "response.started", responseId: "r1" } },
          { at: 0, event: { type: "response.completed", responseId: "r1" } },
        ],
      }),
    ).toThrow("non-decreasing");
    expect(target.diagnosticTranscript()).toEqual([]);
  });

  it("records and replays hierarchical attempts with stable relationships", () => {
    const target = createRecorder({
      policy: {
        workflows: { runs: "silent", steps: "silent" },
      },
    });
    const fixture = createReplayFixture([
      {
        at: 0,
        event: {
          type: "run.started",
          runId: "run",
          runInstanceId: "run-1",
        },
      },
      {
        at: 1,
        event: {
          type: "step.started",
          runId: "run",
          runInstanceId: "run-1",
          stepId: "child",
          stepInstanceId: "child-1",
          label: "Child",
        },
      },
      {
        at: 2,
        event: {
          type: "step.retrying",
          runId: "run",
          runInstanceId: "run-1",
          stepId: "child",
          stepInstanceId: "child-1",
          nextStepInstanceId: "child-2",
          label: "Child",
        },
      },
      {
        at: 3,
        event: {
          type: "step.completed",
          runId: "run",
          runInstanceId: "run-1",
          stepId: "child",
          stepInstanceId: "child-2",
          label: "Child",
        },
      },
      {
        at: 4,
        event: { type: "run.completed", runId: "run", runInstanceId: "run-1" },
      },
    ]);

    replayEvents(target.runtime, target.clock, fixture);

    expect(target.runtime.getDiagnosticSnapshot()).toMatchObject({
      runs: [{ runId: "run", instanceId: "run-1", status: "completed" }],
      steps: [
        {
          runId: "run",
          stepId: "child",
          instanceId: "child-2",
          status: "completed",
        },
      ],
    });
  });

  it("rejects hierarchy fixtures without run identity", () => {
    expect(() =>
      createReplayFixture([
        {
          at: 0,
          event: { type: "step.started", label: "Missing run" } as never,
        },
      ]),
    ).toThrow("requires runId");
  });

  it("rejects step fixtures without the label required by runtime dispatch", () => {
    expect(() =>
      createReplayFixture([
        {
          at: 0,
          event: {
            type: "step.started",
            runId: "run",
            stepId: "draft",
          } as never,
        },
      ]),
    ).toThrow("requires label");
  });
});
