// @vitest-environment jsdom

import type {
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";
import { createAnnouncementRecorder } from "@generative-a11y/core";
import { renderHook } from "@testing-library/react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import { StrictMode, type ReactNode } from "react";
import { describe, expect, it } from "vitest";

import {
  CHAT_ADAPTER_METADATA,
  composeChatCallbacks,
  createObserver,
} from "./index.js";
import { useChatAccessibility, useObserveChatAccessibility } from "./react.js";

function createRuntime() {
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

function assistantMessage(id: string, parts: unknown[]): UIMessage {
  return { id, role: "assistant", parts } as UIMessage;
}

function text(textValue: string) {
  return { type: "text", text: textValue, state: "streaming" };
}

function tool(
  toolCallId: string,
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error"
    | "approval-requested"
    | "approval-responded"
    | "output-denied",
  approval?: { id: string; approved?: boolean },
) {
  return {
    type: "dynamic-tool",
    toolName: "search",
    toolCallId,
    state,
    ...(approval ? { approval } : {}),
  };
}

describe("AI SDK observer", () => {
  it("exports immutable public metadata without requiring browser globals", () => {
    expect(Object.isFrozen(CHAT_ADAPTER_METADATA)).toBe(true);
    expect(CHAT_ADAPTER_METADATA.fidelity.interruption).toBe("exact");
    expect(CHAT_ADAPTER_METADATA.fidelity.retries).toBe("unavailable");
    expect(CHAT_ADAPTER_METADATA.fidelity.runs).toBe("unavailable");
    expect(CHAT_ADAPTER_METADATA.fidelity.steps).toBe("unavailable");
    expect(CHAT_ADAPTER_METADATA.fidelity.hierarchy).toBe("unavailable");
    expect(CHAT_ADAPTER_METADATA.saturation).toBe(
      "suppress-after-baseline-capacity",
    );
  });

  it("silently baselines history then streams only append-only text suffixes once", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "chat-a" });
    const history = assistantMessage("history", [text("already rendered")]);
    const response = assistantMessage("response-1", [text("Hi")]);

    observer.observe({
      messages: [history],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [history, response],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [history, response],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [history, assistantMessage("response-1", [text("Hi there")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [history, assistantMessage("response-1", [text("Rewritten")])],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([
      { type: "response.started", responseId: "chat-a:message:response-1" },
      {
        type: "response.text.delta",
        responseId: "chat-a:message:response-1",
        delta: "Hi",
      },
      {
        type: "response.text.delta",
        responseId: "chat-a:message:response-1",
        delta: " there",
      },
    ]);
  });

  it("starts a baselined assistant identity only when it later gains a suffix", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "hydrated" });

    observer.observe({
      messages: [assistantMessage("response", [text("partial")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [assistantMessage("response", [text("partial text")])],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([
      { type: "response.started", responseId: "hydrated:message:response" },
      {
        type: "response.text.delta",
        responseId: "hydrated:message:response",
        delta: " text",
      },
    ]);
  });

  it("fails closed when one response exceeds its tracked text-part cap", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "text-parts",
      maxTrackedEntities: 1,
    });
    const message = assistantMessage("m", [text("first"), text("second")]);
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [message],
      status: "streaming",
      error: undefined,
    });
    observer.finish(message, {
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });
    observer.observe({
      messages: [
        assistantMessage("m", [text("first later"), text("second later")]),
      ],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([
      { type: "response.started", responseId: "text-parts:message:m" },
      {
        type: "response.text.delta",
        responseId: "text-parts:message:m",
        delta: "first",
      },
    ]);
  });

  it("fails closed when label mapping throws without escaping snapshot observation", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "throwing-label",
      getToolLabel: () => {
        throw new Error("host label failure");
      },
    });
    observer.observe({ messages: [], status: "ready", error: undefined });
    expect(() =>
      observer.observe({
        messages: [assistantMessage("m", [tool("tool", "input-available")])],
        status: "streaming",
        error: undefined,
      }),
    ).not.toThrow();
    observer.observe({
      messages: [assistantMessage("later", [text("must be suppressed")])],
      status: "streaming",
      error: undefined,
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "throwing-label:message:m" },
    ]);
  });

  it("keeps host terminal callbacks running when runtime dispatch throws", () => {
    const observer = createObserver({
      runtime: {
        dispatch() {
          throw new Error("delivery failure");
        },
      },
      scopeId: "throwing-dispatch",
    });
    const calls: string[] = [];
    const callbacks = composeChatCallbacks({
      observer,
      onFinish: () => calls.push("finish"),
      onError: () => calls.push("error"),
    });
    const message = assistantMessage("m", []);

    expect(() =>
      callbacks.onFinish({
        message,
        messages: [],
        isAbort: false,
        isDisconnect: false,
        isError: false,
      }),
    ).not.toThrow();
    expect(() => callbacks.onError(new Error("backend"))).not.toThrow();
    expect(calls).toEqual(["finish", "error"]);
  });

  it("permanently suppresses a rewritten text part until its message identity changes", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "rewrite" });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [assistantMessage("m", [text("first")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [assistantMessage("m", [text("replaced")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [assistantMessage("m", [text("replaced later")])],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([
      { type: "response.started", responseId: "rewrite:message:m" },
      {
        type: "response.text.delta",
        responseId: "rewrite:message:m",
        delta: "first",
      },
    ]);
  });

  it("baselines tool, approval, and source identifiers without replaying history", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "history" });
    const history = assistantMessage("m", [
      tool("complete", "output-available"),
      tool("approval", "approval-requested", { id: "approval-id" }),
      { type: "source-url", sourceId: "url", url: "https://example.test" },
    ]);
    observer.observe({
      messages: [history],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [history],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [
        assistantMessage("m", [
          tool("approval", "approval-responded", {
            id: "approval-id",
            approved: true,
          }),
        ]),
      ],
      status: "ready",
      error: undefined,
    });
    expect(events).toEqual([]);
  });

  it("bounds tracked entities without evicting an active response", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "bound",
      maxTrackedEntities: 1,
    });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [
        assistantMessage("active", [text("a")]),
        assistantMessage("dropped", [text("b")]),
      ],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [
        assistantMessage("active", [text("ab")]),
        assistantMessage("dropped", [text("bc")]),
      ],
      status: "streaming",
      error: undefined,
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "bound:message:active" },
      {
        type: "response.text.delta",
        responseId: "bound:message:active",
        delta: "a",
      },
    ]);
  });

  it("suppresses all later snapshots when baseline history exceeds its tracking cap", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "saturated-history",
      maxTrackedEntities: 1,
    });
    const first = assistantMessage("first", [text("one")]);
    const second = assistantMessage("second", [text("two")]);
    const later = assistantMessage("later", [text("three")]);

    observer.observe({
      messages: [first, second],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [first, second],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [first, second, later],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([]);
  });

  it("does not replay bounded baseline history after a later live terminal response", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "bounded-history-live",
      maxTrackedEntities: 1,
    });
    const history = assistantMessage("history", [text("already rendered")]);
    const live = assistantMessage("live", [text("new response")]);

    observer.observe({
      messages: [history],
      status: "ready",
      error: undefined,
    });
    observer.observe({
      messages: [history, live],
      status: "streaming",
      error: undefined,
    });
    observer.finish(live, {
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });
    observer.observe({
      messages: [history, live],
      status: "ready",
      error: undefined,
    });

    expect(events).toEqual([]);
  });

  it("does not fabricate tool lifecycle events from output-only states", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "output-only" });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [assistantMessage("m", [text("live")])],
      status: "streaming",
      error: undefined,
    });
    const beforeTools = [...events];
    observer.observe({
      messages: [
        assistantMessage("m", [
          text("live"),
          tool("completed", "output-available"),
          tool("failed", "output-error"),
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    expect(events).toEqual(beforeTools);

    observer.observe({
      messages: [
        assistantMessage("m", [
          text("live"),
          tool("observed", "input-available"),
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [
        assistantMessage("m", [
          text("live"),
          tool("observed", "output-available"),
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    expect(events.slice(beforeTools.length)).toEqual([
      {
        type: "tool.started",
        toolId: "output-only:tool:observed",
        label: "A tool",
      },
      {
        type: "tool.completed",
        toolId: "output-only:tool:observed",
        label: "A tool",
      },
    ]);
  });

  it("bounds tool, approval, and source identity collections", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({
      runtime,
      scopeId: "bounded-parts",
      maxTrackedEntities: 1,
    });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [
        assistantMessage("m", [
          tool("first-tool", "input-available"),
          tool("second-tool", "input-available"),
          tool("first-approval", "approval-requested", {
            id: "first-approval",
          }),
          tool("second-approval", "approval-requested", {
            id: "second-approval",
          }),
          {
            type: "source-url",
            sourceId: "first-source",
            url: "https://one.test",
          },
          {
            type: "source-url",
            sourceId: "second-source",
            url: "https://two.test",
          },
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "bounded-parts:message:m" },
      {
        type: "tool.started",
        toolId: "bounded-parts:tool:first-tool",
        label: "A tool",
      },
    ]);
  });

  it("rejects malformed scopes and ignores malformed snapshots", () => {
    const { events, runtime } = createRuntime();
    expect(() => createObserver({ runtime, scopeId: "   " })).toThrow(
      "scopeId",
    );
    expect(() =>
      createObserver({ runtime, scopeId: "ok", maxTrackedEntities: 0 }),
    ).toThrow("maxTrackedEntities");
    const observer = createObserver({ runtime, scopeId: "ok" });
    expect(() => observer.observe(null as never)).not.toThrow();
    expect(events).toEqual([]);
  });

  it("dispatches observer events through a real core runtime", () => {
    const recorder = createAnnouncementRecorder({ preset: "verbose" });
    const observer = createObserver({
      runtime: recorder.runtime,
      scopeId: "core",
    });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [assistantMessage("m", [text("Hello.")])],
      status: "streaming",
      error: undefined,
    });
    recorder.clock.runUntilIdle();
    expect(
      recorder.transcript().map((announcement) => announcement.sourceType),
    ).toContain("response.text.delta");
  });

  it("keeps same-name tools, approvals, sources, and scopes independent", () => {
    const first = createRuntime();
    const second = createRuntime();
    const observer = createObserver({
      runtime: first.runtime,
      scopeId: "one",
      getToolLabel: ({ toolName }) => `Use ${toolName}`,
    });
    const other = createObserver({
      runtime: second.runtime,
      scopeId: "two",
    });
    const message = assistantMessage("m", [
      tool("call-1", "input-available"),
      tool("call-2", "input-streaming"),
      tool("call-1", "output-available"),
      tool("call-2", "approval-requested", { id: "approval-1" }),
      { type: "source-url", sourceId: "source-1", url: "https://example.test" },
      {
        type: "source-document",
        sourceId: "source-2",
        mediaType: "text/plain",
        title: "A",
      },
    ]);

    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [message],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [
        assistantMessage("m", [
          tool("call-1", "output-available"),
          tool("call-2", "approval-responded", {
            id: "approval-1",
            approved: false,
          }),
          {
            type: "source-url",
            sourceId: "source-1",
            url: "https://example.test",
          },
          {
            type: "source-document",
            sourceId: "source-2",
            mediaType: "text/plain",
            title: "A",
          },
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    other.observe({ messages: [], status: "ready", error: undefined });
    other.observe({
      messages: [assistantMessage("m", [text("separate")])],
      status: "streaming",
      error: undefined,
    });

    expect(first.events).toEqual([
      { type: "response.started", responseId: "one:message:m" },
      { type: "tool.started", toolId: "one:tool:call-1", label: "Use search" },
      { type: "tool.started", toolId: "one:tool:call-2", label: "Use search" },
      {
        type: "tool.completed",
        toolId: "one:tool:call-1",
        label: "Use search",
      },
      {
        type: "approval.requested",
        approvalId: "one:approval:approval-1",
        label: "Use search",
      },
      { type: "citation.available", count: 1 },
      { type: "citation.available", count: 2 },
      {
        type: "approval.resolved",
        approvalId: "one:approval:approval-1",
        outcome: "rejected",
        label: "Use search",
      },
    ]);
    expect(second.events).toEqual([
      { type: "response.started", responseId: "two:message:m" },
      {
        type: "response.text.delta",
        responseId: "two:message:m",
        delta: "separate",
      },
    ]);
  });

  it("composes terminal callbacks once without exposing backend error text", () => {
    const { events, runtime } = createRuntime();
    const observer = createObserver({ runtime, scopeId: "chat" });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [assistantMessage("complete", [text("done")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [assistantMessage("abort", [text("stop")])],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [assistantMessage("failure", [text("bad")])],
      status: "streaming",
      error: undefined,
    });
    const calls: string[] = [];
    const callbacks = composeChatCallbacks({
      observer,
      onFinish: () => calls.push("finish"),
      onError: () => calls.push("error"),
    });

    callbacks.onFinish({
      message: assistantMessage("complete", []),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });
    callbacks.onFinish({
      message: assistantMessage("abort", []),
      messages: [],
      isAbort: true,
      isDisconnect: false,
      isError: false,
    });
    callbacks.onFinish({
      message: assistantMessage("failure", []),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: true,
    });
    callbacks.onError(new Error("secret backend failure"));
    callbacks.onFinish({
      message: assistantMessage("failure", []),
      messages: [],
      isAbort: false,
      isDisconnect: true,
      isError: false,
    });

    expect(calls).toEqual(["finish", "finish", "finish", "error", "finish"]);
    expect(
      events.filter((event) => event.type === "response.completed"),
    ).toEqual([
      { type: "response.completed", responseId: "chat:message:complete" },
    ]);
    expect(
      events.filter((event) => event.type === "response.interrupted"),
    ).toEqual([
      { type: "response.interrupted", responseId: "chat:message:abort" },
    ]);
    expect(events.filter((event) => event.type === "response.failed")).toEqual([
      { type: "response.failed", responseId: "chat:message:failure" },
    ]);
    expect(
      events.some((event) =>
        JSON.stringify(event).includes("secret backend failure"),
      ),
    ).toBe(false);
    expect(events.some((event) => event.type === "response.retrying")).toBe(
      false,
    );
  });

  it("creates callbacks before a real public useChat invocation and observes its snapshot", () => {
    const { events, runtime } = createRuntime();
    const { result } = renderHook(() => {
      const integration = useChatAccessibility({
        runtime,
        scopeId: "real-chat",
      });
      const chat = useChat({ id: "real-chat", ...integration.chatCallbacks });
      useObserveChatAccessibility({ integration, snapshot: chat });
      return integration;
    });
    result.current.chatCallbacks.onFinish({
      message: assistantMessage("m", []),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "real-chat:message:m" },
      { type: "response.completed", responseId: "real-chat:message:m" },
    ]);
  });

  it("keeps one integration through changing callback and label identities", () => {
    const { events, runtime } = createRuntime();
    const hostCallbacks: string[] = [];
    const { result, rerender } = renderHook(
      ({ version }: { version: number }) =>
        useChatAccessibility({
          runtime,
          scopeId: "stable-integration",
          getToolLabel: () => `label-${version}`,
          onFinish: () => hostCallbacks.push(`finish-${version}`),
          onError: () => hostCallbacks.push(`error-${version}`),
        }),
      { initialProps: { version: 1 } },
    );
    const firstIntegration = result.current;
    firstIntegration.observer.observe({
      messages: [],
      status: "ready",
      error: undefined,
    });
    firstIntegration.observer.observe({
      messages: [assistantMessage("m", [text("first")])],
      status: "streaming",
      error: undefined,
    });

    rerender({ version: 2 });
    expect(result.current).toBe(firstIntegration);
    result.current.observer.observe({
      messages: [
        assistantMessage("m", [
          text("first second"),
          tool("tool", "input-available"),
        ]),
      ],
      status: "streaming",
      error: undefined,
    });
    result.current.chatCallbacks.onFinish({
      message: assistantMessage("m", []),
      messages: [],
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });

    expect(hostCallbacks).toEqual(["finish-2"]);
    expect(events).toEqual([
      { type: "response.started", responseId: "stable-integration:message:m" },
      {
        type: "response.text.delta",
        responseId: "stable-integration:message:m",
        delta: "first",
      },
      {
        type: "response.text.delta",
        responseId: "stable-integration:message:m",
        delta: " second",
      },
      {
        type: "tool.started",
        toolId: "stable-integration:tool:tool",
        label: "label-2",
      },
      {
        type: "response.completed",
        responseId: "stable-integration:message:m",
      },
    ]);
  });

  it("keeps a pre-useChat integration alive through the Strict Mode effect probe", async () => {
    const { events, runtime } = createRuntime();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <StrictMode>{children}</StrictMode>
    );
    const { result } = renderHook(
      () => useChatAccessibility({ runtime, scopeId: "strict" }),
      { wrapper },
    );
    await Promise.resolve();
    result.current.observer.observe({
      messages: [],
      status: "ready",
      error: undefined,
    });
    result.current.observer.observe({
      messages: [assistantMessage("m", [text("live")])],
      status: "streaming",
      error: undefined,
    });
    expect(events).toEqual([
      { type: "response.started", responseId: "strict:message:m" },
      {
        type: "response.text.delta",
        responseId: "strict:message:m",
        delta: "live",
      },
    ]);
  });

  it("does not infer terminals from ready or error snapshots and ignores stale observer input", () => {
    const { events, runtime } = createRuntime();
    const response = assistantMessage("response", [text("one")]);
    const observer = createObserver({ runtime, scopeId: "hook" });
    observer.observe({ messages: [], status: "ready", error: undefined });
    observer.observe({
      messages: [response],
      status: "streaming",
      error: undefined,
    });
    observer.observe({
      messages: [response],
      status: "ready",
      error: new Error("backend"),
    });
    observer.dispose();
    observer.observe({
      messages: [assistantMessage("response", [text("two")])],
      status: "streaming",
      error: undefined,
    });

    expect(events).toEqual([
      { type: "response.started", responseId: "hook:message:response" },
      {
        type: "response.text.delta",
        responseId: "hook:message:response",
        delta: "one",
      },
    ]);
  });
});
