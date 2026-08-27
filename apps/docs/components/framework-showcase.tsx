"use client";

import { createObserver } from "@generative-a11y/ai-sdk";
import {
  bindThreadRuntime,
  type ThreadRuntimeSource,
} from "@generative-a11y/assistant-ui";
import {
  createGenerativeA11y,
  type AnnouncementIntent,
  type GenerativeA11yEvent,
  type GenerativeA11yRuntime,
} from "@generative-a11y/core";
import {
  connectRuntimeToDOM,
  type DOMDeliveryResult,
} from "@generative-a11y/dom";
import { useEffect, useRef, useState } from "react";

type Framework = "ai-sdk" | "assistant-ui";

const snippets: Record<Framework, string> = {
  "ai-sdk": `const observer = createObserver({ runtime, scopeId: "release-chat" });
observer.observe({ messages, status, error });
observer.finish(message, finishOutcome);`,
  "assistant-ui": `const binding = bindThreadRuntime({
  runtime,
  scopeId: "release-thread",
  thread,
});`,
};

export function FrameworkShowcase() {
  const [framework, setFramework] = useState<Framework>("ai-sdk");
  const [events, setEvents] = useState<GenerativeA11yEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementIntent[]>([]);
  const [deliveries, setDeliveries] = useState<DOMDeliveryResult[]>([]);
  const disposeRef = useRef<() => void>(() => undefined);

  useEffect(() => () => disposeRef.current(), []);

  function newSession() {
    disposeRef.current();
    setEvents([]);
    setAnnouncements([]);
    setDeliveries([]);
    const runtime = createGenerativeA11y({
      preset: "verbose",
      policy: {
        text: { minimumCharacters: 1, maximumDelayMs: 0 },
        tools: { announceStartAfterMs: 0, announceProgress: true },
        minimumGapMs: 0,
      },
    });
    const unsubscribe = runtime.subscribeAnnouncements((announcement) => {
      setAnnouncements((current) => [...current, announcement]);
    });
    const dom = connectRuntimeToDOM(runtime, {
      mode: "live-region",
      onDiagnostic(result) {
        setDeliveries((current) => [...current, result]);
      },
    });
    const bridge = {
      dispatch(event: GenerativeA11yEvent) {
        setEvents((current) => [...current, event]);
        return runtime.dispatch(event);
      },
    } satisfies Pick<GenerativeA11yRuntime, "dispatch">;
    return { runtime, bridge, dom, unsubscribe };
  }

  function runAiSdk() {
    const session = newSession();
    const observer = createObserver({
      runtime: session.bridge,
      scopeId: "release-chat",
      getToolLabel: () => "Prepare release report",
    });
    const first = {
      id: "assistant-1",
      role: "assistant",
      parts: [{ type: "text", text: "Your release report" }],
    };
    const complete = {
      ...first,
      parts: [{ type: "text", text: "Your release report is ready to review." }],
    };
    observer.observe({ messages: [], status: "ready", error: undefined } as never);
    observer.observe({ messages: [first], status: "streaming", error: undefined } as never);
    observer.observe({ messages: [complete], status: "streaming", error: undefined } as never);
    observer.finish(complete as never, {
      isAbort: false,
      isDisconnect: false,
      isError: false,
    });
    disposeRef.current = () => {
      observer.dispose();
      session.unsubscribe();
      session.dom.dispose();
      session.runtime.dispose();
    };
  }

  function runAssistantUi() {
    const session = newSession();
    let state: { messages: readonly unknown[] } = { messages: [] };
    let notify: () => void = () => undefined;
    const thread = {
      getState: () => state,
      subscribe(listener: () => void) {
        notify = listener;
        return () => {
          notify = () => undefined;
        };
      },
    } as unknown as ThreadRuntimeSource;
    const binding = bindThreadRuntime({
      runtime: session.bridge,
      scopeId: "release-thread",
      thread,
    });
    state = {
      messages: [{
        id: "assistant-1",
        role: "assistant",
        content: [
          { type: "text", text: "Your report is ready." },
          {
            type: "tool-call",
            toolCallId: "publish-report",
            approval: { id: "publish-approval" },
          },
        ],
        status: { type: "running" },
      }],
    };
    notify();
    state = {
      messages: [{
        id: "assistant-1",
        role: "assistant",
        content: [
          { type: "text", text: "Your report is ready." },
          {
            type: "tool-call",
            toolCallId: "publish-report",
            result: { published: true },
            approval: { id: "publish-approval", approved: true },
          },
        ],
        status: { type: "complete", reason: "stop" },
      }],
    };
    notify();
    disposeRef.current = () => {
      binding.dispose();
      session.unsubscribe();
      session.dom.dispose();
      session.runtime.dispose();
    };
  }

  function select(next: Framework) {
    disposeRef.current();
    setFramework(next);
    setEvents([]);
    setAnnouncements([]);
    setDeliveries([]);
  }

  return (
    <section className="framework-showcase" aria-labelledby="framework-title">
      <div className="framework-heading">
        <div><p>Framework adapters</p><h2 id="framework-title">See what the adapters report.</h2></div>
        <p>Run installed adapters with sample AI SDK and assistant-ui data. You do not need an API key or network request.</p>
      </div>
      <div className="framework-tabs" role="tablist" aria-label="Framework">
        {(["ai-sdk", "assistant-ui"] as const).map((name) => (
          <button key={name} type="button" role="tab" aria-selected={framework === name} onClick={() => select(name)}>{name === "ai-sdk" ? "AI SDK" : "assistant-ui"}</button>
        ))}
      </div>
      <div className="framework-panel" role="tabpanel">
        <div className="framework-input">
          <span>Framework data</span>
          <h3>{framework === "ai-sdk" ? "useChat snapshots and finish callback" : "ThreadRuntime getState and subscribe"}</h3>
          <pre
            role="region"
            aria-label={`${framework} adapter code sample`}
            tabIndex={0}
          ><code>{snippets[framework]}</code></pre>
          <button type="button" onClick={framework === "ai-sdk" ? runAiSdk : runAssistantUi}>Run {framework === "ai-sdk" ? "AI SDK" : "assistant-ui"} adapter</button>
        </div>
        <div className="framework-output">
          <span>Adapter output</span>
          <ol data-testid="framework-events">
            {events.length ? events.map((event, index) => <li key={`${event.type}:${index}`}><code>{event.type}</code><small>{identity(event)}</small></li>) : <li className="empty-trace">Run the adapter to see the events it reports.</li>}
          </ol>
          <div className="framework-metrics"><span><b>{announcements.length}</b> prepared updates</span><span><b>{deliveries.length}</b> browser updates</span></div>
        </div>
      </div>
    </section>
  );
}

function identity(event: GenerativeA11yEvent) {
  if ("responseId" in event) return event.responseId;
  if ("toolId" in event) return event.toolId;
  if ("approvalId" in event) return event.approvalId;
  return "app event";
}
