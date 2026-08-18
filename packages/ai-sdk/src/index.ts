import type {
  AdapterFidelity,
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import type { ChatOnErrorCallback, ChatOnFinishCallback, UIMessage } from "ai";

const DEFAULT_MAX_TRACKED_ENTITIES = 1_000;

export interface ChatAdapterMetadata {
  readonly name: "ai-sdk";
  readonly fidelity: Readonly<Omit<AdapterFidelity, "optionalEvents">> & {
    readonly optionalEvents: readonly NonNullable<
      AdapterFidelity["optionalEvents"]
    >[number][];
  };
  readonly observedSnapshotFields: readonly ["messages", "status", "error"];
  readonly terminalEvidence: readonly ["onFinish", "onError"];
  readonly saturation: "suppress-after-baseline-capacity";
}

/** Frozen evidence and fidelity declaration for the AI SDK adapter. */
export const CHAT_ADAPTER_METADATA: ChatAdapterMetadata = Object.freeze({
  name: "ai-sdk",
  fidelity: Object.freeze({
    interruption: "exact",
    retries: "unavailable",
    connection: "inferred",
    optionalEvents: Object.freeze([
      "tool.failed",
      "citation.available",
      "interaction.requested",
    ] as const),
  }),
  observedSnapshotFields: Object.freeze([
    "messages",
    "status",
    "error",
  ] as const),
  terminalEvidence: Object.freeze(["onFinish", "onError"] as const),
  saturation: "suppress-after-baseline-capacity",
});

export interface ChatSnapshot<UI_MESSAGE extends UIMessage = UIMessage> {
  readonly messages: UI_MESSAGE[];
  readonly status: "submitted" | "streaming" | "ready" | "error";
  readonly error: Error | undefined;
}

export interface ToolLabelContext {
  readonly toolCallId: string;
  readonly toolName: string;
  readonly title: string | undefined;
}

export interface CreateObserverOptions {
  readonly runtime: Pick<GenerativeA11yRuntime, "dispatch">;
  readonly scopeId: string;
  /** Positive cap for each response, tool, approval, and source identity set. */
  readonly maxTrackedEntities?: number;
  /** Maps tool identity to localized host copy. The default is deliberately generic. */
  readonly getToolLabel?: (context: ToolLabelContext) => string;
}

export interface ChatObserver {
  observe(snapshot: ChatSnapshot): void;
  finish(message: UIMessage, outcome: ChatFinishOutcome): void;
  failActiveResponse(): void;
  dispose(): void;
}

export interface ChatFinishOutcome {
  readonly isAbort: boolean;
  readonly isDisconnect: boolean;
  readonly isError: boolean;
}

export interface ComposeChatCallbacksOptions<
  UI_MESSAGE extends UIMessage = UIMessage,
> {
  readonly observer: ChatObserver;
  readonly onFinish?: ChatOnFinishCallback<UI_MESSAGE>;
  readonly onError?: ChatOnErrorCallback;
}

interface TextRecord {
  readonly value: string;
  readonly poisoned: boolean;
}

interface ResponseRecord {
  readonly responseId: string;
  readonly textByPart: Map<number, TextRecord>;
  active: boolean;
  terminal: boolean;
}

interface ToolPart {
  readonly type: string;
  readonly toolCallId: string;
  readonly toolName: string;
  readonly title?: string;
  readonly state: string;
  readonly approval?: { readonly id: string; readonly approved?: boolean };
}

interface ToolRecord {
  active: boolean;
  terminal: boolean;
  announced: boolean;
}

interface ApprovalRecord {
  readonly baselined: boolean;
  requested: boolean;
  resolved: boolean;
}

type MessagePart = UIMessage["parts"][number];

function scopedResponseId(scopeId: string, messageId: string): string {
  return `${scopeId}:message:${messageId}`;
}

function scopedToolId(scopeId: string, toolCallId: string): string {
  return `${scopeId}:tool:${toolCallId}`;
}

function scopedApprovalId(scopeId: string, id: string): string {
  return `${scopeId}:approval:${id}`;
}

function textFromPart(part: MessagePart): string | undefined {
  const candidate = part as unknown as { type?: unknown; text?: unknown };
  return candidate.type === "text" && typeof candidate.text === "string"
    ? candidate.text
    : undefined;
}

function toolFromPart(part: MessagePart): ToolPart | undefined {
  const candidate = part as unknown as {
    type?: unknown;
    toolCallId?: unknown;
    toolName?: unknown;
    title?: unknown;
    state?: unknown;
    approval?: { id?: unknown; approved?: unknown };
  };
  if (
    typeof candidate.type !== "string" ||
    typeof candidate.toolCallId !== "string" ||
    typeof candidate.state !== "string" ||
    (candidate.type !== "dynamic-tool" && !candidate.type.startsWith("tool-"))
  ) {
    return undefined;
  }
  const name =
    candidate.type === "dynamic-tool"
      ? candidate.toolName
      : candidate.type.slice("tool-".length);
  if (typeof name !== "string") return undefined;
  const approval = candidate.approval;
  const approvalValue =
    typeof approval?.id === "string"
      ? {
          id: approval.id,
          ...(typeof approval.approved === "boolean"
            ? { approved: approval.approved }
            : {}),
        }
      : undefined;
  return {
    type: candidate.type,
    toolCallId: candidate.toolCallId,
    toolName: name,
    state: candidate.state,
    ...(typeof candidate.title === "string" ? { title: candidate.title } : {}),
    ...(approvalValue ? { approval: approvalValue } : {}),
  };
}

function sourceIdFromPart(part: MessagePart): string | undefined {
  const candidate = part as unknown as { type?: unknown; sourceId?: unknown };
  return (candidate.type === "source-url" ||
    candidate.type === "source-document") &&
    typeof candidate.sourceId === "string"
    ? candidate.sourceId
    : undefined;
}

function isAssistantMessage(value: unknown): value is UIMessage {
  const candidate = value as {
    id?: unknown;
    role?: unknown;
    parts?: unknown;
  };
  return (
    typeof candidate?.id === "string" &&
    candidate.role === "assistant" &&
    Array.isArray(candidate.parts)
  );
}

function defaultToolLabel(): string {
  return "A tool";
}

/**
 * Creates a bounded, borrowed-runtime observer. The first valid snapshot
 * silently records history; it never interprets `ready` or `error` as a
 * response terminal state.
 */
export function createObserver(options: CreateObserverOptions): ChatObserver {
  if (
    typeof options.scopeId !== "string" ||
    options.scopeId.trim().length === 0
  ) {
    throw new TypeError("scopeId must be a non-empty string");
  }
  const maxTrackedEntities =
    options.maxTrackedEntities ?? DEFAULT_MAX_TRACKED_ENTITIES;
  if (!Number.isSafeInteger(maxTrackedEntities) || maxTrackedEntities <= 0) {
    throw new TypeError("maxTrackedEntities must be a positive safe integer");
  }
  const scopeId = options.scopeId.trim();
  const responses = new Map<string, ResponseRecord>();
  const tools = new Map<string, ToolRecord>();
  const approvals = new Map<string, ApprovalRecord>();
  const sourceIds = new Set<string>();
  let baselineComplete = false;
  let saturated = false;
  let disposed = false;
  let lastActiveResponseId: string | undefined;
  let connectionLost = false;

  function dispatch(event: GenerativeA11yEvent): void {
    if (disposed || saturated) return;
    try {
      options.runtime.dispatch(event);
    } catch {
      saturated = true;
    }
  }

  function labelFor(part: ToolPart): string | undefined {
    try {
      return (
        options.getToolLabel?.({
          toolCallId: part.toolCallId,
          toolName: part.toolName,
          title: part.title,
        }) ?? defaultToolLabel()
      );
    } catch {
      saturated = true;
      return undefined;
    }
  }

  function admitResponse(
    messageId: string,
    active: boolean,
  ): ResponseRecord | undefined {
    const existing = responses.get(messageId);
    if (existing) return existing;
    if (responses.size >= maxTrackedEntities) {
      saturated = true;
      return undefined;
    }
    const record: ResponseRecord = {
      responseId: scopedResponseId(scopeId, messageId),
      textByPart: new Map(),
      active,
      terminal: false,
    };
    responses.set(messageId, record);
    return record;
  }

  function activateResponse(record: ResponseRecord, messageId: string): void {
    if (record.active) return;
    record.active = true;
    lastActiveResponseId = messageId;
    dispatch({ type: "response.started", responseId: record.responseId });
  }

  function startResponse(messageId: string): ResponseRecord | undefined {
    const record = admitResponse(messageId, true);
    if (!record) return undefined;
    if (!record.active) activateResponse(record, messageId);
    else if (record.textByPart.size === 0 && !record.terminal) {
      lastActiveResponseId = messageId;
      dispatch({ type: "response.started", responseId: record.responseId });
    }
    return record;
  }

  function admitTool(
    id: string,
    baseline: boolean,
    state: string,
  ): ToolRecord | undefined {
    const existing = tools.get(id);
    if (existing) return existing;
    if (tools.size >= maxTrackedEntities) {
      saturated = true;
      return undefined;
    }
    const record: ToolRecord = {
      active:
        baseline &&
        (state === "input-streaming" || state === "input-available"),
      terminal:
        baseline && (state === "output-available" || state === "output-error"),
      announced: false,
    };
    tools.set(id, record);
    return record;
  }

  function admitApproval(
    id: string,
    baseline: boolean,
    state: string,
  ): ApprovalRecord | undefined {
    const existing = approvals.get(id);
    if (existing) return existing;
    if (approvals.size >= maxTrackedEntities) {
      saturated = true;
      return undefined;
    }
    const record: ApprovalRecord = {
      baselined: baseline,
      requested: false,
      resolved:
        baseline &&
        (state === "approval-responded" || state === "output-denied"),
    };
    approvals.set(id, record);
    return record;
  }

  function observeApproval(part: ToolPart, baseline: boolean): void {
    if (!part.approval) return;
    const id = scopedApprovalId(scopeId, part.approval.id);
    const record = admitApproval(id, baseline, part.state);
    if (!record || baseline || record.baselined) return;
    if (part.state === "approval-requested" && !record.requested) {
      const label = labelFor(part);
      if (!label) return;
      record.requested = true;
      dispatch({
        type: "approval.requested",
        approvalId: id,
        label,
      });
      return;
    }
    if (
      (part.state === "approval-responded" || part.state === "output-denied") &&
      record.requested &&
      !record.resolved
    ) {
      const label = labelFor(part);
      if (!label) return;
      record.resolved = true;
      dispatch({
        type: "approval.resolved",
        approvalId: id,
        outcome: part.approval.approved === true ? "approved" : "rejected",
        label,
      });
    }
  }

  function observeTool(part: ToolPart, baseline: boolean): void {
    const id = scopedToolId(scopeId, part.toolCallId);
    const record = admitTool(id, baseline, part.state);
    if (!record || baseline) {
      observeApproval(part, baseline);
      return;
    }
    if (part.state === "input-streaming" || part.state === "input-available") {
      if (!record.announced) {
        const label = labelFor(part);
        if (!label) return;
        record.announced = true;
        record.active = true;
        dispatch({ type: "tool.started", toolId: id, label });
      }
    } else if (
      (part.state === "output-available" || part.state === "output-error") &&
      record.active &&
      record.announced &&
      !record.terminal
    ) {
      const label = labelFor(part);
      if (!label) return;
      record.active = false;
      record.terminal = true;
      dispatch(
        part.state === "output-available"
          ? { type: "tool.completed", toolId: id, label }
          : { type: "tool.failed", toolId: id, label },
      );
    }
    observeApproval(part, baseline);
  }

  function observeSource(sourceId: string, baseline: boolean): void {
    if (sourceIds.has(sourceId)) return;
    if (sourceIds.size >= maxTrackedEntities) {
      saturated = true;
      return;
    }
    sourceIds.add(sourceId);
    if (!baseline)
      dispatch({ type: "citation.available", count: sourceIds.size });
  }

  function observeMessage(message: UIMessage, baseline: boolean): void {
    if (message.role !== "assistant") return;
    const record = baseline
      ? admitResponse(message.id, false)
      : (responses.get(message.id) ?? startResponse(message.id));
    if (!record || record.terminal) return;
    message.parts.forEach((part, partIndex) => {
      if (saturated) return;
      const text = textFromPart(part);
      if (text !== undefined) {
        const previous = record.textByPart.get(partIndex);
        if (!previous && record.textByPart.size >= maxTrackedEntities) {
          saturated = true;
          return;
        }
        if (baseline) {
          record.textByPart.set(partIndex, { value: text, poisoned: false });
        } else if (!previous) {
          activateResponse(record, message.id);
          record.textByPart.set(partIndex, { value: text, poisoned: false });
          if (text.length > 0)
            dispatch({
              type: "response.text.delta",
              responseId: record.responseId,
              delta: text,
            });
        } else if (!previous.poisoned && text.startsWith(previous.value)) {
          const suffix = text.slice(previous.value.length);
          if (suffix.length > 0) {
            activateResponse(record, message.id);
            dispatch({
              type: "response.text.delta",
              responseId: record.responseId,
              delta: suffix,
            });
          }
          record.textByPart.set(partIndex, { value: text, poisoned: false });
        } else if (!previous.poisoned) {
          record.textByPart.set(partIndex, {
            value: previous.value,
            poisoned: true,
          });
        }
        return;
      }
      const tool = toolFromPart(part);
      if (tool) observeTool(tool, baseline);
      const sourceId = sourceIdFromPart(part);
      if (sourceId) observeSource(sourceId, baseline);
    });
  }

  function finish(message: UIMessage, outcome: ChatFinishOutcome): void {
    if (disposed || saturated || message.role !== "assistant") return;
    const record = responses.get(message.id) ?? startResponse(message.id);
    if (!record || record.terminal || !record.active) return;
    if (outcome.isDisconnect) {
      if (!connectionLost) {
        connectionLost = true;
        dispatch({ type: "connection.lost" });
      }
      return;
    }
    record.terminal = true;
    record.active = false;
    if (lastActiveResponseId === message.id) lastActiveResponseId = undefined;
    if (outcome.isError) {
      dispatch({ type: "response.failed", responseId: record.responseId });
    } else if (outcome.isAbort) {
      dispatch({ type: "response.interrupted", responseId: record.responseId });
    } else {
      if (connectionLost) {
        connectionLost = false;
        dispatch({ type: "connection.restored" });
      }
      dispatch({ type: "response.completed", responseId: record.responseId });
    }
  }

  return {
    observe(snapshot) {
      if (
        disposed ||
        saturated ||
        !snapshot ||
        !Array.isArray((snapshot as { messages?: unknown }).messages)
      )
        return;
      const baseline = !baselineComplete;
      for (const message of snapshot.messages) {
        if (saturated) break;
        if (isAssistantMessage(message)) observeMessage(message, baseline);
      }
      baselineComplete = true;
    },
    finish,
    failActiveResponse() {
      if (disposed || saturated || !lastActiveResponseId) return;
      const record = responses.get(lastActiveResponseId);
      if (!record || record.terminal || !record.active) return;
      record.terminal = true;
      record.active = false;
      lastActiveResponseId = undefined;
      dispatch({ type: "response.failed", responseId: record.responseId });
    },
    dispose() {
      disposed = true;
      responses.clear();
      tools.clear();
      approvals.clear();
      sourceIds.clear();
      lastActiveResponseId = undefined;
    },
  };
}

/** Composes host callbacks with the exact public AI SDK terminal evidence. */
export function composeChatCallbacks<UI_MESSAGE extends UIMessage>(
  options: ComposeChatCallbacksOptions<UI_MESSAGE>,
): {
  onFinish: ChatOnFinishCallback<UI_MESSAGE>;
  onError: ChatOnErrorCallback;
} {
  return {
    onFinish(event) {
      try {
        options.observer.finish(event.message, event);
      } finally {
        options.onFinish?.(event);
      }
    },
    onError(error) {
      try {
        options.observer.failActiveResponse();
      } finally {
        options.onError?.(error);
      }
    },
  };
}
