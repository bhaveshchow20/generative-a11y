import { useEffect, useId, useRef, useState } from "react";
import {
  GenerativeA11yProvider,
  useGenerativeA11yBindings,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";

// These are the example host's existing operations, not a library adapter API.
export interface HostOperations {
  reply(
    prompt: string,
    options: {
      signal: AbortSignal;
      onDelta: (newText: string) => void;
    },
  ): Promise<void>;
  prepare(options: {
    signal: AbortSignal;
    onProgress: (fraction: number) => void;
  }): Promise<void>;
}

export function HostChat({ operations }: { operations: HostOperations }) {
  const runtime = useGenerativeA11yRuntime();
  const bindings = useGenerativeA11yBindings();
  const scope = useId();
  const sequence = useRef(0);
  const active = useRef<AbortController | null>(null);
  const decision = useRef<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsDecision, setNeedsDecision] = useState(false);

  useEffect(
    () => () => {
      // Abort host work; the enclosing provider owns runtime/DOM disposal.
      active.current?.abort();
      active.current = null;
    },
    [],
  );

  async function send() {
    if (active.current || decision.current || !prompt.trim()) return;
    const controller = new AbortController();
    active.current = controller;
    const id = `${scope}-${++sequence.current}`;
    const responseId = `${id}-response`;
    const toolId = `${id}-tool`;
    let stage: "response" | "tool" | "done" = "response";
    const current = () =>
      active.current === controller && !controller.signal.aborted;
    setBusy(true);
    setAnswer("");
    setStatus("Writing a reply…");
    runtime.dispatch({ type: "response.started", responseId });
    try {
      await operations.reply(prompt, {
        signal: controller.signal,
        onDelta: (delta) => {
          if (!current() || stage !== "response") return;
          setAnswer((text) => text + delta);
          runtime.dispatch({ type: "response.text.delta", responseId, delta });
        },
      });
      if (!current()) return;
      stage = "tool";
      runtime.dispatch({ type: "response.completed", responseId });
      setStatus("Preparing draft…");
      runtime.dispatch({
        type: "tool.started",
        toolId,
        label: "Prepare draft",
      });
      await operations.prepare({
        signal: controller.signal,
        onProgress: (progress) => {
          if (!current() || stage !== "tool") return;
          setStatus(`Preparing draft: ${Math.round(progress * 100)}%`);
          runtime.dispatch({
            type: "tool.progress",
            toolId,
            label: "Prepare draft",
            progress,
          });
        },
      });
      if (!current()) return;
      stage = "done";
      runtime.dispatch({
        type: "tool.completed",
        toolId,
        label: "Prepare draft",
      });
      decision.current = `${id}-decision`;
      setNeedsDecision(true);
      setStatus("Use this draft?");
      runtime.dispatch({
        type: "interaction.requested",
        interactionId: decision.current,
        kind: "confirmation",
        label: "Use this draft?",
        urgent: true,
      });
    } catch {
      if (!current()) return;
      if (stage === "response")
        runtime.dispatch({ type: "response.failed", responseId });
      else if (stage === "tool")
        runtime.dispatch({
          type: "tool.failed",
          toolId,
          label: "Prepare draft",
        });
      // Backend exceptions stay out of announcements and visible copy.
      setStatus("Could not prepare the draft. Try again.");
    } finally {
      stage = "done";
      if (current()) {
        active.current = null;
        setBusy(false);
      }
    }
  }

  function decide(outcome: "approved" | "rejected") {
    const interactionId = decision.current;
    if (!interactionId) return;
    decision.current = null;
    runtime.dispatch({
      type: "interaction.resolved",
      interactionId,
      kind: "confirmation",
      outcome,
    });
    setNeedsDecision(false);
    setStatus(outcome === "approved" ? "Draft selected." : "Draft discarded.");
  }

  return (
    <section aria-label="Draft assistant">
      <div {...bindings.conversationProps}>
        <p {...bindings.newestResponseProps}>{answer}</p>
      </div>
      <label>
        Message
        <textarea
          {...bindings.composerProps}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
      </label>
      <button
        disabled={busy || needsDecision || !prompt.trim()}
        onClick={() => void send()}
      >
        Send
      </button>
      <p>{status}</p>
      <button disabled={!needsDecision} onClick={() => decide("approved")}>
        Use draft
      </button>
      <button disabled={!needsDecision} onClick={() => decide("rejected")}>
        Discard draft
      </button>
    </section>
  );
}

export function App({ operations }: { operations: HostOperations }) {
  return (
    <GenerativeA11yProvider
      dom={{ mode: "live-region" }}
      policy={{ tools: { announceProgress: true } }}
    >
      <HostChat operations={operations} />
    </GenerativeA11yProvider>
  );
}
