export type AnnouncementChannel = "polite" | "assertive";
export type TextStrategy = "silent" | "sentence" | "paragraph" | "completion";
export type PresetName = "minimal" | "balanced" | "verbose" | "completion-only";
export type InteractionKind =
  "approval" | "confirmation" | "input" | (string & {});

interface EventMetadata {
  eventId?: string;
  locale?: string;
}

export type GenerativeA11yEvent =
  | (EventMetadata & {
      type: "response.started";
      responseId: string;
      responseInstanceId?: string;
    })
  | (EventMetadata & {
      type: "response.text.delta";
      responseId: string;
      responseInstanceId?: string;
      delta: string;
    })
  | (EventMetadata & {
      type: "response.completed";
      responseId: string;
      responseInstanceId?: string;
    })
  | (EventMetadata & {
      type: "response.interrupted";
      responseId: string;
      responseInstanceId?: string;
    })
  | (EventMetadata & {
      type: "response.failed";
      responseId: string;
      responseInstanceId?: string;
      error?: string;
      announcement?: string;
    })
  | (EventMetadata & {
      type: "response.retrying";
      responseId: string;
      responseInstanceId?: string;
      nextResponseInstanceId?: string;
      attempt?: number;
    })
  | (EventMetadata & {
      type: "tool.started";
      toolId: string;
      toolInstanceId?: string;
      label: string;
    })
  | (EventMetadata & {
      type: "tool.progress";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      /** Normalized progress from 0 to 1. */
      progress?: number;
      message?: string;
    })
  | (EventMetadata & {
      type: "tool.completed";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      summary?: string;
    })
  | (EventMetadata & {
      type: "tool.failed";
      toolId: string;
      toolInstanceId?: string;
      label: string;
      error?: string;
      announcement?: string;
    })
  | (EventMetadata & {
      type: "interaction.requested";
      interactionId: string;
      kind: InteractionKind;
      label: string;
      urgent?: boolean;
    })
  | (EventMetadata & {
      type: "interaction.resolved";
      interactionId: string;
      kind: InteractionKind;
      outcome: "approved" | "rejected" | "submitted" | "cancelled";
      label?: string;
    })
  | (EventMetadata & {
      type: "approval.requested";
      approvalId: string;
      label: string;
      urgent?: boolean;
    })
  | (EventMetadata & {
      type: "approval.resolved";
      approvalId: string;
      outcome: "approved" | "rejected" | "cancelled";
      label?: string;
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
  | "invalid-event"
  | "progress-threshold"
  | "delivered";

export interface AnnouncementDiagnostic {
  at: number;
  disposition: DiagnosticDisposition;
  reason: DiagnosticReason;
  /** Number of events represented when capacity diagnostics are aggregated. */
  count?: number;
  announcement?: AnnouncementIntent;
  sourceType?: GenerativeA11yEvent["type"];
  sourceEventId?: string;
  responseId?: string;
  toolId?: string;
}

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

export interface AnnouncementPolicy {
  text: TextPolicy;
  tools: ToolPolicy;
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
  Omit<AnnouncementPolicy, "text" | "tools"> & {
    text: Readonly<TextPolicy>;
    tools: Readonly<ToolPolicy>;
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
