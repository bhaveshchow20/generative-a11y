export type AnnouncementChannel = "polite" | "assertive";
export type TextStrategy = "silent" | "sentence" | "paragraph" | "completion";
export type PresetName = "minimal" | "balanced" | "verbose" | "completion-only";
export type InteractionKind =
  "approval" | "confirmation" | "input" | (string & {});

interface EventMetadata {
  eventId?: string;
  locale?: string;
}

/** Explicit workflow ownership supplied by a source integration. */
export interface WorkflowContext {
  /** Stable logical run identity. */
  runId?: string;
  /** Stable identity for one attempt of the logical run. */
  runInstanceId?: string;
  /** Stable logical step identity. Omit when the source exposes only a label. */
  stepId?: string;
  /** Stable identity for one attempt of the logical step. */
  stepInstanceId?: string;
}

type ContextualEventMetadata = EventMetadata & WorkflowContext;

export type GenerativeA11yEvent =
  | (ContextualEventMetadata & {
      type: "response.started";
      responseId: string;
      responseInstanceId?: string;
    })
  | (ContextualEventMetadata & {
      type: "response.text.delta";
      responseId: string;
      responseInstanceId?: string;
      delta: string;
    })
  | (ContextualEventMetadata & {
      type: "response.completed";
      responseId: string;
      responseInstanceId?: string;
    })
  | (ContextualEventMetadata & {
      type: "response.interrupted";
      responseId: string;
      responseInstanceId?: string;
    })
  | (ContextualEventMetadata & {
      type: "response.failed";
      responseId: string;
      responseInstanceId?: string;
      error?: string;
      announcement?: string;
    })
  | (ContextualEventMetadata & {
      type: "response.retrying";
      responseId: string;
      responseInstanceId?: string;
      nextResponseInstanceId?: string;
      attempt?: number;
    })
  | (ContextualEventMetadata & {
      type: "tool.started";
      toolId: string;
      toolInstanceId?: string;
      label: string;
    })
  | (ContextualEventMetadata & {
      type: "tool.progress";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      /** Normalized progress from 0 to 1. */
      progress?: number;
      message?: string;
    })
  | (ContextualEventMetadata & {
      type: "tool.completed";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      summary?: string;
    })
  | (ContextualEventMetadata & {
      type: "tool.failed";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      error?: string;
      announcement?: string;
    })
  | (ContextualEventMetadata & {
      type: "interaction.requested";
      interactionId: string;
      kind: InteractionKind;
      label: string;
      urgent?: boolean;
    })
  | (ContextualEventMetadata & {
      type: "interaction.resolved";
      interactionId: string;
      kind: InteractionKind;
      outcome: "approved" | "rejected" | "submitted" | "cancelled";
      label?: string;
    })
  | (ContextualEventMetadata & {
      type: "approval.requested";
      approvalId: string;
      label: string;
      urgent?: boolean;
    })
  | (ContextualEventMetadata & {
      type: "approval.resolved";
      approvalId: string;
      outcome: "approved" | "rejected" | "cancelled";
      label?: string;
    })
  | (EventMetadata & {
      type: "run.started";
      /** Stable logical run identity. */
      runId: string;
      /** Stable identity for this run attempt. */
      runInstanceId?: string;
      /** Stable logical parent run, when explicitly exposed. */
      parentRunId?: string;
      /** Attempt identity of the explicit parent run. */
      parentRunInstanceId?: string;
      /** Tool that delegated to this run. */
      parentToolId?: string;
      /** Response that owns this run. */
      parentResponseId?: string;
      /** Localized display copy; never used as identity. */
      label?: string;
    })
  | (EventMetadata & {
      type: "run.completed" | "run.interrupted" | "run.failed";
      /** Stable logical run identity. */
      runId: string;
      /** Stable identity for this run attempt. */
      runInstanceId?: string;
      /** Diagnostic-only backend detail; never announced automatically. */
      error?: string;
      /** Short localized user-safe terminal copy. */
      announcement?: string;
    })
  | (EventMetadata & {
      type: "run.retrying";
      /** Stable logical run identity. */
      runId: string;
      /** Attempt being replaced. */
      runInstanceId?: string;
      /** Stable identity of the replacement attempt. */
      nextRunInstanceId?: string;
      /** Human-readable one-based attempt number. */
      attempt?: number;
    })
  | (EventMetadata & {
      type: "step.started";
      /** Stable logical owner run identity. */
      runId: string;
      /** Stable owner run attempt identity. */
      runInstanceId?: string;
      /** Stable logical step identity; omit for name-only evidence. */
      stepId?: string;
      /** Stable identity for this step attempt. */
      stepInstanceId?: string;
      /** Stable logical parent step identity. */
      parentStepId?: string;
      /** Attempt identity of the explicit parent step. */
      parentStepInstanceId?: string;
      /** Localized display copy; never used as identity. */
      label: string;
    })
  | (EventMetadata & {
      type: "step.progress";
      /** Stable logical owner run identity. */
      runId: string;
      /** Stable owner run attempt identity. */
      runInstanceId?: string;
      /** Stable logical step identity; omit for name-only evidence. */
      stepId?: string;
      /** Stable identity for this step attempt. */
      stepInstanceId?: string;
      /** Localized display copy; never used as identity. */
      label: string;
      /** Normalized progress from 0 to 1. */
      progress?: number;
      /** Optional localized user-safe progress copy. */
      message?: string;
    })
  | (EventMetadata & {
      type: "step.completed" | "step.interrupted" | "step.failed";
      /** Stable logical owner run identity. */
      runId: string;
      /** Stable owner run attempt identity. */
      runInstanceId?: string;
      /** Stable logical step identity; omit for name-only evidence. */
      stepId?: string;
      /** Stable identity for this step attempt. */
      stepInstanceId?: string;
      /** Localized display copy; never used as identity. */
      label: string;
      /** Diagnostic-only backend detail; never announced automatically. */
      error?: string;
      /** Short localized user-safe terminal copy. */
      announcement?: string;
    })
  | (EventMetadata & {
      type: "step.retrying";
      /** Stable logical owner run identity. */
      runId: string;
      /** Stable owner run attempt identity. */
      runInstanceId?: string;
      /** Stable logical step identity; omit for name-only evidence. */
      stepId?: string;
      /** Attempt being replaced. */
      stepInstanceId?: string;
      /** Stable identity of the replacement attempt. */
      nextStepInstanceId?: string;
      /** Human-readable one-based attempt number. */
      attempt?: number;
      /** Localized display copy; never used as identity. */
      label: string;
    })
  | (EventMetadata & { type: "connection.lost"; label?: string })
  | (EventMetadata & { type: "connection.restored"; label?: string })
  | (EventMetadata & { type: "citation.available"; count: number });

export interface AnnouncementIntent {
  id: string;
  at: number;
  channel: AnnouncementChannel;
  text: string;
  sourceType: GenerativeA11yEvent["type"];
  sourceEventId?: string;
  responseId?: string;
  toolId?: string;
  interactionId?: string;
  /** Stable logical run identity associated with this intent. */
  runId?: string;
  /** Stable run attempt identity associated with this intent. */
  runInstanceId?: string;
  /** Stable logical step identity associated with this intent. */
  stepId?: string;
  /** Stable step attempt identity associated with this intent. */
  stepInstanceId?: string;
  locale?: string;
}

export type DiagnosticDisposition =
  "queued" | "merged" | "suppressed" | "cancelled" | "announced";

export type DiagnosticReason =
  | "scheduled"
  | "coalesced"
  | "duplicate"
  | "policy-silent"
  | "unknown-response"
  | "terminal-response"
  | "stale-response"
  | "empty-text"
  | "scope-cancelled"
  | "runtime-disposed"
  | "queue-capacity"
  | "delivery-error"
  | "unknown-tool"
  | "terminal-tool"
  | "stale-tool"
  | "unknown-run"
  | "terminal-run"
  | "stale-run"
  | "unknown-step"
  | "terminal-step"
  | "stale-step"
  | "unknown-parent"
  | "open-children"
  | "partial-identity"
  | "invalid-event"
  | "progress-threshold"
  | "delivered";

export interface AnnouncementDiagnostic {
  at: number;
  disposition: DiagnosticDisposition;
  reason: DiagnosticReason;
  /** Number of suppressed decisions or events represented by an aggregate. */
  count?: number;
  announcement?: AnnouncementIntent;
  sourceType?: GenerativeA11yEvent["type"];
  sourceEventId?: string;
  responseId?: string;
  toolId?: string;
  interactionId?: string;
  /** Stable logical run identity associated with this decision. */
  runId?: string;
  /** Stable run attempt identity associated with this decision. */
  runInstanceId?: string;
  /** Stable logical step identity associated with this decision. */
  stepId?: string;
  /** Stable step attempt identity associated with this decision. */
  stepInstanceId?: string;
  scheduledAt?: number;
  dueAt?: number;
  delayMs?: number;
  queueSequence?: number;
}

/** A content-free queued announcement projection for diagnostic consumers. */
export interface DiagnosticPendingAnnouncement {
  id: string;
  channel: AnnouncementChannel;
  sourceType: GenerativeA11yEvent["type"];
  sourceEventId?: string;
  responseId?: string;
  toolId?: string;
  interactionId?: string;
  /** Stable logical run identity associated with this queued intent. */
  runId?: string;
  /** Stable run attempt identity associated with this queued intent. */
  runInstanceId?: string;
  /** Stable logical step identity associated with this queued intent. */
  stepId?: string;
  /** Stable step attempt identity associated with this queued intent. */
  stepInstanceId?: string;
  locale?: string;
  scheduledAt: number;
  dueAt: number;
  delayMs: number;
  sequence: number;
}

export interface DiagnosticResponseSnapshot {
  responseId: string;
  epoch: number;
  instanceId?: string;
  status: "active" | "completed" | "interrupted" | "failed";
  locale?: string;
}

export interface DiagnosticToolSnapshot {
  toolId: string;
  instanceId?: string;
  status: "active" | "completed" | "failed";
  locale?: string;
  lastProgressBucket: number;
}

/** Content-free immutable projection of one tracked run attempt. */
export interface DiagnosticRunSnapshot {
  /** Stable logical run identity. */
  runId: string;
  /** Stable attempt identity when supplied by the source. */
  instanceId?: string;
  /** Stable logical parent run identity. */
  parentRunId?: string;
  /** Parent attempt identity when supplied by the source. */
  parentRunInstanceId?: string;
  /** Tool that delegated to this run, when explicitly exposed. */
  parentToolId?: string;
  /** Response that owns this run, when explicitly exposed. */
  parentResponseId?: string;
  /** Current lifecycle state for this run attempt. */
  status: "active" | "completed" | "interrupted" | "failed";
  /** Number of identified steps completed in this attempt. */
  completedSteps: number;
  /** Number of identified steps failed in this attempt. */
  failedSteps: number;
}

/** Content-free immutable projection of one identified step attempt. */
export interface DiagnosticStepSnapshot {
  /** Stable logical owner run identity. */
  runId: string;
  /** Owner run attempt identity when supplied by the source. */
  runInstanceId?: string;
  /** Stable logical step identity. */
  stepId: string;
  /** Stable step attempt identity when supplied by the source. */
  instanceId?: string;
  /** Stable logical parent step identity. */
  parentStepId?: string;
  /** Parent step attempt identity when supplied by the source. */
  parentStepInstanceId?: string;
  /** Current lifecycle state for this step attempt. */
  status: "active" | "completed" | "interrupted" | "failed";
  /** Injected-clock timestamp when this attempt started. */
  startedAt: number;
  /** Last coalesced progress bucket, or -1 before progress. */
  lastProgressBucket: number;
}

export interface RuntimeDiagnosticSnapshotV1 {
  schemaVersion: 1;
  at: number;
  policy: ReadonlyAnnouncementPolicy;
  pending: {
    announcements: readonly DiagnosticPendingAnnouncement[];
    flushes: readonly { responseId: string; epoch: number; dueAt: number }[];
  };
  responses: readonly DiagnosticResponseSnapshot[];
  tools: readonly DiagnosticToolSnapshot[];
  /** Present when the runtime supports hierarchical workflow diagnostics. */
  runs?: readonly DiagnosticRunSnapshot[];
  /** Present when the runtime supports identified step diagnostics. */
  steps?: readonly DiagnosticStepSnapshot[];
  pendingCount: number;
}

export type RuntimeDiagnosticEventV1 =
  | {
      schemaVersion: 1;
      sequence: number;
      at: number;
      kind: "event-observed";
      event: GenerativeA11yEvent;
    }
  | {
      schemaVersion: 1;
      sequence: number;
      at: number;
      kind: "decision";
      decision: AnnouncementDiagnostic;
    };

export interface TextPolicy {
  strategy: TextStrategy;
  minimumCharacters: number;
  maximumDelayMs: number;
}

export interface ToolPolicy {
  announceStart: boolean;
  announceStartAfterMs: number;
  announceProgress: boolean;
  progressEveryPercent: number;
  announceCompletion: boolean;
  announceFailure: boolean;
}

/** Announcement controls for hierarchical run and step lifecycle. */
export interface WorkflowPolicy {
  /** Run boundary verbosity. */
  runs: "silent" | "terminal" | "all";
  /** Identified step boundary verbosity. */
  steps: "silent" | "long-running" | "all";
  /** Delay and duration threshold for long-running step announcements. */
  announceStepAfterMs: number;
  /** Whether explicit step progress may be coalesced and announced. */
  announceProgress: boolean;
  /** Whether identified nested steps may produce announcements. */
  announceNestedSteps: boolean;
}

export interface AnnouncementPolicy {
  text: TextPolicy;
  tools: ToolPolicy;
  workflows: WorkflowPolicy;
  announceResponseStarted: boolean;
  announceResponseCompleted: boolean;
  announceInterruption: boolean;
  announceRetry: boolean;
  announceInteractions: boolean;
  announceConnections: boolean;
  announceCitations: boolean;
  errorChannel: AnnouncementChannel;
  minimumGapMs: number;
  dedupeWindowMs: number;
  maxQueueSize: number;
  maxActiveEntities: number;
}

export type ReadonlyAnnouncementPolicy = Readonly<
  Omit<AnnouncementPolicy, "text" | "tools" | "workflows"> & {
    text: Readonly<TextPolicy>;
    tools: Readonly<ToolPolicy>;
    workflows: Readonly<WorkflowPolicy>;
  }
>;

export interface AdapterFidelity {
  interruption: "exact" | "action-wrapper" | "unavailable";
  retries: "exact" | "action-wrapper" | "unavailable";
  connection: "exact" | "inferred" | "unavailable";
  optionalEvents?: Array<
    | "tool.progress"
    | "tool.failed"
    | "citation.available"
    | "interaction.requested"
  >;
}
