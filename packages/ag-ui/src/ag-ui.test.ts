import {
  createAnnouncementRecorder,
  type GenerativeA11yEvent,
  type GenerativeA11yRuntime,
} from "@generative-a11y/core";
import { describe, expect, it } from "vitest";
import { AGENT_ADAPTER_METADATA, bindAgent } from "./index.js";

type Subscriber = Record<
  string,
  (value: {
    event: Record<string, unknown>;
    outcome?: "success" | "interrupt";
    interrupts?: readonly { id: string }[];
    input?: {
      runId?: string;
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
      dispatch(event: GenerativeA11yEvent) {
        events.push(event);
        return true;
      },
    } satisfies Pick<GenerativeA11yRuntime, "dispatch">,
  };
}

describe("AG-UI binding", () => {
  it("declares exact run support and partial name-only step support", () => {
    expect(AGENT_ADAPTER_METADATA.fidelity).toMatchObject({
      runs: "exact",
      steps: "partial",
      hierarchy: "partial",
      tools: "exact",
      interactions: "exact",
      replay: "partial",
      reconnection: "partial",
      customEvents: "unsupported",
    });
  });
  it("surfaces name-only steps as diagnostic evidence without inventing identity", () => {
    const recorder = createAnnouncementRecorder();
    const agent = agentFor();
    bindAgent({
      runtime: recorder.runtime,
      scopeId: "agent",
      agent: agent as never,
    });
    const input = { runId: "root" };

    agent.emit("onRunStartedEvent", {
      input,
      event: { type: "RUN_STARTED", threadId: "thread", runId: "root" },
    });
    agent.emit("onStepStartedEvent", {
      input,
      event: { type: "STEP_STARTED", stepName: "Search sources" },
    });
    agent.emit("onStepFinishedEvent", {
      input,
      event: { type: "STEP_FINISHED", stepName: "Search sources" },
    });

    expect(
      recorder
        .diagnosticTranscript()
        .filter(({ sourceType }) => sourceType?.startsWith("step.")),
    ).toEqual([
      expect.objectContaining({
        sourceType: "step.started",
        reason: "partial-identity",
        runId: "agent:run:root",
      }),
      expect.objectContaining({
        sourceType: "step.completed",
        reason: "partial-identity",
        runId: "agent:run:root",
      }),
    ]);
    recorder.clock.runUntilIdle();
    expect(recorder.runtime.getDiagnosticSnapshot().steps).toEqual([]);
    expect(recorder.transcript()).toEqual([]);
  });
  it("announces an interrupt request before terminating its owning run", () => {
    const recorder = createAnnouncementRecorder();
    const agent = agentFor();
    bindAgent({
      runtime: recorder.runtime,
      scopeId: "agent",
      agent: agent as never,
    });
    const input = { runId: "root" };

    agent.emit("onRunStartedEvent", {
      input,
      event: { type: "RUN_STARTED", threadId: "thread", runId: "root" },
    });
    agent.emit("onTextMessageStartEvent", {
      input,
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "answer",
        role: "assistant",
      },
    });
    agent.emit("onRunFinishedEvent", {
      input,
      event: { type: "RUN_FINISHED", threadId: "thread", runId: "root" },
      outcome: "interrupt",
      interrupts: [{ id: "need-input" }],
    });
    recorder.clock.runUntilIdle();

    expect(recorder.transcript().map(({ text }) => text)).toContain(
      "Input is needed",
    );
    expect(
      recorder
        .diagnosticTranscript()
        .filter(({ sourceType }) =>
          ["response.interrupted", "interaction.requested"].includes(
            sourceType ?? "",
          ),
        ),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: "terminal-run" }),
      ]),
    );
  });
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

  it("terminalizes active child runs and tools before a top-level run error", () => {
    const recorder = createAnnouncementRecorder();
    const agent = agentFor();
    bindAgent({
      runtime: recorder.runtime,
      scopeId: "agent",
      agent: agent as never,
    });
    const input = { runId: "root" };

    agent.emit("onRunStartedEvent", {
      input,
      event: { type: "RUN_STARTED", threadId: "thread", runId: "root" },
    });
    agent.emit("onSubagentStartedEvent", {
      input,
      event: {
        type: "SUBAGENT_STARTED",
        subagentRunId: "research",
        name: "Research",
      },
    });
    agent.emit("onToolCallStartEvent", {
      input,
      event: {
        type: "TOOL_CALL_START",
        toolCallId: "search",
        toolCallName: "search",
        subagentRunId: "research",
      },
    });
    agent.emit("onTextMessageStartEvent", {
      input,
      event: {
        type: "TEXT_MESSAGE_START",
        messageId: "answer",
        role: "assistant",
        subagentRunId: "research",
      },
    });
    agent.emit("onRunErrorEvent", {
      input,
      event: { type: "RUN_ERROR", message: "private" },
    });

    expect(recorder.runtime.getDiagnosticSnapshot()).toMatchObject({
      runs: expect.arrayContaining([
        expect.objectContaining({
          runId: "agent:run:research",
          status: "failed",
        }),
        expect.objectContaining({
          runId: "agent:run:root",
          status: "failed",
        }),
      ]),
      tools: [
        expect.objectContaining({
          toolId: "agent:tool:search",
          status: "failed",
        }),
      ],
      responses: [
        expect.objectContaining({
          responseId: "agent:message:answer",
          status: "failed",
        }),
      ],
    });

    const diagnosticCount = recorder.diagnosticTranscript().length;
    agent.emit("onToolCallResultEvent", {
      input,
      event: {
        type: "TOOL_CALL_RESULT",
        toolCallId: "search",
        content: "late",
        subagentRunId: "research",
      },
    });
    agent.emit("onSubagentFinishedEvent", {
      input,
      event: {
        type: "SUBAGENT_FINISHED",
        subagentRunId: "research",
        outcome: { type: "success" },
      },
    });
    expect(recorder.diagnosticTranscript()).toHaveLength(diagnosticCount);
  });

  it("fails an active tool without run ownership on a top-level error", () => {
    const recorder = createAnnouncementRecorder();
    const agent = agentFor();
    bindAgent({
      runtime: recorder.runtime,
      scopeId: "agent",
      agent: agent as never,
    });

    agent.emit("onToolCallStartEvent", {
      event: {
        type: "TOOL_CALL_START",
        toolCallId: "orphaned",
        toolCallName: "search",
      },
    });
    agent.emit("onRunErrorEvent", {
      event: { type: "RUN_ERROR", message: "private" },
    });

    expect(recorder.runtime.getDiagnosticSnapshot().tools).toEqual([
      expect.objectContaining({
        toolId: "agent:tool:orphaned",
        status: "failed",
      }),
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

  it("preserves run and subagent hierarchy while keeping name-only steps partial", () => {
    const { events, runtime } = recorder();
    const agent = agentFor();
    bindAgent({ runtime, scopeId: "agent", agent: agent as never });
    const input = { runId: "root" };

    agent.emit("onRunStartedEvent", {
      input,
      event: { type: "RUN_STARTED", threadId: "thread", runId: "root" },
    });
    agent.emit("onSubagentStartedEvent", {
      input,
      event: {
        type: "SUBAGENT_STARTED",
        subagentRunId: "research",
        name: "Research",
        parentToolCallId: "delegate",
        parentMessageId: "message",
      },
    });
    agent.emit("onStepStartedEvent", {
      input,
      event: {
        type: "STEP_STARTED",
        stepName: "Search sources",
        subagentRunId: "research",
      },
    });
    agent.emit("onToolCallStartEvent", {
      input,
      event: {
        type: "TOOL_CALL_START",
        toolCallId: "search",
        toolCallName: "search",
        subagentRunId: "research",
      },
    });
    agent.emit("onToolCallResultEvent", {
      input,
      event: {
        type: "TOOL_CALL_RESULT",
        toolCallId: "search",
        content: "private",
        subagentRunId: "research",
      },
    });
    agent.emit("onStepFinishedEvent", {
      input,
      event: {
        type: "STEP_FINISHED",
        stepName: "Search sources",
        subagentRunId: "research",
      },
    });
    agent.emit("onSubagentFinishedEvent", {
      input,
      event: {
        type: "SUBAGENT_FINISHED",
        subagentRunId: "research",
        outcome: { type: "success" },
      },
    });
    agent.emit("onRunFinishedEvent", {
      input,
      event: { type: "RUN_FINISHED", threadId: "thread", runId: "root" },
      outcome: "success",
    });

    expect(events).toEqual([
      { type: "run.started", runId: "agent:run:root" },
      {
        type: "run.started",
        runId: "agent:run:research",
        parentRunId: "agent:run:root",
        parentToolId: "agent:tool:delegate",
        parentResponseId: "agent:message:message",
        label: "Research",
      },
      {
        type: "step.started",
        runId: "agent:run:research",
        label: "Search sources",
      },
      {
        type: "tool.started",
        toolId: "agent:tool:search",
        label: "A tool",
        runId: "agent:run:research",
      },
      {
        type: "tool.completed",
        toolId: "agent:tool:search",
        label: "A tool",
        runId: "agent:run:research",
      },
      {
        type: "step.completed",
        runId: "agent:run:research",
        label: "Search sources",
      },
      { type: "run.completed", runId: "agent:run:research" },
      { type: "run.completed", runId: "agent:run:root" },
    ]);
  });
});
