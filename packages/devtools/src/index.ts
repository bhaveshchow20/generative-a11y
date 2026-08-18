import type {
  GenerativeA11yRuntime,
  RuntimeDiagnosticEventV1,
  RuntimeDiagnosticSnapshotV1,
} from "@generative-a11y/core";

export type DevtoolsRecordKind =
  RuntimeDiagnosticEventV1["kind"] | "dom-delivery";

export interface DevtoolsRecord {
  readonly runtimeId: string;
  readonly sequence?: number;
  readonly captureSequence: number;
  readonly at: number;
  readonly kind: DevtoolsRecordKind;
  readonly sourceType?: string;
  readonly sourceEventId?: string;
  readonly disposition?: string;
  readonly reason?: string;
  readonly announcementId?: string;
  readonly responseId?: string;
  readonly toolId?: string;
  readonly interactionId?: string;
  readonly scheduledAt?: number;
  readonly dueAt?: number;
  readonly delayMs?: number;
  readonly queueSequence?: number;
  readonly channel?: "polite" | "assertive";
  readonly deliveryStatus?: "notified" | "mutated" | "unavailable" | "disposed";
  readonly deliveryMethod?: "aria-notify" | "live-region" | "none";
  readonly errorName?: string;
}

export interface DeliveryRecordInput {
  readonly runtimeId: string;
  readonly result: {
    readonly status: "notified" | "mutated" | "unavailable" | "disposed";
    readonly method: "aria-notify" | "live-region" | "none";
    readonly channel: "polite" | "assertive";
    readonly announcementId: string;
    readonly sourceType: string;
    readonly at: number;
    readonly sourceEventId?: string;
    readonly responseId?: string;
    readonly toolId?: string;
    readonly interactionId?: string;
    readonly error?: { readonly name: string; readonly message?: string };
  };
}

export interface DevtoolsSnapshot {
  readonly paused: boolean;
  readonly droppedCount: number;
  readonly records: readonly DevtoolsRecord[];
  readonly runtimeIds: readonly string[];
  readonly runtimeSnapshots: Readonly<
    Record<string, RuntimeDiagnosticSnapshotV1>
  >;
}

export interface DevtoolsTraceExportV1 {
  readonly schemaVersion: 1;
  readonly kind: "generative-a11y/devtools-trace";
  readonly paused: boolean;
  readonly droppedCount: number;
  readonly records: readonly DevtoolsRecord[];
  readonly runtimeSnapshots: Readonly<
    Record<string, RuntimeDiagnosticSnapshotV1>
  >;
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
  refreshSnapshots(): void;
  recordDelivery(input: DeliveryRecordInput): void;
  clear(): void;
  exportTrace(): DevtoolsTraceExportV1;
  dispose(): void;
}

function asRecord(
  runtimeId: string,
  event: RuntimeDiagnosticEventV1,
  captureSequence: number,
): DevtoolsRecord {
  if (event.kind === "event-observed") {
    return Object.freeze({
      runtimeId,
      sequence: event.sequence,
      captureSequence,
      at: event.at,
      kind: event.kind,
      sourceType: event.event.type,
      ...("responseId" in event.event
        ? { responseId: event.event.responseId }
        : {}),
      ...("toolId" in event.event ? { toolId: event.event.toolId } : {}),
      ...("interactionId" in event.event
        ? { interactionId: event.event.interactionId }
        : {}),
    });
  }
  return Object.freeze({
    runtimeId,
    sequence: event.sequence,
    captureSequence,
    at: event.at,
    kind: event.kind,
    ...(event.decision.sourceType
      ? { sourceType: event.decision.sourceType }
      : {}),
    disposition: event.decision.disposition,
    reason: event.decision.reason,
    ...(event.decision.announcement
      ? { announcementId: event.decision.announcement.id }
      : {}),
    ...(event.decision.responseId
      ? { responseId: event.decision.responseId }
      : {}),
    ...(event.decision.toolId ? { toolId: event.decision.toolId } : {}),
    ...(event.decision.interactionId
      ? { interactionId: event.decision.interactionId }
      : {}),
    ...(event.decision.scheduledAt !== undefined
      ? { scheduledAt: event.decision.scheduledAt }
      : {}),
    ...(event.decision.dueAt !== undefined
      ? { dueAt: event.decision.dueAt }
      : {}),
    ...(event.decision.delayMs !== undefined
      ? { delayMs: event.decision.delayMs }
      : {}),
    ...(event.decision.queueSequence !== undefined
      ? { queueSequence: event.decision.queueSequence }
      : {}),
  });
}

function asDeliveryRecord(
  input: DeliveryRecordInput,
  captureSequence: number,
): DevtoolsRecord {
  const { result } = input;
  return Object.freeze({
    runtimeId: input.runtimeId,
    captureSequence,
    at: result.at,
    kind: "dom-delivery" as const,
    sourceType: result.sourceType,
    announcementId: result.announcementId,
    channel: result.channel,
    deliveryStatus: result.status,
    deliveryMethod: result.method,
    ...(result.sourceEventId ? { sourceEventId: result.sourceEventId } : {}),
    ...(result.responseId ? { responseId: result.responseId } : {}),
    ...(result.toolId ? { toolId: result.toolId } : {}),
    ...(result.interactionId ? { interactionId: result.interactionId } : {}),
    ...(result.error?.name ? { errorName: result.error.name } : {}),
  });
}

function copyRuntimeSnapshot(
  source: RuntimeDiagnosticSnapshotV1,
): RuntimeDiagnosticSnapshotV1 {
  return Object.freeze({
    schemaVersion: 1,
    at: source.at,
    policy: Object.freeze({
      ...source.policy,
      text: Object.freeze({ ...source.policy.text }),
      tools: Object.freeze({ ...source.policy.tools }),
    }),
    pending: Object.freeze({
      announcements: Object.freeze(
        source.pending.announcements.map((item) => Object.freeze({ ...item })),
      ),
      flushes: Object.freeze(
        source.pending.flushes.map((item) => Object.freeze({ ...item })),
      ),
    }),
    responses: Object.freeze(
      source.responses.map((item) => Object.freeze({ ...item })),
    ),
    tools: Object.freeze(
      source.tools.map((item) => Object.freeze({ ...item })),
    ),
    pendingCount: source.pendingCount,
  });
}

export function createDevtoolsStore(
  options: DevtoolsStoreOptions = {},
): DevtoolsStore {
  const maxEntries = options.maxEntries ?? 250;
  if (!Number.isSafeInteger(maxEntries) || maxEntries <= 0)
    throw new RangeError("maxEntries must be a positive safe integer");
  const records: DevtoolsRecord[] = [];
  const runtimes = new Map<
    string,
    {
      readonly runtime: AttachRuntimeOptions["runtime"];
      readonly unsubscribe: () => void;
    }
  >();
  const runtimeSnapshots = new Map<string, RuntimeDiagnosticSnapshotV1>();
  const listeners = new Set<() => void>();
  let paused = false;
  let droppedCount = 0;
  let nextCaptureSequence = 0;
  let disposed = false;
  let cachedSnapshot: DevtoolsSnapshot | undefined;

  const notify = () => {
    cachedSnapshot = undefined;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Store observers cannot alter capture.
      }
    }
  };
  const snapshot = (): DevtoolsSnapshot => {
    if (cachedSnapshot) return cachedSnapshot;
    const snapshots = Object.freeze(
      Object.fromEntries(
        [...runtimeSnapshots.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([id, value]) => [id, value]),
      ),
    ) as Readonly<Record<string, RuntimeDiagnosticSnapshotV1>>;
    cachedSnapshot = Object.freeze({
      paused,
      droppedCount,
      records: Object.freeze([...records]),
      runtimeIds: Object.freeze([...runtimes.keys()].sort()),
      runtimeSnapshots: snapshots,
    });
    return cachedSnapshot;
  };
  const refreshRuntimeSnapshot = (
    runtimeId: string,
    runtime: AttachRuntimeOptions["runtime"],
  ) => {
    try {
      runtimeSnapshots.set(
        runtimeId,
        copyRuntimeSnapshot(runtime.getDiagnosticSnapshot()),
      );
    } catch {
      // Snapshot failures cannot affect the observed runtime.
    }
  };
  const refreshAllSnapshots = () => {
    for (const [runtimeId, attachment] of runtimes)
      refreshRuntimeSnapshot(runtimeId, attachment.runtime);
  };
  const appendRecord = (record: DevtoolsRecord) => {
    if (records.length === maxEntries) {
      records.shift();
      droppedCount += 1;
    }
    records.push(record);
  };
  const capture = (
    runtimeId: string,
    runtime: AttachRuntimeOptions["runtime"],
    event: RuntimeDiagnosticEventV1,
  ) => {
    if (paused || disposed) return;
    appendRecord(asRecord(runtimeId, event, nextCaptureSequence++));
    refreshRuntimeSnapshot(runtimeId, runtime);
    notify();
  };

  return {
    attachRuntime({ id, runtime }) {
      if (disposed)
        throw new Error("Cannot attach to a disposed devtools store");
      if (!id.trim()) throw new TypeError("runtime id must be non-empty");
      runtimes.get(id)?.unsubscribe();
      const unsubscribe = runtime.subscribeDiagnosticEvents((event) =>
        capture(id, runtime, event),
      );
      const attachment = { runtime, unsubscribe };
      runtimes.set(id, attachment);
      refreshRuntimeSnapshot(id, runtime);
      notify();
      let attached = true;
      return () => {
        if (!attached) return;
        attached = false;
        unsubscribe();
        if (runtimes.get(id) === attachment) {
          runtimes.delete(id);
          runtimeSnapshots.delete(id);
        }
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
    refreshSnapshots() {
      if (disposed) return;
      refreshAllSnapshots();
      notify();
    },
    recordDelivery(input) {
      if (!input.runtimeId.trim())
        throw new TypeError("delivery runtimeId must be non-empty");
      if (!Number.isFinite(input.result.at))
        throw new TypeError("delivery at must be finite");
      if (paused || disposed) return;
      appendRecord(asDeliveryRecord(input, nextCaptureSequence++));
      notify();
    },
    clear() {
      if (disposed) return;
      records.length = 0;
      droppedCount = 0;
      notify();
    },
    exportTrace() {
      refreshAllSnapshots();
      notify();
      const current = snapshot();
      return Object.freeze({
        schemaVersion: 1,
        kind: "generative-a11y/devtools-trace",
        paused: current.paused,
        droppedCount: current.droppedCount,
        records: current.records,
        runtimeSnapshots: current.runtimeSnapshots,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { unsubscribe } of runtimes.values()) unsubscribe();
      runtimes.clear();
      runtimeSnapshots.clear();
      records.length = 0;
      notify();
      listeners.clear();
    },
  };
}
