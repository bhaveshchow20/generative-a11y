import type {
  GenerativeA11yRuntime,
  RuntimeDiagnosticEventV1,
} from "@generative-a11y/core";

export interface DevtoolsRecord {
  readonly runtimeId: string;
  readonly sequence: number;
  readonly at: number;
  readonly kind: RuntimeDiagnosticEventV1["kind"];
  readonly sourceType?: string;
  readonly disposition?: string;
  readonly reason?: string;
}

export interface DevtoolsSnapshot {
  readonly paused: boolean;
  readonly droppedCount: number;
  readonly records: readonly DevtoolsRecord[];
  readonly runtimeIds: readonly string[];
}

export interface DevtoolsStoreOptions {
  readonly maxEntries?: number;
}

export interface AttachRuntimeOptions {
  readonly id: string;
  readonly runtime: Pick<
    GenerativeA11yRuntime,
    "subscribeDiagnosticEvents" | "getDiagnosticSnapshot"
  >;
}

export interface DevtoolsStore {
  attachRuntime(options: AttachRuntimeOptions): () => void;
  getSnapshot(): DevtoolsSnapshot;
  subscribe(listener: () => void): () => void;
  pauseCapture(): void;
  resumeCapture(): void;
  clear(): void;
  dispose(): void;
}

function asRecord(
  runtimeId: string,
  event: RuntimeDiagnosticEventV1,
): DevtoolsRecord {
  if (event.kind === "event-observed") {
    return Object.freeze({
      runtimeId,
      sequence: event.sequence,
      at: event.at,
      kind: event.kind,
      sourceType: event.event.type,
    });
  }
  return Object.freeze({
    runtimeId,
    sequence: event.sequence,
    at: event.at,
    kind: event.kind,
    ...(event.decision.sourceType
      ? { sourceType: event.decision.sourceType }
      : {}),
    disposition: event.decision.disposition,
    reason: event.decision.reason,
  });
}

export function createDevtoolsStore(
  options: DevtoolsStoreOptions = {},
): DevtoolsStore {
  const maxEntries = options.maxEntries ?? 250;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0)
    throw new RangeError("maxEntries must be a positive safe integer");
  const records: DevtoolsRecord[] = [];
  const runtimes = new Map<string, { unsubscribe: () => void }>();
  const listeners = new Set<() => void>();
  let paused = false;
  let droppedCount = 0;
  let disposed = false;

  const notify = () => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Store observers cannot alter capture.
      }
    }
  };
  const snapshot = (): DevtoolsSnapshot =>
    Object.freeze({
      paused,
      droppedCount,
      records: Object.freeze([...records]),
      runtimeIds: Object.freeze([...runtimes.keys()].sort()),
    });
  const capture = (runtimeId: string, event: RuntimeDiagnosticEventV1) => {
    if (paused || disposed) return;
    if (records.length === maxEntries) {
      records.shift();
      droppedCount += 1;
    }
    records.push(asRecord(runtimeId, event));
    notify();
  };

  return {
    attachRuntime({ id, runtime }) {
      if (disposed)
        throw new Error("Cannot attach to a disposed devtools store");
      if (!id.trim()) throw new TypeError("runtime id must be non-empty");
      runtimes.get(id)?.unsubscribe();
      const unsubscribe = runtime.subscribeDiagnosticEvents((event) =>
        capture(id, event),
      );
      const attachment = { unsubscribe };
      runtimes.set(id, attachment);
      notify();
      let attached = true;
      return () => {
        if (!attached) return;
        attached = false;
        unsubscribe();
        if (runtimes.get(id) === attachment) runtimes.delete(id);
        notify();
      };
    },
    getSnapshot: snapshot,
    subscribe(listener) {
      if (disposed)
        throw new Error("Cannot subscribe to a disposed devtools store");
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    pauseCapture() {
      if (disposed || paused) return;
      paused = true;
      notify();
    },
    resumeCapture() {
      if (disposed || !paused) return;
      paused = false;
      notify();
    },
    clear() {
      if (disposed) return;
      records.length = 0;
      droppedCount = 0;
      notify();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { unsubscribe } of runtimes.values()) unsubscribe();
      runtimes.clear();
      listeners.clear();
      records.length = 0;
    },
  };
}
