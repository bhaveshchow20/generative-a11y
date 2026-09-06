import type { Runtime } from "@generative-a11y/core";
import type { AttentionSnapshot, AttentionStore } from "./attention.js";

export interface AttentionBindingOptions {
  readonly runtime: Runtime;
  readonly attentionStore: AttentionStore;
}

export interface AttentionBinding {
  dispose(): void;
}

const boundRuntimes = new WeakSet<Runtime>();

/** Borrow a store and runtime, forwarding observations without changing overrides. */
export function bindAttention({
  runtime,
  attentionStore,
}: AttentionBindingOptions): AttentionBinding {
  if (boundRuntimes.has(runtime)) {
    throw new Error("Runtime already has an attention binding");
  }
  // Claim before invoking any external code, including store accessors.
  boundRuntimes.add(runtime);
  let active = true;
  let unsubscribe: (() => void) | undefined;
  let lastMode: AttentionSnapshot["mode"] | undefined;
  let revision = 0;
  const update = () => {
    if (!active) return;
    const readRevision = ++revision;
    const mode = attentionStore.getSnapshot().mode;
    if (!active || revision !== readRevision || mode === lastMode) return;
    lastMode = mode;
    runtime.dispatch({ type: "attention.changed", mode });
  };
  const dispose = () => {
    if (!active) return;
    active = false;
    try {
      try {
        unsubscribe?.();
      } catch {
        // A throwing borrowed store cannot prevent observation reset.
      }
      if (lastMode !== undefined) {
        runtime.dispatch({ type: "attention.changed", mode: "unknown" });
      }
    } finally {
      boundRuntimes.delete(runtime);
    }
  };
  try {
    unsubscribe = attentionStore.subscribe(update);
    update();
  } catch (error) {
    try {
      dispose();
    } catch {
      // Preserve the original construction error.
    }
    throw error;
  }
  return { dispose };
}
