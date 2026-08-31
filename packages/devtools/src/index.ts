import type {
  AdapterFidelity,
  GenerativeA11yRuntime,
  RuntimeDiagnosticEventV1,
  RuntimeDiagnosticSnapshotV1,
} from "@generative-a11y/core";

export type DevtoolsRecordKind =
  RuntimeDiagnosticEventV1["kind"] | "dom-delivery";

export interface DevtoolsRecord {
  readonly runtimeId: string;
  /** Opaque key for the immutable adapter evidence captured with this record. */
  readonly runtimeSourceId?: string;
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
  readonly responseInstanceId?: string;
  readonly nextResponseInstanceId?: string;
  readonly attempt?: number;
  readonly toolId?: string;
  readonly toolInstanceId?: string;
  readonly interactionId?: string;
  readonly approvalId?: string;
  /** Stable logical run identity retained as content-free correlation data. */
  readonly runId?: string;
  /** Stable run attempt identity retained as correlation data. */
  readonly runInstanceId?: string;
  /** Replacement run attempt identity on retry evidence. */
  readonly nextRunInstanceId?: string;
  /** Explicit logical parent run identity. */
  readonly parentRunId?: string;
  /** Stable logical step identity retained as content-free correlation data. */
  readonly stepId?: string;
  /** Stable step attempt identity retained as correlation data. */
  readonly stepInstanceId?: string;
  /** Replacement step attempt identity on retry evidence. */
  readonly nextStepInstanceId?: string;
  /** Explicit logical parent step identity. */
  readonly parentStepId?: string;
  /** Explicit tool that delegated to a child run. */
  readonly parentToolId?: string;
  /** Explicit response that owns a child run. */
  readonly parentResponseId?: string;
  readonly progress?: number;
  readonly outcome?: string;
  readonly count?: number;
  readonly scheduledAt?: number;
  readonly dueAt?: number;
  readonly delayMs?: number;
  readonly queueSequence?: number;
  readonly channel?: "polite" | "assertive";
  readonly deliveryStatus?: "notified" | "mutated" | "unavailable" | "disposed";
  readonly deliveryMethod?: "aria-notify" | "live-region" | "none";
  readonly errorName?: string;
}

/**
 * Explicit, serializable evidence declared by an integration. Devtools never
 * detects framework state or infers fidelity on its own.
 */
export interface DevtoolsRuntimeSource {
  readonly adapter: string;
  readonly evidence: readonly string[];
  readonly fidelity: Readonly<
    Omit<AdapterFidelity, "optionalEvents"> & {
      readonly optionalEvents?: readonly NonNullable<
        AdapterFidelity["optionalEvents"]
      >[number][];
    }
  >;
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
    /** Stable logical run identity copied from the delivered intent. */
    readonly runId?: string;
    /** Stable run attempt identity copied from the delivered intent. */
    readonly runInstanceId?: string;
    /** Stable logical step identity copied from the delivered intent. */
    readonly stepId?: string;
    /** Stable step attempt identity copied from the delivered intent. */
    readonly stepInstanceId?: string;
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
  readonly runtimeSources: Readonly<Record<string, DevtoolsRuntimeSource>>;
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
  readonly runtimeSources: Readonly<Record<string, DevtoolsRuntimeSource>>;
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
  readonly source?: DevtoolsRuntimeSource;
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
  runtimeSourceId?: string,
): DevtoolsRecord {
  if (event.kind === "event-observed") {
    return Object.freeze({
      runtimeId,
      ...(runtimeSourceId ? { runtimeSourceId } : {}),
      sequence: event.sequence,
      captureSequence,
      at: event.at,
      kind: event.kind,
      sourceType: event.event.type,
      ...(event.event.eventId ? { sourceEventId: event.event.eventId } : {}),
      ...("runId" in event.event ? { runId: event.event.runId } : {}),
      ...("runInstanceId" in event.event && event.event.runInstanceId
        ? { runInstanceId: event.event.runInstanceId }
        : {}),
      ...("nextRunInstanceId" in event.event && event.event.nextRunInstanceId
        ? { nextRunInstanceId: event.event.nextRunInstanceId }
        : {}),
      ...("parentRunId" in event.event && event.event.parentRunId
        ? { parentRunId: event.event.parentRunId }
        : {}),
      ...("stepId" in event.event && event.event.stepId
        ? { stepId: event.event.stepId }
        : {}),
      ...("stepInstanceId" in event.event && event.event.stepInstanceId
        ? { stepInstanceId: event.event.stepInstanceId }
        : {}),
      ...("nextStepInstanceId" in event.event && event.event.nextStepInstanceId
        ? { nextStepInstanceId: event.event.nextStepInstanceId }
        : {}),
      ...("parentStepId" in event.event && event.event.parentStepId
        ? { parentStepId: event.event.parentStepId }
        : {}),
      ...("parentToolId" in event.event && event.event.parentToolId
        ? { parentToolId: event.event.parentToolId }
        : {}),
      ...("parentResponseId" in event.event && event.event.parentResponseId
        ? { parentResponseId: event.event.parentResponseId }
        : {}),
      ...("responseId" in event.event
        ? { responseId: event.event.responseId }
        : {}),
      ...("responseInstanceId" in event.event && event.event.responseInstanceId
        ? { responseInstanceId: event.event.responseInstanceId }
        : {}),
      ...("nextResponseInstanceId" in event.event &&
      event.event.nextResponseInstanceId
        ? { nextResponseInstanceId: event.event.nextResponseInstanceId }
        : {}),
      ...("attempt" in event.event && event.event.attempt !== undefined
        ? { attempt: event.event.attempt }
        : {}),
      ...("toolId" in event.event ? { toolId: event.event.toolId } : {}),
      ...("toolInstanceId" in event.event && event.event.toolInstanceId
        ? { toolInstanceId: event.event.toolInstanceId }
        : {}),
      ...("interactionId" in event.event
        ? { interactionId: event.event.interactionId }
        : {}),
      ...("approvalId" in event.event
        ? { approvalId: event.event.approvalId }
        : {}),
      ...("progress" in event.event && event.event.progress !== undefined
        ? { progress: event.event.progress }
        : {}),
      ...("outcome" in event.event ? { outcome: event.event.outcome } : {}),
      ...("count" in event.event ? { count: event.event.count } : {}),
    });
  }
  return Object.freeze({
    runtimeId,
    ...(runtimeSourceId ? { runtimeSourceId } : {}),
    sequence: event.sequence,
    captureSequence,
    at: event.at,
    kind: event.kind,
    ...(event.decision.sourceType
      ? { sourceType: event.decision.sourceType }
      : {}),
    ...(event.decision.sourceEventId
      ? { sourceEventId: event.decision.sourceEventId }
      : {}),
    disposition: event.decision.disposition,
    reason: event.decision.reason,
    ...(event.decision.announcement
      ? { announcementId: event.decision.announcement.id }
      : {}),
    ...(event.decision.announcement
      ? { channel: event.decision.announcement.channel }
      : {}),
    ...(event.decision.responseId
      ? { responseId: event.decision.responseId }
      : {}),
    ...(event.decision.toolId ? { toolId: event.decision.toolId } : {}),
    ...(event.decision.interactionId
      ? { interactionId: event.decision.interactionId }
      : {}),
    ...(event.decision.runId ? { runId: event.decision.runId } : {}),
    ...(event.decision.runInstanceId
      ? { runInstanceId: event.decision.runInstanceId }
      : {}),
    ...(event.decision.stepId ? { stepId: event.decision.stepId } : {}),
    ...(event.decision.stepInstanceId
      ? { stepInstanceId: event.decision.stepInstanceId }
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

function copyRuntimeSource(
  source: DevtoolsRuntimeSource | undefined,
): DevtoolsRuntimeSource | undefined {
  if (source === undefined) return undefined;
  if (
    typeof source.adapter !== "string" ||
    !source.adapter.trim() ||
    source.adapter.length > 80
  )
    throw new TypeError("source adapter must be a non-empty string");
  if (!Array.isArray(source.evidence))
    throw new TypeError("source evidence must be an array");
  if (
    source.evidence.length > 12 ||
    source.evidence.some(
      (item) => typeof item !== "string" || !item.trim() || item.length > 120,
    )
  )
    throw new TypeError(
      "source evidence entries must be public strings up to 120 characters",
    );
  const { fidelity } = source;
  if (typeof fidelity !== "object" || fidelity === null)
    throw new TypeError("source fidelity must be an object");
  const lifecycleFidelity = new Set(["exact", "action-wrapper", "unavailable"]);
  const connectionFidelity = new Set([...lifecycleFidelity, "inferred"]);
  const workflowFidelity = new Set(["exact", "partial", "unavailable"]);
  for (const field of [
    "runs",
    "steps",
    "hierarchy",
    "tools",
    "interactions",
    "replay",
    "reconnection",
  ] as const) {
    if (!workflowFidelity.has(fidelity[field]))
      throw new TypeError(
        `source ${field} fidelity contains an unsupported value`,
      );
  }
  if (
    fidelity.customEvents !== "explicit-mapping" &&
    fidelity.customEvents !== "unsupported"
  )
    throw new TypeError(
      "source custom event fidelity contains an unsupported value",
    );
  if (!lifecycleFidelity.has(fidelity.interruption))
    throw new TypeError(
      "source interruption fidelity contains an unsupported value",
    );
  if (!lifecycleFidelity.has(fidelity.retries))
    throw new TypeError("source retry fidelity contains an unsupported value");
  if (!connectionFidelity.has(fidelity.connection))
    throw new TypeError(
      "source connection fidelity contains an unsupported value",
    );
  const optionalEvents = fidelity.optionalEvents;
  const validOptionalEvents = new Set([
    "tool.progress",
    "tool.failed",
    "citation.available",
    "interaction.requested",
  ]);
  if (
    optionalEvents !== undefined &&
    (!Array.isArray(optionalEvents) ||
      optionalEvents.some((event) => !validOptionalEvents.has(event)))
  )
    throw new TypeError("source optional events contain an unsupported value");
  return Object.freeze({
    adapter: source.adapter.trim(),
    evidence: Object.freeze(source.evidence.map((item) => item.trim())),
    fidelity: Object.freeze({
      runs: fidelity.runs,
      steps: fidelity.steps,
      hierarchy: fidelity.hierarchy,
      tools: fidelity.tools,
      interactions: fidelity.interactions,
      replay: fidelity.replay,
      reconnection: fidelity.reconnection,
      customEvents: fidelity.customEvents,
      interruption: fidelity.interruption,
      retries: fidelity.retries,
      connection: fidelity.connection,
      ...(optionalEvents
        ? { optionalEvents: Object.freeze([...optionalEvents]) }
        : {}),
    }),
  });
}

function asDeliveryRecord(
  input: DeliveryRecordInput,
  captureSequence: number,
  runtimeSourceId?: string,
): DevtoolsRecord {
  const { result } = input;
  return Object.freeze({
    runtimeId: input.runtimeId,
    ...(runtimeSourceId ? { runtimeSourceId } : {}),
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
    ...(result.runId ? { runId: result.runId } : {}),
    ...(result.runInstanceId ? { runInstanceId: result.runInstanceId } : {}),
    ...(result.stepId ? { stepId: result.stepId } : {}),
    ...(result.stepInstanceId ? { stepInstanceId: result.stepInstanceId } : {}),
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
      workflows: Object.freeze({ ...source.policy.workflows }),
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
    ...(source.runs
      ? {
          runs: Object.freeze(
            source.runs.map((item) => Object.freeze({ ...item })),
          ),
        }
      : {}),
    ...(source.steps
      ? {
          steps: Object.freeze(
            source.steps.map((item) => Object.freeze({ ...item })),
          ),
        }
      : {}),
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
      readonly source: DevtoolsRuntimeSource | undefined;
      readonly sourceId: string | undefined;
    }
  >();
  const runtimeSources = new Map<string, DevtoolsRuntimeSource>();
  const sourceRevisions = new Map<string, number>();
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
    const sources = Object.freeze(
      Object.fromEntries(
        [...runtimeSources.entries()]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([id, source]) => [id, source]),
      ),
    ) as Readonly<Record<string, DevtoolsRuntimeSource>>;
    cachedSnapshot = Object.freeze({
      paused,
      droppedCount,
      records: Object.freeze([...records]),
      runtimeIds: Object.freeze([...runtimes.keys()].sort()),
      runtimeSnapshots: snapshots,
      runtimeSources: sources,
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
  const pruneRuntimeSources = () => {
    const retained = new Set(
      records.flatMap((record) =>
        record.runtimeSourceId ? [record.runtimeSourceId] : [],
      ),
    );
    for (const attachment of runtimes.values())
      if (attachment.sourceId) retained.add(attachment.sourceId);
    for (const sourceId of runtimeSources.keys())
      if (!retained.has(sourceId)) runtimeSources.delete(sourceId);
  };
  const capture = (
    runtimeId: string,
    runtime: AttachRuntimeOptions["runtime"],
    runtimeSourceId: string | undefined,
    event: RuntimeDiagnosticEventV1,
  ) => {
    if (paused || disposed) return;
    appendRecord(
      asRecord(runtimeId, event, nextCaptureSequence++, runtimeSourceId),
    );
    pruneRuntimeSources();
    refreshRuntimeSnapshot(runtimeId, runtime);
    notify();
  };

  return {
    attachRuntime({ id, runtime, source }) {
      if (disposed)
        throw new Error("Cannot attach to a disposed devtools store");
      if (!id.trim()) throw new TypeError("runtime id must be non-empty");
      const copiedSource = copyRuntimeSource(source);
      let revision = (sourceRevisions.get(id) ?? 0) + 1;
      let sourceId = copiedSource
        ? revision === 1
          ? id
          : `${id}#${revision}`
        : undefined;
      while (sourceId && runtimeSources.has(sourceId)) {
        revision += 1;
        sourceId = `${id}#${revision}`;
      }
      let active = false;
      const unsubscribe = runtime.subscribeDiagnosticEvents((event) => {
        if (active) capture(id, runtime, sourceId, event);
      });
      const previous = runtimes.get(id);
      const attachment = {
        runtime,
        unsubscribe,
        source: copiedSource,
        sourceId,
      };
      active = true;
      previous?.unsubscribe();
      runtimes.set(id, attachment);
      if (copiedSource && sourceId) {
        runtimeSources.set(sourceId, copiedSource);
        sourceRevisions.set(id, revision);
      }
      refreshRuntimeSnapshot(id, runtime);
      pruneRuntimeSources();
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
        pruneRuntimeSources();
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
      appendRecord(
        asDeliveryRecord(
          input,
          nextCaptureSequence++,
          runtimes.get(input.runtimeId)?.sourceId,
        ),
      );
      pruneRuntimeSources();
      notify();
    },
    clear() {
      if (disposed) return;
      records.length = 0;
      droppedCount = 0;
      pruneRuntimeSources();
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
        runtimeSources: current.runtimeSources,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const { unsubscribe } of runtimes.values()) unsubscribe();
      runtimes.clear();
      runtimeSnapshots.clear();
      runtimeSources.clear();
      sourceRevisions.clear();
      records.length = 0;
      notify();
      listeners.clear();
    },
  };
}
