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
    runtime.dispatch({ type: "connection.lost", label: "Private label" });

    const snapshot = store.getSnapshot();
    expect(snapshot.records).toHaveLength(2);
    expect(snapshot.droppedCount).toBeGreaterThan(0);
    expect(
      snapshot.records.every(
        (record) => record.sourceType === "connection.lost",
      ),
    ).toBe(true);
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

  it("notifies subscribers with the cleared terminal snapshot on disposal", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();
    const snapshots: ReturnType<typeof store.getSnapshot>[] = [];
    store.subscribe(() => snapshots.push(store.getSnapshot()));
    store.attachRuntime({ id: "primary", runtime });
    runtime.dispatch({ type: "connection.lost" });

    store.dispose();

    expect(snapshots.at(-1)).toMatchObject({
      runtimeIds: [],
      records: [],
      droppedCount: 0,
    });
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

  it("validates delivery metadata before capture-state guards", () => {
    const store = createDevtoolsStore();
    const delivery = {
      runtimeId: "primary",
      result: {
        announcementId: "announcement-1",
        at: 10,
        channel: "polite" as const,
        method: "live-region" as const,
        sourceType: "response.completed",
        status: "mutated" as const,
      },
    };

    store.pauseCapture();
    expect(() => store.recordDelivery({ ...delivery, runtimeId: " " })).toThrow(
      "delivery runtimeId must be non-empty",
    );
    store.recordDelivery(delivery);
    expect(store.getSnapshot().records).toEqual([]);

    store.dispose();
    expect(() =>
      store.recordDelivery({
        ...delivery,
        result: { ...delivery.result, at: Number.NaN },
      }),
    ).toThrow("delivery at must be finite");
    expect(() => store.recordDelivery(delivery)).not.toThrow();
  });

  it("keeps snapshot identity stable until captured state changes", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();

    const empty = store.getSnapshot();
    expect(store.getSnapshot()).toBe(empty);

    store.attachRuntime({ id: "primary", runtime });
    const attached = store.getSnapshot();
    expect(attached).not.toBe(empty);
    expect(store.getSnapshot()).toBe(attached);

    runtime.dispatch({ type: "connection.lost" });
    const captured = store.getSnapshot();
    expect(captured).not.toBe(attached);
    expect(store.getSnapshot()).toBe(captured);
  });

  it("refreshes runtime snapshots only on explicit state-changing paths", () => {
    const clock = new ManualClock(100);
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => undefined,
    });
    const store = createDevtoolsStore();
    store.attachRuntime({ id: "primary", runtime });
    const initial = store.getSnapshot();

    clock.advanceBy(25);
    expect(store.getSnapshot()).toBe(initial);
    expect(store.getSnapshot().runtimeSnapshots.primary?.at).toBe(100);

    store.refreshSnapshots();
    expect(store.getSnapshot()).not.toBe(initial);
    expect(store.getSnapshot().runtimeSnapshots.primary?.at).toBe(125);
  });

  it("uses captureSequence as the monotonic order across record kinds", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store = createDevtoolsStore();
    store.attachRuntime({ id: "primary", runtime });
    runtime.dispatch({ type: "connection.lost" });
    store.recordDelivery({
      runtimeId: "primary",
      result: {
        announcementId: "announcement-1",
        at: 10,
        channel: "assertive",
        method: "live-region",
        sourceType: "connection.lost",
        status: "mutated",
      },
    });

    expect(
      store.getSnapshot().records.map((record) => record.captureSequence),
    ).toEqual([0, 1, 2]);
    expect(store.getSnapshot().records.at(-1)).not.toHaveProperty("sequence");
  });
});
