import type {
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import { describe, expect, it } from "vitest";
import { bindAgent } from "./index.js";

type Subscriber = Record<
  string,
  (value: {
    event: Record<string, unknown>;
    outcome?: "success" | "interrupt";
    interrupts?: readonly { id: string }[];
    input?: {
      resume?: readonly {
        interruptId: string;
        status: "resolved" | "cancelled";
      }[];
    };
  }) => void
>;
function agentFor() {
  let subscriber: Subscriber | undefined;
  return {
    subscribe(value: Subscriber) {
      subscriber = value;
      return {
        unsubscribe() {
          subscriber = undefined;
        },
      };
    },
    emit(name: string, value: Parameters<Subscriber[string]>[0]) {
      subscriber?.[name]?.(value);
    },
  };
}
function recorder() {
  const events: GenerativeA11yEvent[] = [];
  return {
    events,
    runtime: {
      dispatch: (event: GenerativeA11yEvent) => events.push(event),
    } satisfies Pick<GenerativeA11yRuntime, "dispatch">,
  };
}

describe("AG-UI binding", () => {
  it("maps public text lifecycle callbacks and does not duplicate or accept late content", () => {
    const { events, runtime } = recorder();
    const agent = agentFor();
    const binding = bindAgent({
      runtime,
      scopeId: "agent",
      agent: agent as never,
    });
    agent.emit("onTextMessageStartEvent", {
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "message",
        role: "assistant",
      },
    });
    agent.emit("onTextMessageContentEvent", {
      event: {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "message",
        delta: "Hi",
      },
    });
    agent.emit("onTextMessageEndEvent", {
      event: { type: "TEXT_MESSAGE_END", messageId: "message" },
    });
    agent.emit("onTextMessageContentEvent", {
      event: {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "message",
        delta: " late",
      },
    });
    binding.dispose();
    expect(events).toEqual([
      { type: "response.started", responseId: "agent:message:message" },
      {
        type: "response.text.delta",
        responseId: "agent:message:message",
        delta: "Hi",
      },
      { type: "response.completed", responseId: "agent:message:message" },
    ]);
  });
  it("waits for a result, not TOOL_CALL_END, and keeps tool identities concurrent", () => {
    const { events, runtime } = recorder();
    const agent = agentFor();
    bindAgent({ runtime, scopeId: "agent", agent: agent as never });
    agent.emit("onToolCallStartEvent", {
      event: {
        type: "TOOL_CALL_START",
        toolCallId: "one",
        toolCallName: "search",
      },
    });
    agent.emit("onToolCallStartEvent", {
      event: {
        type: "TOOL_CALL_START",
        toolCallId: "two",
        toolCallName: "search",
      },
    });
    agent.emit("onToolCallEndEvent", {
      event: { type: "TOOL_CALL_END", toolCallId: "one" },
    });
    agent.emit("onToolCallResultEvent", {
      event: { type: "TOOL_CALL_RESULT", toolCallId: "two", content: "secret" },
    });
    agent.emit("onToolCallResultEvent", {
      event: { type: "TOOL_CALL_RESULT", toolCallId: "one", content: "secret" },
    });
    expect(events).toEqual([
      { type: "tool.started", toolId: "agent:tool:one", label: "A tool" },
      { type: "tool.started", toolId: "agent:tool:two", label: "A tool" },
      { type: "tool.completed", toolId: "agent:tool:two", label: "A tool" },
      { type: "tool.completed", toolId: "agent:tool:one", label: "A tool" },
    ]);
  });
  it("maps a run error and protocol interrupt only once, without backend error copy", () => {
    const { events, runtime } = recorder();
    const agent = agentFor();
    bindAgent({ runtime, scopeId: "agent", agent: agent as never });
    agent.emit("onTextMessageStartEvent", {
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "failed",
        role: "assistant",
      },
    });
    agent.emit("onRunErrorEvent", {
      event: { type: "RUN_ERROR", message: "do not speak" },
    });
    agent.emit("onTextMessageStartEvent", {
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "interrupted",
        role: "assistant",
      },
    });
    agent.emit("onRunFinishedEvent", {
      event: { type: "RUN_FINISHED" },
      outcome: "interrupt",
      interrupts: [{ id: "need-input" }],
    });
    agent.emit("onRunInitialized", {
      event: {},
      input: { resume: [{ interruptId: "need-input", status: "resolved" }] },
    });
    agent.emit("onRunInitialized", {
      event: {},
      input: { resume: [{ interruptId: "need-input", status: "resolved" }] },
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "agent:message:failed" },
      { type: "response.failed", responseId: "agent:message:failed" },
      { type: "response.started", responseId: "agent:message:interrupted" },
      { type: "response.interrupted", responseId: "agent:message:interrupted" },
      {
        type: "interaction.requested",
        interactionId: "agent:interrupt:need-input",
        kind: "input",
        label: "Input is needed",
        urgent: true,
      },
      {
        type: "interaction.resolved",
        interactionId: "agent:interrupt:need-input",
        kind: "input",
        outcome: "submitted",
        label: "Input is needed",
      },
    ]);
  });
  it("fails closed at capacity and ignores callbacks after disposal", () => {
    const { events, runtime } = recorder();
    const agent = agentFor();
    const binding = bindAgent({
      runtime,
      scopeId: "agent",
      maxTrackedEntities: 1,
      agent: agent as never,
    });
    agent.emit("onTextMessageStartEvent", {
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "one",
        role: "assistant",
      },
    });
    agent.emit("onTextMessageStartEvent", {
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "two",
        role: "assistant",
      },
    });
    binding.dispose();
    agent.emit("onTextMessageContentEvent", {
      event: {
        type: "TEXT_MESSAGE_CONTENT",
        messageId: "one",
        delta: "ignored",
      },
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "agent:message:one" },
    ]);
  });
});
