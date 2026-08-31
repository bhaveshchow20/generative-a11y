import type {
  AdapterFidelity,
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import type { ThreadRuntime } from "@assistant-ui/core";

export interface ThreadAdapterMetadata {
  readonly name: "assistant-ui";
  readonly fidelity: Readonly<Omit<AdapterFidelity, "optionalEvents">> & {
    readonly optionalEvents: readonly NonNullable<
      AdapterFidelity["optionalEvents"]
    >[number][];
  };
  readonly observedRuntimeMethods: readonly ["getState", "subscribe"];
}

/** Frozen public-evidence declaration for the assistant-ui adapter. */
export const THREAD_ADAPTER_METADATA: ThreadAdapterMetadata = Object.freeze({
  name: "assistant-ui",
  fidelity: Object.freeze({
    runs: "unavailable",
    steps: "unavailable",
    hierarchy: "unavailable",
    tools: "exact",
    interactions: "unavailable",
    replay: "partial",
    reconnection: "unavailable",
    customEvents: "unsupported",
    interruption: "exact",
    retries: "unavailable",
    connection: "unavailable",
    optionalEvents: Object.freeze([
      "tool.failed",
      "citation.available",
    ] as const),
  }),
  observedRuntimeMethods: Object.freeze(["getState", "subscribe"] as const),
});

export type ThreadRuntimeSource = Pick<ThreadRuntime, "getState" | "subscribe">;
export interface BindThreadRuntimeOptions {
  readonly runtime: Pick<GenerativeA11yRuntime, "dispatch">;
  readonly scopeId: string;
  readonly thread: ThreadRuntimeSource;
  readonly maxTrackedEntities?: number;
}
export interface ThreadBinding {
  dispose(): void;
}

type Assistant = {
  readonly id: string;
  readonly role: "assistant";
  readonly content: readonly unknown[];
  readonly status: unknown;
};
type Record = {
  text: Map<number, string>;
  poisoned: Set<number>;
  terminal: boolean;
  active: boolean;
};
type Tool = { terminal: boolean };
type Approval = { requested: boolean; resolved: boolean };
const responseId = (scope: string, id: string) => `${scope}:message:${id}`;

function assistant(value: unknown): value is Assistant {
  const v = value as {
    id?: unknown;
    role?: unknown;
    content?: unknown;
    status?: unknown;
  };
  return (
    typeof v?.id === "string" &&
    v.role === "assistant" &&
    Array.isArray(v.content) &&
    v.status !== undefined
  );
}
function text(part: unknown): string | undefined {
  const v = part as { type?: unknown; text?: unknown };
  return v?.type === "text" && typeof v.text === "string" ? v.text : undefined;
}
function tool(part: unknown):
  | {
      id: string;
      hasResult: boolean;
      failed: boolean;
      approval?: { id: string; approved?: boolean };
    }
  | undefined {
  const v = part as {
    type?: unknown;
    toolCallId?: unknown;
    result?: unknown;
    isError?: unknown;
    approval?: { id?: unknown; approved?: unknown };
  };
  if (v?.type !== "tool-call" || typeof v.toolCallId !== "string")
    return undefined;
  const approval =
    typeof v.approval?.id === "string"
      ? {
          id: v.approval.id,
          ...(typeof v.approval.approved === "boolean"
            ? { approved: v.approval.approved }
            : {}),
        }
      : undefined;
  return {
    id: v.toolCallId,
    hasResult: "result" in v && v.result !== undefined,
    failed: v.isError === true,
    ...(approval ? { approval } : {}),
  };
}
function source(part: unknown): string | undefined {
  const v = part as { type?: unknown; id?: unknown };
  return v?.type === "source" && typeof v.id === "string" ? v.id : undefined;
}
function terminal(
  status: unknown,
): "completed" | "interrupted" | "failed" | undefined {
  const s = status as { type?: unknown; reason?: unknown };
  if (s?.type === "complete" && (s.reason === "stop" || s.reason === "unknown"))
    return "completed";
  if (s?.type === "incomplete" && s.reason === "cancelled")
    return "interrupted";
  if (s?.type === "incomplete" && s.reason === "error") return "failed";
  return undefined;
}

/**
 * Subscribes to the documented public assistant-ui thread runtime. It only
 * reads snapshots; disposing the returned binding never disposes either host runtime.
 */
export function bindThreadRuntime(
  options: BindThreadRuntimeOptions,
): ThreadBinding {
  if (typeof options.scopeId !== "string" || options.scopeId.trim() === "")
    throw new TypeError("scopeId must be a non-empty string");
  const maxTrackedEntities = options.maxTrackedEntities ?? 1_000;
  if (!Number.isSafeInteger(maxTrackedEntities) || maxTrackedEntities <= 0)
    throw new TypeError("maxTrackedEntities must be a positive safe integer");
  const scopeId = options.scopeId.trim();
  const records = new Map<string, Record>();
  const tools = new Map<string, Tool>();
  const approvals = new Map<string, Approval>();
  const sources = new Set<string>();
  let baseline = false;
  let disposed = false;
  let saturated = false;
  const dispatch = (event: GenerativeA11yEvent) => {
    if (!disposed && !saturated) {
      try {
        options.runtime.dispatch(event);
      } catch {
        /* host delivery is isolated */
      }
    }
  };
  const observe = () => {
    if (disposed || saturated) return;
    const messages = options.thread.getState().messages;
    for (const value of messages) {
      if (!assistant(value)) continue;
      let record = records.get(value.id);
      const historical = !baseline;
      if (!record) {
        if (records.size >= maxTrackedEntities) {
          saturated = true;
          return;
        }
        record = {
          text: new Map(),
          poisoned: new Set(),
          terminal: false,
          active: false,
        };
        records.set(value.id, record);
        if (!historical) {
          record.active = true;
          dispatch({
            type: "response.started",
            responseId: responseId(scopeId, value.id),
          });
        }
      }
      value.content.forEach((part, index) => {
        const nextTool = tool(part);
        if (nextTool) {
          let observed = tools.get(nextTool.id);
          if (!observed) {
            if (tools.size >= maxTrackedEntities) {
              saturated = true;
              return;
            }
            observed = { terminal: historical && nextTool.hasResult };
            tools.set(nextTool.id, observed);
            if (!historical)
              dispatch({
                type: "tool.started",
                toolId: `${scopeId}:tool:${nextTool.id}`,
                label: "A tool",
              });
          }
          if (!historical && nextTool.hasResult && !observed.terminal) {
            observed.terminal = true;
            dispatch(
              nextTool.failed
                ? {
                    type: "tool.failed",
                    toolId: `${scopeId}:tool:${nextTool.id}`,
                    label: "A tool",
                  }
                : {
                    type: "tool.completed",
                    toolId: `${scopeId}:tool:${nextTool.id}`,
                    label: "A tool",
                  },
            );
          }
          if (nextTool.approval) {
            let observedApproval = approvals.get(nextTool.approval.id);
            if (!observedApproval) {
              if (approvals.size >= maxTrackedEntities) {
                saturated = true;
                return;
              }
              observedApproval = {
                requested: false,
                resolved:
                  historical && typeof nextTool.approval.approved === "boolean",
              };
              approvals.set(nextTool.approval.id, observedApproval);
              if (!historical && nextTool.approval.approved === undefined) {
                observedApproval.requested = true;
                dispatch({
                  type: "approval.requested",
                  approvalId: `${scopeId}:approval:${nextTool.approval.id}`,
                  label: "A tool",
                });
              }
            } else if (
              !historical &&
              observedApproval.requested &&
              !observedApproval.resolved &&
              typeof nextTool.approval.approved === "boolean"
            ) {
              observedApproval.resolved = true;
              dispatch({
                type: "approval.resolved",
                approvalId: `${scopeId}:approval:${nextTool.approval.id}`,
                outcome: nextTool.approval.approved ? "approved" : "rejected",
                label: "A tool",
              });
            }
          }
        }
        const sourceId = source(part);
        if (sourceId && !sources.has(sourceId)) {
          if (sources.size >= maxTrackedEntities) {
            saturated = true;
            return;
          }
          sources.add(sourceId);
          if (!historical)
            dispatch({ type: "citation.available", count: sources.size });
        }
        const next = text(part);
        if (next === undefined || record!.poisoned.has(index)) return;
        const previous = record!.text.get(index);
        if (previous === undefined) {
          if (record!.text.size >= maxTrackedEntities) {
            saturated = true;
            return;
          }
          record!.text.set(index, next);
          if (!historical && next)
            dispatch({
              type: "response.text.delta",
              responseId: responseId(scopeId, value.id),
              delta: next,
            });
          return;
        }
        if (!next.startsWith(previous)) {
          record!.poisoned.add(index);
          return;
        }
        const delta = next.slice(previous.length);
        record!.text.set(index, next);
        if (delta) {
          if (!record!.active) {
            record!.active = true;
            dispatch({
              type: "response.started",
              responseId: responseId(scopeId, value.id),
            });
          }
          dispatch({
            type: "response.text.delta",
            responseId: responseId(scopeId, value.id),
            delta,
          });
        }
      });
      const outcome = terminal(value.status);
      if (!historical && outcome && !record.terminal && record.active) {
        record.terminal = true;
        dispatch({
          type: `response.${outcome}` as GenerativeA11yEvent["type"],
          responseId: responseId(scopeId, value.id),
        } as GenerativeA11yEvent);
      }
    }
    baseline = true;
  };
  observe();
  const unsubscribe = options.thread.subscribe(observe);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      records.clear();
      tools.clear();
      approvals.clear();
      sources.clear();
    },
  };
}
