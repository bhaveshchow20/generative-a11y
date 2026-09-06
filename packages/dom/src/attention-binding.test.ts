import { createRuntime } from "@generative-a11y/core";
import { describe, expect, it, vi } from "vitest";
import * as dom from "./index.js";
import type { AttentionSnapshot, AttentionStore } from "./attention.js";

function store() {
  let mode: AttentionSnapshot["mode"] = "background";
  const listeners = new Set<() => void>();
  const value: AttentionStore = {
    getSnapshot: () => ({
      visibility: "unknown",
      windowFocus: "unknown",
      focusArea: "unknown",
      newestResponse: "unknown",
      mode,
    }),
    getServerSnapshot() {
      return this.getSnapshot();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    registerComposer: () => () => {},
    registerConversation: () => () => {},
    registerNewestResponse: () => () => {},
    dispose: vi.fn(),
  };
  return {
    value,
    listeners,
    change(next: AttentionSnapshot["mode"]) {
      mode = next;
      for (const listener of listeners) listener();
    },
  };
}

describe("bindAttention", () => {
  it("forwards initial and changed modes, deduplicates, and releases borrowed resources", () => {
    const runtime = createRuntime({});
    const dispatch = vi.spyOn(runtime, "dispatch");
    const source = store();
    const binding = dom.bindAttention({
      runtime,
      attentionStore: source.value,
    });
    source.change("background");
    source.change("foreground");
    expect(dispatch.mock.calls.map(([event]) => event)).toEqual([
      { type: "attention.changed", mode: "background" },
      { type: "attention.changed", mode: "foreground" },
    ]);
    binding.dispose();
    binding.dispose();
    source.change("away");
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "attention.changed",
      mode: "unknown",
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    expect(source.listeners.size).toBe(0);
    expect(source.value.dispose).not.toHaveBeenCalled();
    const replacement = dom.bindAttention({
      runtime,
      attentionStore: source.value,
    });
    replacement.dispose();
    runtime.dispose();
  });
  it("rejects competing and reentrant construction before reading a store", () => {
    const runtime = createRuntime({});
    const source = store();
    const read = source.value.getSnapshot;
    source.value.getSnapshot = () => {
      expect(() =>
        dom.bindAttention({ runtime, attentionStore: source.value }),
      ).toThrow(/already/);
      return read();
    };
    const binding = dom.bindAttention({
      runtime,
      attentionStore: source.value,
    });
    expect(() =>
      dom.bindAttention({ runtime, attentionStore: source.value }),
    ).toThrow(/already/);
    binding.dispose();
    runtime.dispose();
  });
  it("rolls back failed reads and leaves retained callbacks inert after subscription failure", () => {
    const runtime = createRuntime({});
    const source = store();
    const dispatch = vi.spyOn(runtime, "dispatch");
    let retained = () => {};
    source.value.subscribe = (listener) => {
      retained = listener;
      throw new Error("subscribe failed");
    };
    expect(() =>
      dom.bindAttention({ runtime, attentionStore: source.value }),
    ).toThrow("subscribe failed");
    dispatch.mockClear();
    retained();
    expect(dispatch).not.toHaveBeenCalled();
    source.value.subscribe = () => () => {};
    source.value.getSnapshot = () => {
      throw new Error("read failed");
    };
    expect(() =>
      dom.bindAttention({ runtime, attentionStore: source.value }),
    ).toThrow("read failed");
    runtime.dispose();
  });
  it("still resets and releases its claim when unsubscribe throws", () => {
    const runtime = createRuntime({});
    const source = store();
    source.value.subscribe = () => () => {
      throw new Error("cleanup failed");
    };
    const dispatch = vi.spyOn(runtime, "dispatch");
    const binding = dom.bindAttention({
      runtime,
      attentionStore: source.value,
    });
    expect(() => binding.dispose()).not.toThrow();
    expect(dispatch).toHaveBeenLastCalledWith({
      type: "attention.changed",
      mode: "unknown",
    });
    dom.bindAttention({ runtime, attentionStore: source.value }).dispose();
    runtime.dispose();
  });
});

it("does not forward a read result after reentrant disposal and holds its claim through reset", () => {
  const runtime = createRuntime({});
  const source = store();
  const dispatch = vi.spyOn(runtime, "dispatch");
  const binding = dom.bindAttention({
    runtime,
    attentionStore: source.value,
  });
  const read = source.value.getSnapshot;
  source.value.getSnapshot = () => {
    binding.dispose();
    return read();
  };
  const originalSubscribe = source.value.subscribe;
  source.change("away");
  expect(dispatch.mock.calls.map(([event]) => event)).toEqual([
    { type: "attention.changed", mode: "background" },
    { type: "attention.changed", mode: "unknown" },
  ]);
  source.value.getSnapshot = read;
  source.value.subscribe = (listener) => {
    const unsubscribe = originalSubscribe(listener);
    return () => {
      binding.dispose();
      expect(() =>
        dom.bindAttention({ runtime, attentionStore: source.value }),
      ).toThrow(/already/);
      unsubscribe();
    };
  };
  dom.bindAttention({ runtime, attentionStore: source.value }).dispose();
  runtime.dispose();
});
