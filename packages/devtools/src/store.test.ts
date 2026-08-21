import { describe, expect, it } from "vitest";

import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
import { createDevtoolsStore } from "./index.js";

describe("devtools store", () => {
  it("captures bounded redacted records from independent runtimes without changing them", () => {
    const clock = new ManualClock();
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
    });
    const store = createDevtoolsStore({ maxEntries: 2 });
    const detach = store.attachRuntime({ id: "primary", runtime });

    runtime.dispatch({
      type: "response.started",
      responseId: "secret-response",
    });
    runtime.dispatch({
      type: "response.text.delta",
      responseId: "secret-response",
      delta: "Private response text.",
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.records).toHaveLength(2);
    expect(JSON.stringify(snapshot)).not.toContain("Private response text.");
    expect(
      snapshot.records.every((record) => record.runtimeId === "primary"),
    ).toBe(true);
    expect(runtime.getDiagnosticSnapshot().responses).toHaveLength(1);

    detach();
    store.dispose();
  });

  it("pauses only capture, clears, and isolates subscribers", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();
    store.attachRuntime({ id: "primary", runtime });
    store.subscribe(() => {
      throw new Error("subscriber failure");
    });

    store.pauseCapture();
    runtime.dispatch({ type: "connection.lost", label: "Private label" });
    expect(store.getSnapshot().records).toEqual([]);
    expect(runtime.pendingCount()).toBe(1);

    store.resumeCapture();
    runtime.dispatch({ type: "connection.restored", label: "Private label" });
    expect(store.getSnapshot().records).not.toEqual([]);
    store.clear();
    expect(store.getSnapshot().records).toEqual([]);
  });

  it("replaces a runtime attachment without allowing a stale detach to remove the new one", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();
    const first = store.attachRuntime({ id: "primary", runtime });
    const second = store.attachRuntime({ id: "primary", runtime });

    first();
    expect(store.getSnapshot().runtimeIds).toEqual(["primary"]);
    runtime.dispatch({ type: "connection.lost" });

    expect(store.getSnapshot().records).not.toEqual([]);
    second();
    const count = store.getSnapshot().records.length;
    runtime.dispatch({ type: "connection.restored" });
    expect(store.getSnapshot().records).toHaveLength(count);
  });

  it("retains a current content-free runtime snapshot and exports a bounded trace", () => {
    const clock = new ManualClock(100);
    const runtime = createGenerativeA11y({
      clock,
      policy: { minimumGapMs: 40 },
      onAnnouncement: () => undefined,
    });
    const store = createDevtoolsStore({ maxEntries: 2 });
    store.attachRuntime({ id: "primary", runtime });

    runtime.dispatch({ type: "response.started", responseId: "response-1" });
    runtime.dispatch({
      type: "response.text.delta",
      responseId: "response-1",
      delta: "Never retain this response text.",
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.runtimeSnapshots.primary?.responses).toEqual([
      expect.objectContaining({ responseId: "response-1", status: "active" }),
    ]);
    expect(snapshot.records.at(-1)).toMatchObject({
      sourceType: "response.text.delta",
      responseId: "response-1",
    });

    const exported = store.exportTrace();
    expect(exported.schemaVersion).toBe(1);
    expect(exported.runtimeSnapshots.primary?.pendingCount).toBe(
      runtime.getDiagnosticSnapshot().pendingCount,
    );
    expect(JSON.stringify(exported)).not.toContain(
      "Never retain this response text.",
    );
  });

  it("correlates browser delivery metadata without retaining DOM text or errors", () => {
    const store = createDevtoolsStore();

    store.recordDelivery({
      runtimeId: "primary",
      result: {
        announcementId: "announcement-1",
        at: 200,
        channel: "polite",
        error: { name: "NotAllowedError", message: "Private browser failure" },
        method: "live-region",
        responseId: "response-1",
        sourceType: "response.completed",
        status: "mutated",
      },
    });

    const record = store.getSnapshot().records.at(-1);
    expect(record).toMatchObject({
      announcementId: "announcement-1",
      deliveryMethod: "live-region",
      deliveryStatus: "mutated",
      errorName: "NotAllowedError",
      kind: "dom-delivery",
      runtimeId: "primary",
    });
    expect(JSON.stringify(store.exportTrace())).not.toContain(
      "Private browser failure",
    );
  });

  it("projects safe causal fields and declared adapter evidence without retaining event content", () => {
    const clock = new ManualClock();
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
    });
    const store = createDevtoolsStore();
    const evidence = ["ThreadRuntime.getState", "ThreadRuntime.subscribe"];
    store.attachRuntime({
      id: "assistant-thread",
      runtime,
      source: {
        adapter: "assistant-ui",
        evidence,
        fidelity: {
          interruption: "exact",
          retries: "unavailable",
          connection: "unavailable",
          optionalEvents: ["tool.failed", "citation.available"],
        },
      },
    });
    evidence[0] = "Private framework method";

    runtime.dispatch({
      type: "response.started",
      eventId: "response-started-1",
      responseId: "response-1",
      responseInstanceId: "attempt-1",
    });
    runtime.dispatch({
      type: "response.failed",
      announcement: "Private failure message.",
      error: "Private error detail.",
      eventId: "response-failed-1",
      responseId: "response-1",
      responseInstanceId: "attempt-1",
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.runtimeSources["assistant-thread"]).toEqual({
      adapter: "assistant-ui",
      evidence: ["ThreadRuntime.getState", "ThreadRuntime.subscribe"],
      fidelity: {
        interruption: "exact",
        retries: "unavailable",
        connection: "unavailable",
        optionalEvents: ["tool.failed", "citation.available"],
      },
    });
    expect(
      snapshot.records.find(
        (record) => record.sourceEventId === "response-failed-1",
      ),
    ).toMatchObject({
      responseId: "response-1",
      responseInstanceId: "attempt-1",
      sourceEventId: "response-failed-1",
    });
    expect(
      snapshot.records.find(
        (record) =>
          record.kind === "decision" &&
          record.sourceEventId === "response-failed-1",
      ),
    ).toMatchObject({
      channel: "assertive",
      reason: "scheduled",
      responseId: "response-1",
    });
    expect(JSON.stringify(store.exportTrace())).not.toContain(
      "Private failure message.",
    );
    expect(JSON.stringify(store.exportTrace())).not.toContain(
      "Private error detail.",
    );
  });

  it("rejects an invalid declared adapter source before subscribing", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();

    expect(() =>
      store.attachRuntime({
        id: "primary",
        runtime,
        source: {
          adapter: "",
          evidence: [],
          fidelity: {
            interruption: "exact",
            retries: "unavailable",
            connection: "unavailable",
          },
        },
      }),
    ).toThrow("source adapter must be a non-empty string");
    expect(store.getSnapshot().runtimeIds).toEqual([]);
  });

  it("rejects unsupported fidelity declarations and non-public evidence", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();

    expect(() =>
      store.attachRuntime({
        id: "primary",
        runtime,
        source: {
          adapter: "custom",
          evidence: ["x".repeat(121)],
          fidelity: {
            interruption: "inferred" as never,
            retries: "unavailable",
            connection: "unavailable",
            optionalEvents: ["not-a-runtime-event" as never],
          },
        },
      }),
    ).toThrow(
      "source evidence entries must be public strings up to 120 characters",
    );
    expect(() =>
      store.attachRuntime({
        id: "primary",
        runtime,
        source: {
          adapter: "custom",
          evidence: ["CustomAdapter.observe"],
          fidelity: {
            interruption: "inferred" as never,
            retries: "unavailable",
            connection: "unavailable",
          },
        },
      }),
    ).toThrow("source interruption fidelity contains an unsupported value");
    expect(() =>
      store.attachRuntime({
        id: "primary",
        runtime,
        source: {
          adapter: "custom",
          evidence: ["CustomAdapter.observe"],
          fidelity: {
            interruption: "exact",
            retries: "unavailable",
            connection: "unavailable",
            optionalEvents: ["not-a-runtime-event" as never],
          },
        },
      }),
    ).toThrow("source optional events contain an unsupported value");
  });

  it("retains an explicit retry transition without retaining event content", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();
    store.attachRuntime({ id: "primary", runtime });

    runtime.dispatch({
      type: "response.started",
      responseId: "response-1",
      responseInstanceId: "attempt-1",
    });
    runtime.dispatch({
      type: "response.retrying",
      attempt: 2,
      eventId: "retry-1",
      nextResponseInstanceId: "attempt-2",
      responseId: "response-1",
      responseInstanceId: "attempt-1",
    });

    expect(
      store
        .getSnapshot()
        .records.find((record) => record.sourceEventId === "retry-1"),
    ).toMatchObject({
      attempt: 2,
      nextResponseInstanceId: "attempt-2",
      responseId: "response-1",
      responseInstanceId: "attempt-1",
    });
  });
});
