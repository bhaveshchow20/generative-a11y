import { StrictMode, useEffect, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  GenerativeA11yProvider,
  useGenerativeA11yAttention,
  useGenerativeA11yBindings,
  useGenerativeA11yPreferences,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";
import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
} from "@generative-a11y/core";

function ExistingInterface(): ReactElement {
  const runtime = useGenerativeA11yRuntime();
  const attention = useGenerativeA11yAttention();
  const bindings = useGenerativeA11yBindings();
  const preferenceState = useGenerativeA11yPreferences();
  const [transcript, setTranscript] = useState<string[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementIntent[]>([]);
  const [diagnostics, setDiagnostics] = useState<AnnouncementDiagnostic[]>([]);

  useEffect(() => {
    const unsubscribeAnnouncements = runtime.subscribeAnnouncements(
      (announcement) =>
        setAnnouncements((items) => [...items, announcement].slice(-20)),
    );
    const unsubscribeDiagnostics = runtime.subscribeDiagnostics((diagnostic) =>
      setDiagnostics((items) => [...items, diagnostic].slice(-20)),
    );
    return () => {
      unsubscribeAnnouncements();
      unsubscribeDiagnostics();
    };
  }, [runtime]);

  const dispatchStream = (): void => {
    const responseId = `response-${Date.now()}`;
    const response = "The existing interface is still here.";
    runtime.dispatch({
      type: "response.started",
      responseId,
      locale: "en-US",
    });
    runtime.dispatch({
      type: "response.text.delta",
      responseId,
      delta: "The existing interface is still here.",
    });
    runtime.dispatch({ type: "response.completed", responseId });
    setTranscript((items) => [...items, response]);
  };

  const dispatchToolWorkflow = (): void => {
    const toolInstanceId = `tool-${Date.now()}`;
    runtime.dispatch({
      type: "tool.started",
      toolId: "weather",
      toolInstanceId,
      label: "Weather lookup",
    });
    runtime.dispatch({
      type: "tool.progress",
      toolId: "weather",
      toolInstanceId,
      label: "Weather lookup",
      progress: 0.5,
      message: "Reading forecast data",
    });
    runtime.dispatch({
      type: "tool.completed",
      toolId: "weather",
      toolInstanceId,
      label: "Weather lookup",
      summary: "Forecast ready",
    });
  };

  return (
    <main>
      <h1>Existing assistant</h1>
      <p>
        This small interface stays visually unchanged when accessibility is
        enabled.
      </p>
      <div {...bindings.conversationProps} data-testid="conversation">
        <p data-testid="message">Hello from the existing application.</p>
        <div {...bindings.newestResponseProps} data-testid="newest-response" />
      </div>
      <label>
        Message
        <textarea
          {...bindings.composerProps}
          id="composer"
          aria-label="Message"
        />
      </label>
      <button id="send-response" type="button" onClick={dispatchStream}>
        Send response
      </button>
      <section hidden data-testid="fixture-controls">
        <button
          data-testid="tool-workflow"
          type="button"
          onClick={dispatchToolWorkflow}
        >
          Run tool workflow
        </button>
        <button
          data-testid="approval-request"
          type="button"
          onClick={() =>
            runtime.dispatch({
              type: "approval.requested",
              approvalId: `approval-${Date.now()}`,
              label: "Review the generated plan",
              urgent: true,
            })
          }
        >
          Request approval
        </button>
        <button
          data-testid="response-failure"
          type="button"
          onClick={() => {
            const responseId = `failed-${Date.now()}`;
            runtime.dispatch({ type: "response.started", responseId });
            runtime.dispatch({
              type: "response.failed",
              responseId,
              error: "The service timed out",
              announcement: "The service timed out",
            });
          }}
        >
          Fail response
        </button>
        <button
          data-testid="set-completion-preference"
          type="button"
          onClick={() =>
            preferenceState.setPreferences({
              version: 1,
              preset: "completion-only",
            })
          }
        >
          Prefer completion-only
        </button>
      </section>
      <p data-testid="attention">Attention mode: {attention.mode}</p>
      <p data-testid="preference-preset">
        Preference preset: {preferenceState.preferences.preset}
      </p>
      <output aria-label="Runtime transcript" data-testid="transcript">
        {transcript.join(" ")}
      </output>
      <output aria-label="Announcement log" data-testid="announcement-log">
        {announcements.map((announcement) => announcement.text).join(" | ")}
      </output>
      <output aria-label="Diagnostic log" data-testid="diagnostic-log">
        {diagnostics.map((diagnostic) => diagnostic.reason).join(" | ")}
      </output>
    </main>
  );
}

function App(): ReactElement {
  return (
    <GenerativeA11yProvider
      preset="verbose"
      policy={{ tools: { announceStartAfterMs: 0 } }}
      dom={{ mode: "live-region" }}
      preferences={{
        defaultValue: {
          version: 1,
          preset: "verbose",
          streaming: "preset",
          tools: "preset",
        },
        persistence: { key: "generative-a11y-example" },
      }}
    >
      <ExistingInterface />
    </GenerativeA11yProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
