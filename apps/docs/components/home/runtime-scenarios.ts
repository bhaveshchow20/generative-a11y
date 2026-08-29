export interface RuntimeTraceEvent {
  readonly id: string;
  readonly type: string;
  readonly detail: string;
  readonly terminal?: true;
}

export interface RuntimeScenario {
  readonly id: "streaming" | "tool" | "approval" | "retry";
  readonly label: string;
  readonly summary: string;
  readonly evidence: string;
  readonly events: readonly RuntimeTraceEvent[];
}

export const runtimeScenarios = [
  {
    id: "streaming",
    label: "Streaming",
    summary: "A response delivers two useful segments before confirmed completion.",
    evidence: "The trace is deterministic. It demonstrates event handling, not screen-reader output.",
    events: [
      { id: "s-1", type: "response.started", detail: "responseId: answer-17" },
      { id: "s-2", type: "response.text.delta", detail: "delta: First complete sentence." },
      { id: "s-3", type: "response.text.delta", detail: "delta: Second complete sentence." },
      { id: "s-4", type: "response.completed", detail: "responseId: answer-17", terminal: true },
    ],
  },
  {
    id: "tool",
    label: "Tool execution",
    summary: "Confirmed tool state becomes bounded, user-relevant milestones.",
    evidence: "No progress is inferred between values supplied by the host application.",
    events: [
      { id: "t-1", type: "tool.started", detail: "label: Prepare report" },
      { id: "t-2", type: "tool.progress", detail: "progress: 0.5" },
      { id: "t-3", type: "tool.progress", detail: "progress: 0.9" },
      { id: "t-4", type: "tool.completed", detail: "summary: Report prepared", terminal: true },
    ],
  },
  {
    id: "approval",
    label: "Approval",
    summary: "An explicit request and its resolution share one stable identity.",
    evidence: "Approval is represented only when the integration exposes reliable evidence.",
    events: [
      { id: "a-1", type: "tool.started", detail: "label: Publish changes" },
      { id: "a-2", type: "approval.requested", detail: "approvalId: publish-4" },
      { id: "a-3", type: "approval.resolved", detail: "outcome: approved" },
      { id: "a-4", type: "tool.completed", detail: "label: Publish changes", terminal: true },
    ],
  },
  {
    id: "retry",
    label: "Failure / retry",
    summary: "Failure and a confirmed retry remain distinct lifecycle events.",
    evidence: "A retry is never guessed from a repeated render or a generic ready state.",
    events: [
      { id: "r-1", type: "response.started", detail: "instance: attempt-1" },
      { id: "r-2", type: "response.failed", detail: "error: Connection lost" },
      { id: "r-3", type: "response.retrying", detail: "attempt: 2" },
      { id: "r-4", type: "response.completed", detail: "instance: attempt-2", terminal: true },
    ],
  },
] as const satisfies readonly RuntimeScenario[];
