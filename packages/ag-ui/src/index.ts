import type {
  AdapterFidelity,
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import type { AbstractAgent, AgentSubscriber } from "@ag-ui/client";

export interface AgentAdapterMetadata {
  readonly name: "ag-ui";
  readonly fidelity: Readonly<Omit<AdapterFidelity, "optionalEvents">> & {
    readonly optionalEvents: readonly NonNullable<
      AdapterFidelity["optionalEvents"]
    >[number][];
  };
  readonly observation: "agent.subscribe(AgentSubscriber)";
  readonly saturation: "suppress-after-capacity";
}

/** Frozen public-evidence declaration for AG-UI protocol subscriptions. */
export const AGENT_ADAPTER_METADATA: AgentAdapterMetadata = Object.freeze({
  name: "ag-ui",
  fidelity: Object.freeze({
    runs: "exact",
    steps: "partial",
    hierarchy: "partial",
    tools: "exact",
    interactions: "exact",
    replay: "partial",
    reconnection: "partial",
    customEvents: "unsupported",
    interruption: "exact",
    retries: "unavailable",
    connection: "unavailable",
    optionalEvents: Object.freeze(["interaction.requested"] as const),
  }),
  observation: "agent.subscribe(AgentSubscriber)",
  saturation: "suppress-after-capacity",
});

export type AgentSource = Pick<AbstractAgent, "subscribe">;
export interface BindAgentOptions {
  readonly runtime: Pick<GenerativeA11yRuntime, "dispatch">;
  readonly scopeId: string;
  readonly agent: AgentSource;
  readonly maxTrackedEntities?: number;
}
export interface AgentBinding {
  dispose(): void;
}
type Response = { terminal: boolean; runId?: string };
type Tool = { terminal: boolean; runId?: string };
type Run = { terminal: boolean };
const responseId = (scopeId: string, id: string) => `${scopeId}:message:${id}`;
const toolId = (scopeId: string, id: string) => `${scopeId}:tool:${id}`;
const runId = (scopeId: string, id: string) => `${scopeId}:run:${id}`;
const interactionId = (scopeId: string, id: string) =>
  `${scopeId}:interrupt:${id}`;

/**
 * Subscribes through AG-UI's documented AgentSubscriber callbacks. It does not
 * subscribe to the replay-prone protocol observable or own agent/core lifetimes.
 */
export function bindAgent(options: BindAgentOptions): AgentBinding {
  if (typeof options.scopeId !== "string" || options.scopeId.trim() === "")
    throw new TypeError("scopeId must be a non-empty string");
  const maxTrackedEntities = options.maxTrackedEntities ?? 1_000;
  if (!Number.isSafeInteger(maxTrackedEntities) || maxTrackedEntities <= 0)
    throw new TypeError("maxTrackedEntities must be a positive safe integer");
  const scopeId = options.scopeId.trim();
  const responses = new Map<string, Response>();
  const tools = new Map<string, Tool>();
  const runs = new Map<string, Run>();
  const interactions = new Map<string, string | null>();
  const resolvedInteractions = new Set<string>();
  let disposed = false;
  let saturated = false;
  const dispatch = (event: GenerativeA11yEvent) => {
    if (disposed || saturated) return;
    try {
      options.runtime.dispatch(event);
    } catch {
      // A host delivery failure must not interrupt the agent subscription.
    }
  };
  const admit = <T>(map: Map<string, T> | Set<string>, id: string) => {
    if (map.has(id)) return true;
    if (map.size >= maxTrackedEntities) {
      saturated = true;
      return false;
    }
    return true;
  };
  const contextualRunId = (inputRunId?: string, subagentRunId?: string) => {
    const id = subagentRunId ?? inputRunId;
    return id ? runId(scopeId, id) : undefined;
  };
  const subscriber: AgentSubscriber = {
    onRunInitialized({ input }) {
      for (const resume of input.resume ?? []) {
        if (
          !interactions.has(resume.interruptId) ||
          resolvedInteractions.has(resume.interruptId)
        )
          continue;
        resolvedInteractions.add(resume.interruptId);
        const ownerRunId = interactions.get(resume.interruptId);
        dispatch({
          type: "interaction.resolved",
          interactionId: interactionId(scopeId, resume.interruptId),
          kind: "input",
          outcome: resume.status === "resolved" ? "submitted" : "cancelled",
          label: "Input is needed",
          ...(ownerRunId ? { runId: ownerRunId } : {}),
        });
      }
    },
    onRunStartedEvent({ event }) {
      if (!admit(runs, event.runId) || runs.has(event.runId)) return;
      runs.set(event.runId, { terminal: false });
      dispatch({ type: "run.started", runId: runId(scopeId, event.runId) });
    },
    onSubagentStartedEvent({ event, input }) {
      if (!admit(runs, event.subagentRunId) || runs.has(event.subagentRunId))
        return;
      runs.set(event.subagentRunId, { terminal: false });
      dispatch({
        type: "run.started",
        runId: runId(scopeId, event.subagentRunId),
        parentRunId: runId(scopeId, event.parentSubagentRunId ?? input.runId),
        ...(event.parentToolCallId
          ? { parentToolId: toolId(scopeId, event.parentToolCallId) }
          : {}),
        ...(event.parentMessageId
          ? { parentResponseId: responseId(scopeId, event.parentMessageId) }
          : {}),
        label: event.name,
      });
    },
    onSubagentFinishedEvent({ event }) {
      const run = runs.get(event.subagentRunId);
      if (!run || run.terminal) return;
      run.terminal = true;
      dispatch({
        type:
          event.outcome?.type === "suspended"
            ? "run.interrupted"
            : "run.completed",
        runId: runId(scopeId, event.subagentRunId),
      });
    },
    onSubagentErrorEvent({ event }) {
      const run = runs.get(event.subagentRunId);
      if (!run || run.terminal) return;
      run.terminal = true;
      dispatch({
        type: "run.failed",
        runId: runId(scopeId, event.subagentRunId),
      });
    },
    onStepStartedEvent({ event, input }) {
      dispatch({
        type: "step.started",
        runId: contextualRunId(input.runId, event.subagentRunId)!,
        label: event.stepName,
      });
    },
    onStepFinishedEvent({ event, input }) {
      dispatch({
        type: "step.completed",
        runId: contextualRunId(input.runId, event.subagentRunId)!,
        label: event.stepName,
      });
    },
    onTextMessageStartEvent({ event, input }) {
      if (event.role !== "assistant" || disposed || saturated) return;
      if (!admit(responses, event.messageId)) return;
      if (responses.has(event.messageId)) return;
      const ownerRunId = contextualRunId(input?.runId, event.subagentRunId);
      responses.set(event.messageId, {
        terminal: false,
        ...(ownerRunId ? { runId: ownerRunId } : {}),
      });
      dispatch({
        type: "response.started",
        responseId: responseId(scopeId, event.messageId),
        ...(ownerRunId ? { runId: ownerRunId } : {}),
      });
    },
    onTextMessageContentEvent({ event }) {
      const response = responses.get(event.messageId);
      if (!response || response.terminal || !event.delta) return;
      dispatch({
        type: "response.text.delta",
        responseId: responseId(scopeId, event.messageId),
        delta: event.delta,
        ...(response.runId ? { runId: response.runId } : {}),
      });
    },
    onTextMessageEndEvent({ event }) {
      const response = responses.get(event.messageId);
      if (!response || response.terminal) return;
      response.terminal = true;
      dispatch({
        type: "response.completed",
        responseId: responseId(scopeId, event.messageId),
        ...(response.runId ? { runId: response.runId } : {}),
      });
    },
    onToolCallStartEvent({ event, input }) {
      if (
        disposed ||
        saturated ||
        !admit(tools, event.toolCallId) ||
        tools.has(event.toolCallId)
      )
        return;
      const ownerRunId = contextualRunId(input?.runId, event.subagentRunId);
      tools.set(event.toolCallId, {
        terminal: false,
        ...(ownerRunId ? { runId: ownerRunId } : {}),
      });
      dispatch({
        type: "tool.started",
        toolId: toolId(scopeId, event.toolCallId),
        label: "A tool",
        ...(ownerRunId ? { runId: ownerRunId } : {}),
      });
    },
    onToolCallResultEvent({ event }) {
      const tool = tools.get(event.toolCallId);
      if (!tool || tool.terminal) return;
      tool.terminal = true;
      dispatch({
        type: "tool.completed",
        toolId: toolId(scopeId, event.toolCallId),
        label: "A tool",
        ...(tool.runId ? { runId: tool.runId } : {}),
      });
    },
    onRunErrorEvent({ input }) {
      const inputRunId = input?.runId;
      const run = inputRunId ? runs.get(inputRunId) : undefined;
      if (run && !run.terminal && inputRunId) {
        run.terminal = true;
        dispatch({ type: "run.failed", runId: runId(scopeId, inputRunId) });
      }
      for (const [id, response] of responses) {
        if (response.terminal) continue;
        response.terminal = true;
        dispatch({
          type: "response.failed",
          responseId: responseId(scopeId, id),
          ...(response.runId ? { runId: response.runId } : {}),
        });
      }
    },
    onRunFinishedEvent(params) {
      const run = runs.get(params.event.runId);
      if (run && !run.terminal) {
        run.terminal = true;
        dispatch({
          type:
            params.outcome === "interrupt"
              ? "run.interrupted"
              : "run.completed",
          runId: runId(scopeId, params.event.runId),
        });
      }
      if (params.outcome !== "interrupt") return;
      for (const [id, response] of responses) {
        if (response.terminal) continue;
        response.terminal = true;
        dispatch({
          type: "response.interrupted",
          responseId: responseId(scopeId, id),
          ...(response.runId ? { runId: response.runId } : {}),
        });
      }
      for (const interrupt of params.interrupts) {
        if (
          !admit(interactions, interrupt.id) ||
          interactions.has(interrupt.id)
        )
          continue;
        const ownerRunId = contextualRunId(
          params.event.runId,
          interrupt.subagentRunId,
        );
        interactions.set(interrupt.id, ownerRunId ?? null);
        dispatch({
          type: "interaction.requested",
          interactionId: interactionId(scopeId, interrupt.id),
          kind: "input",
          label: "Input is needed",
          urgent: true,
          ...(ownerRunId ? { runId: ownerRunId } : {}),
        });
      }
    },
  };
  const subscription = options.agent.subscribe(subscriber);
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      subscription.unsubscribe();
      responses.clear();
      tools.clear();
      runs.clear();
      interactions.clear();
      resolvedInteractions.clear();
    },
  };
}
