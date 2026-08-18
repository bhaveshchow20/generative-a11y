import { StrictMode, useState, type ReactElement } from "react";
import { createRoot } from "react-dom/client";
import {
  GenerativeA11yProvider,
  useGenerativeA11yAttention,
  useGenerativeA11yBindings,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";

function ExistingInterface(): ReactElement {
  const runtime = useGenerativeA11yRuntime();
  const attention = useGenerativeA11yAttention();
  const bindings = useGenerativeA11yBindings();
  const [transcript, setTranscript] = useState<string[]>([]);

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
      <button
        id="send-response"
        type="button"
        onClick={() => {
          const responseId = `response-${Date.now()}`;
          runtime.dispatch({ type: "response.started", responseId });
          runtime.dispatch({
            type: "response.text.delta",
            responseId,
            delta: "The existing interface is still here.",
          });
          runtime.dispatch({ type: "response.completed", responseId });
          setTranscript((items) => [
            ...items,
            "The existing interface is still here.",
          ]);
        }}
      >
        Send response
      </button>
      <p data-testid="attention">Attention mode: {attention.mode}</p>
      <output aria-label="Runtime transcript" data-testid="transcript">
        {transcript.join(" ")}
      </output>
    </main>
  );
}

function App(): ReactElement {
  return (
    <GenerativeA11yProvider preset="minimal" dom={{ mode: "live-region" }}>
      <ExistingInterface />
    </GenerativeA11yProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
