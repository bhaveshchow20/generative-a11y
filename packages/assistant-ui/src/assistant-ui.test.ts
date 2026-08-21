import type {
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import { describe, expect, it } from "vitest";
import { bindThreadRuntime, type ThreadRuntimeSource } from "./index.js";

type State = { messages: readonly unknown[] };
function runtimeFor(initial: State) {
  let state = initial;
  let listener: (() => void) | undefined;
  return {
    getState: () => state,
    subscribe(callback: () => void) {
      listener = callback;
      return () => {
        listener = undefined;
      };
    },
    update(next: State) {
      state = next;
      listener?.();
    },
  };
}
function assistant(
  id: string,
  text: string,
  status: unknown = { type: "running" },
) {
  return { id, role: "assistant", content: [{ type: "text", text }], status };
}
function eventsRuntime() {
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

describe("assistant-ui binding", () => {
  it("silently baselines history, then streams one append-only suffix and terminal state", () => {
    const { events, runtime } = eventsRuntime();
    const thread = runtimeFor({ messages: [assistant("old", "history")] });
    bindThreadRuntime({
      runtime,
      scopeId: "thread",
      thread: thread as unknown as ThreadRuntimeSource,
    });
    thread.update({
      messages: [assistant("old", "history"), assistant("new", "Hi")],
    });
    thread.update({
      messages: [assistant("old", "history"), assistant("new", "Hi there")],
    });
    thread.update({
      messages: [
        assistant("old", "history"),
        assistant("new", "Hi there", { type: "complete", reason: "stop" }),
      ],
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "thread:message:new" },
      {
        type: "response.text.delta",
        responseId: "thread:message:new",
        delta: "Hi",
      },
      {
        type: "response.text.delta",
        responseId: "thread:message:new",
        delta: " there",
      },
      { type: "response.completed", responseId: "thread:message:new" },
    ]);
  });
  it("does not invent a terminal state for an unknown incomplete reason, rejects rewrites, and ignores callbacks after dispose", () => {
    const { events, runtime } = eventsRuntime();
    const thread = runtimeFor({ messages: [] });
    const binding = bindThreadRuntime({
      runtime,
      scopeId: "thread",
      thread: thread as unknown as ThreadRuntimeSource,
    });
    thread.update({ messages: [assistant("new", "abc")] });
    thread.update({
      messages: [
        assistant("new", "rewritten", { type: "incomplete", reason: "other" }),
      ],
    });
    binding.dispose();
    thread.update({ messages: [assistant("late", "ignored")] });
    expect(events).toEqual([
      { type: "response.started", responseId: "thread:message:new" },
      {
        type: "response.text.delta",
        responseId: "thread:message:new",
        delta: "abc",
      },
    ]);
  });

  it("tracks public tool, approval, and source identities without replaying hydrated history", () => {
    const { events, runtime } = eventsRuntime();
    const thread = runtimeFor({
      messages: [
        {
          id: "history",
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "old-tool",
              result: { done: true },
            },
            { type: "source", id: "old-source" },
          ],
          status: { type: "complete", reason: "stop" },
        },
      ],
    });
    bindThreadRuntime({
      runtime,
      scopeId: "thread",
      thread: thread as unknown as ThreadRuntimeSource,
    });
    thread.update({ messages: thread.getState().messages });
    expect(events).toEqual([]);
    thread.update({
      messages: [
        ...thread.getState().messages,
        {
          id: "live",
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "tool-1",
              approval: { id: "approval-1" },
            },
            { type: "source", id: "source-1" },
          ],
          status: { type: "running" },
        },
      ],
    });
    thread.update({
      messages: [
        ...thread.getState().messages.slice(0, 1),
        {
          id: "live",
          role: "assistant",
          content: [
            {
              type: "tool-call",
              toolCallId: "tool-1",
              result: { ignored: "not announced" },
              approval: { id: "approval-1", approved: true },
            },
            { type: "source", id: "source-1" },
          ],
          status: { type: "running" },
        },
      ],
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "thread:message:live" },
      { type: "tool.started", toolId: "thread:tool:tool-1", label: "A tool" },
      {
        type: "approval.requested",
        approvalId: "thread:approval:approval-1",
        label: "A tool",
      },
      { type: "citation.available", count: 2 },
      { type: "tool.completed", toolId: "thread:tool:tool-1", label: "A tool" },
      {
        type: "approval.resolved",
        approvalId: "thread:approval:approval-1",
        outcome: "approved",
        label: "A tool",
      },
    ]);
  });

  it("fails closed rather than replaying untracked identities after a configured capacity is reached", () => {
    const { events, runtime } = eventsRuntime();
    const thread = runtimeFor({ messages: [] });
    bindThreadRuntime({
      runtime,
      scopeId: "thread",
      thread: thread as unknown as ThreadRuntimeSource,
      maxTrackedEntities: 1,
    });
    thread.update({
      messages: [
        {
          id: "response",
          role: "assistant",
          content: [
            { type: "text", text: "first" },
            { type: "text", text: "second" },
          ],
          status: { type: "running" },
        },
      ],
    });
    thread.update({ messages: [assistant("later", "must stay silent")] });
    expect(events).toEqual([
      { type: "response.started", responseId: "thread:message:response" },
      {
        type: "response.text.delta",
        responseId: "thread:message:response",
        delta: "first",
      },
    ]);
  });

  it("validates ownership inputs and isolates a host dispatch failure", () => {
    const thread = runtimeFor({ messages: [] });
    expect(() =>
      bindThreadRuntime({
        runtime: { dispatch: () => false },
        scopeId: " ",
        thread: thread as unknown as ThreadRuntimeSource,
      }),
    ).toThrow("scopeId");
    const binding = bindThreadRuntime({
      runtime: {
        dispatch() {
          throw new Error("host delivery failed");
        },
      },
      scopeId: "thread",
      thread: thread as unknown as ThreadRuntimeSource,
    });
    expect(() =>
      thread.update({ messages: [assistant("live", "safe")] }),
    ).not.toThrow();
    binding.dispose();
  });
});
