"use client";

import { useChat } from "@ai-sdk/react";
import type { AssistantRuntime } from "@assistant-ui/core";
import { AssistantRuntimeProvider, useLocalRuntime } from "@assistant-ui/react";
import {
  useChatAccessibility,
  useObserveChatAccessibility,
} from "@generative-a11y/ai-sdk/react";
import { bindThreadRuntime, type ThreadRuntimeSource } from "@generative-a11y/assistant-ui";
import {
  createGenerativeA11y,
  type AnnouncementIntent,
  type GenerativeA11yEvent,
} from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { useEffect, useMemo, useState } from "react";

type Framework = "ai-sdk" | "assistant-ui";
type ExampleName = "support" | "order" | "research";

const examples: Array<{ name: ExampleName; title: string; prompt: string; detail: string }> = [
  { name: "support", title: "Customer support", prompt: "Explain why my workspace is temporarily locked.", detail: "A concise streaming response with a clear terminal state." },
  { name: "order", title: "Order operations", prompt: "Check order 1842 and summarize the shipment status.", detail: "An operational status response presented in clear, paced updates." },
  { name: "research", title: "Research assistant", prompt: "Summarize the accessibility review and include its source.", detail: "Streaming text and source evidence without changing the host UI." },
];

const answers: Record<ExampleName, string[]> = {
  support: ["Your workspace was locked after several sign-in attempts. ", "No data was changed. ", "Try again in ten minutes or reset your password now."],
  order: ["I checked order 1842. ", "The package left the regional hub this morning ", "and is scheduled to arrive tomorrow by 6 PM."],
  research: ["The review found strong semantic structure and keyboard support. ", "It recommends clearer progress announcements ", "for long-running assistant actions."],
};

export function RealFrameworkShowcase() {
  const [framework, setFramework] = useState<Framework>("ai-sdk");
  return (
    <section className="framework-showcase real-showcase" aria-labelledby="framework-title">
      <div className="framework-heading">
        <div><p>Installed framework examples</p><h2 id="framework-title">A real app view, with accessibility alongside it.</h2></div>
        <p>Choose a familiar application workflow. The selected framework runs locally, its production generative-a11y adapter observes public state, and the real DOM layer delivers the resulting announcements.</p>
      </div>
      <div className="version-row" aria-label="Installed framework versions">
        <span><i aria-hidden="true" /> AI SDK 7.0.66</span><span><i aria-hidden="true" /> @ai-sdk/react 4.0.69</span><span><i aria-hidden="true" /> assistant-ui 0.15.14</span>
      </div>
      <div className="framework-tabs" role="tablist" aria-label="Framework">
        <button type="button" role="tab" aria-selected={framework === "ai-sdk"} onClick={() => setFramework("ai-sdk")}>AI SDK</button>
        <button type="button" role="tab" aria-selected={framework === "assistant-ui"} onClick={() => setFramework("assistant-ui")}>assistant-ui</button>
      </div>
      {framework === "ai-sdk" ? <AiSdkExample /> : <AssistantUiExample />}
    </section>
  );
}

function AiSdkExample() {
  const harness = useHarness();
  const [active, setActive] = useState<ExampleName>("support");
  const transport = useMemo<ChatTransport<UIMessage>>(() => ({
    async sendMessages({ messages, abortSignal }) {
      const prompt = messageText(messages.at(-1));
      const example = examples.find((item) => item.prompt === prompt)?.name ?? "support";
      return chunkStream(example, abortSignal);
    },
    async reconnectToStream() { return null; },
  }), []);
  const integration = useChatAccessibility({ runtime: harness.bridge, scopeId: "product-demo" });
  const chat = useChat({ id: "product-demo", transport, ...integration.chatCallbacks });
  useObserveChatAccessibility({ integration, snapshot: chat });

  async function run(name: ExampleName) {
    setActive(name);
    harness.clear();
    chat.setMessages([]);
    await chat.sendMessage({ text: examples.find((item) => item.name === name)!.prompt });
  }

  return <ExampleSurface framework="AI SDK useChat" active={active} status={chat.status} messages={chat.messages} events={harness.events} announcements={harness.announcements} onRun={run} />;
}

function AssistantUiExample() {
  const adapter = useMemo(() => ({
    async *run({ messages }: { messages: readonly unknown[] }) {
      const prompt = latestUserText(messages);
      const example = examples.find((item) => item.prompt === prompt)?.name ?? "support";
      let text = "";
      for (const part of answers[example]) {
        await pause(190);
        text += part;
        yield { content: [{ type: "text" as const, text }] };
      }
      yield { content: [{ type: "text" as const, text }], status: { type: "complete" as const, reason: "stop" as const } };
    },
  }), []);
  const runtime = useLocalRuntime(adapter);
  return <AssistantRuntimeProvider runtime={runtime}><AssistantUiConnected runtime={runtime} /></AssistantRuntimeProvider>;
}

function AssistantUiConnected({ runtime }: { runtime: AssistantRuntime }) {
  const harness = useHarness();
  const [active, setActive] = useState<ExampleName>("support");
  const thread = runtime.thread;
  const snapshot = thread.getState();

  useEffect(() => {
    const binding = bindThreadRuntime({ runtime: harness.bridge, scopeId: "product-thread", thread: thread as unknown as ThreadRuntimeSource });
    return () => binding.dispose();
  }, [harness.bridge, thread]);

  function run(name: ExampleName) {
    setActive(name);
    harness.clear();
    thread.append({ role: "user", content: [{ type: "text", text: examples.find((item) => item.name === name)!.prompt }] });
  }

  return <ExampleSurface framework="assistant-ui useLocalRuntime" active={active} status={snapshot.isRunning ? "streaming" : "ready"} messages={snapshot.messages} events={harness.events} announcements={harness.announcements} onRun={run} />;
}

function useHarness() {
  const [events, setEvents] = useState<GenerativeA11yEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementIntent[]>([]);
  const runtime = useMemo(() => createGenerativeA11y({ preset: "verbose", policy: { text: { minimumCharacters: 1, maximumDelayMs: 0 }, tools: { announceStartAfterMs: 0, announceProgress: true }, minimumGapMs: 0 } }), []);
  const bridge = useMemo(() => ({ dispatch(event: GenerativeA11yEvent) { setEvents((current) => [...current, event]); return runtime.dispatch(event); } }), [runtime]);
  useEffect(() => {
    const unsubscribe = runtime.subscribeAnnouncements((announcement) => setAnnouncements((current) => [...current, announcement]));
    const dom = connectRuntimeToDOM(runtime, { mode: "live-region" });
    return () => { unsubscribe(); dom.dispose(); runtime.dispose(); };
  }, [runtime]);
  return { events, announcements, bridge, clear() { setEvents([]); setAnnouncements([]); } };
}

function ExampleSurface({ framework, active, status, messages, events, announcements, onRun }: { framework: string; active: ExampleName; status: string; messages: readonly unknown[]; events: readonly GenerativeA11yEvent[]; announcements: readonly AnnouncementIntent[]; onRun(name: ExampleName): void }) {
  return (
    <div className="real-example-panel" role="tabpanel">
      <nav className="example-picker" aria-label="Real world examples">{examples.map((example) => <button key={example.name} type="button" aria-current={active === example.name ? "true" : undefined} onClick={() => onRun(example.name)}><span>{example.title}</span><small>{example.detail}</small></button>)}</nav>
      <div className="product-window">
        <div className="product-bar"><span>Acme workspace</span><b data-status={status}><i aria-hidden="true" />{status === "streaming" ? "Responding" : "Ready"}</b></div>
        <div className="product-conversation">
          <p className="product-user">{examples.find((item) => item.name === active)!.prompt}</p>
          <div className="product-answer"><span aria-hidden="true">A</span><p>{latestAssistantText(messages) || "Choose an example to run this installed framework."}</p></div>
        </div>
        <footer><code>{framework}</code><span>Visual UI remains application-owned</span></footer>
      </div>
      <aside className="adapter-trace">
        <header><span>Accessibility trace</span><b>{events.length} events</b></header>
        <div className="trace-guide" aria-label="How framework state becomes an announcement">
          <span><b>1</b>Framework state</span><i aria-hidden="true" /><span><b>2</b>Normalized event</span><i aria-hidden="true" /><span><b>3</b>Accessible announcement</span>
        </div>
        <p className="trace-help">Each item explains what changed in the app and why the accessibility layer responded. Open one for technical details.</p>
        <ol data-testid="real-framework-events">{events.length ? events.slice(-7).map((event, index) => {
          const explanation = explainEvent(event);
          return <li key={`${event.type}:${index}`}>
            <details aria-label={explanation.title}>
              <summary><i aria-hidden="true" /><span><b>{explanation.title}</b><small>{explanation.summary}</small></span><em aria-hidden="true">+</em></summary>
              <div className="event-explanation">
                <p><strong>Why it matters</strong>{explanation.why}</p>
                <dl><div><dt>Normalized event</dt><dd><code>{event.type}</code></dd></div><div><dt>Source identity</dt><dd><code>{eventIdentity(event)}</code></dd></div></dl>
              </div>
            </details>
          </li>;
        }) : <li className="empty-trace">Choose an example. The trace will explain every accessibility decision as the response runs.</li>}</ol>
        <div className="announcement-preview"><span>Latest announcement</span><p>{announcements.at(-1)?.text ?? "Waiting for framework evidence"}</p></div>
      </aside>
    </div>
  );
}

function chunkStream(example: ExampleName, signal: AbortSignal | undefined) {
  return new ReadableStream<UIMessageChunk>({
    async start(controller) {
      const id = `text-${example}`;
      controller.enqueue({ type: "start", messageId: `assistant-${example}` });
      controller.enqueue({ type: "text-start", id });
      for (const delta of answers[example]) {
        await pause(190);
        if (signal?.aborted) { controller.enqueue({ type: "abort" }); controller.close(); return; }
        controller.enqueue({ type: "text-delta", id, delta });
      }
      if (example === "research") controller.enqueue({ type: "source-url", sourceId: "review-source", url: "https://example.com/accessibility-review", title: "Accessibility review" });
      controller.enqueue({ type: "text-end", id });
      controller.enqueue({ type: "finish", finishReason: "stop" });
      controller.close();
    },
  });
}

function latestAssistantText(messages: readonly unknown[]) {
  const message = [...messages].reverse().find((value) => (value as { role?: string }).role === "assistant") as { parts?: readonly unknown[]; content?: readonly unknown[] } | undefined;
  const parts = message?.parts ?? message?.content ?? [];
  return parts.map((part) => (part as { type?: string; text?: string }).type === "text" ? (part as { text: string }).text : "").join("");
}

function messageText(message: unknown) {
  const value = message as { parts?: readonly unknown[] } | undefined;
  return (value?.parts ?? []).map((part) => (part as { type?: string; text?: string }).type === "text" ? (part as { text: string }).text : "").join("");
}

function latestUserText(messages: readonly unknown[]) {
  const message = [...messages].reverse().find((value) => (value as { role?: string }).role === "user") as { content?: readonly unknown[] } | undefined;
  return (message?.content ?? []).map((part) => (part as { type?: string; text?: string }).type === "text" ? (part as { text: string }).text : "").join("");
}

function pause(ms: number) { return new Promise<void>((resolve) => window.setTimeout(resolve, ms)); }

const eventExplanations: Record<string, { title: string; summary: string; why: string }> = {
  "response.started": { title: "Assistant response started", summary: "The framework began a new assistant message.", why: "This creates a stable response identity so later updates stay attached to the correct message." },
  "response.text.delta": { title: "New response text arrived", summary: "The framework appended more text to the active answer.", why: "The library can pace useful chunks instead of announcing every token or rereading the whole response." },
  "response.completed": { title: "Assistant response completed", summary: "The framework reported a successful terminal state.", why: "The library can deliver a clear completion message and flush any useful buffered text." },
  "response.interrupted": { title: "Response was stopped", summary: "The user or host interrupted the active response.", why: "Buffered text is cancelled so stale content is not announced after the response has stopped." },
  "response.failed": { title: "Response failed", summary: "The framework reported that the active response could not finish.", why: "The accessibility layer can communicate failure without exposing private error details." },
  "tool.started": { title: "App action started", summary: "The assistant began an application-owned action.", why: "A delayed progress announcement can reassure users during work that has no immediate visual result." },
  "tool.completed": { title: "App action completed", summary: "The framework reported a successful tool result.", why: "Users receive a concise outcome without focus being moved away from their current task." },
  "tool.failed": { title: "App action failed", summary: "The framework reported an unsuccessful tool result.", why: "The host can communicate recovery-oriented status while keeping sensitive errors private." },
  "approval.requested": { title: "Approval is required", summary: "The assistant paused for a user decision.", why: "The request becomes noticeable while the visible approval controls remain owned by the app." },
  "approval.resolved": { title: "Approval was resolved", summary: "The framework recorded the user decision.", why: "The accessibility layer confirms the outcome and keeps it connected to the original request." },
  "citation.available": { title: "A supporting source arrived", summary: "The framework added verifiable source information.", why: "The user can be told that sources are available without every URL interrupting the response." },
};

function explainEvent(event: GenerativeA11yEvent) {
  return eventExplanations[event.type] ?? { title: "Application state changed", summary: "The adapter normalized public framework evidence.", why: "A consistent event model lets the same accessibility policy work across different frameworks." };
}

function eventIdentity(event: GenerativeA11yEvent) {
  if ("responseId" in event) return event.responseId;
  if ("toolId" in event) return event.toolId;
  if ("approvalId" in event) return event.approvalId;
  return "framework event";
}
