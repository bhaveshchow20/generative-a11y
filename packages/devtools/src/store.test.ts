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
});
