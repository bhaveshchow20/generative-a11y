"use client";

import { ManualClock, type AnnouncementIntent, type AttentionOverride } from "@generative-a11y/core";
import {
  GenerativeA11yProvider,
  useGenerativeA11yAttentionControl,
  useGenerativeA11yBindings,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { attentionScenario } from "../lib/attention-scenario";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function AttentionLab() {
  const [clock] = useState(() => new ManualClock());
  return (
    <GenerativeA11yProvider
      clock={clock}
      preset="verbose"
      attentionPolicy
      policy={{
        attention: { enabled: true, quietWhen: ["background", "reading-history", "away"] },
        text: { minimumCharacters: 1, maximumDelayMs: 0 },
        tools: { announceStartAfterMs: 0 },
        minimumGapMs: 0,
      }}
      dom={{ mode: "live-region" }}
    >
      <AttentionHost clock={clock} />
    </GenerativeA11yProvider>
  );
}

function AttentionHost({ clock }: { clock: ManualClock }) {
  const interactive = useSyncExternalStore(subscribeToHydration, getClientSnapshot, getServerSnapshot);
  const runtime = useGenerativeA11yRuntime();
  const bindings = useGenerativeA11yBindings();
  const { state, setOverride } = useGenerativeA11yAttentionControl();
  const [step, setStep] = useState(0);
  const [text, setText] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementIntent[]>([]);
  useEffect(() => runtime.subscribeAnnouncements((intent) => {
    setAnnouncements((current) => [...current, intent].slice(-20));
  }), [runtime]);

  function changeOverride(mode: AttentionOverride) {
    setOverride(mode);
    clock.advanceBy(0);
  }

  function next() {
    const event = attentionScenario[step];
    if (!event) return;
    if (event.type === "response.text.delta") setText((current) => current + event.delta);
    runtime.dispatch(event);
    // Zero gap is still scheduled. Explicitly drain this host-controlled clock.
    clock.runUntilIdle();
    setStep(step + 1);
  }

  const event = attentionScenario[step];
  return (
    <section className="lab" aria-labelledby="attention-lab-title">
      <h2 id="attention-lab-title">Attention and your announcement controls</h2>
      <p>Choose Quiet before a text step, then Normal before a fresh sentence. The visible response always keeps its text. Auto follows browser observations.</p>
      <div className="lab-controls" role="group" aria-label="Announcement mode">
        {(["auto", "normal", "quiet"] as const).map((mode) => (
          <button key={mode} type="button" disabled={!interactive} aria-pressed={state.override === mode} onClick={() => changeOverride(mode)}>{mode === "auto" ? "Auto" : mode === "normal" ? "Normal" : "Quiet"}</button>
        ))}
      </div>
      <p data-testid="attention-state">Observed: {state.observed}; override: {state.override}; effective: {state.effective}</p>
      <div className="lab-grid">
        <section className="host-surface" aria-label="Attention example host interface">
          <div {...bindings.conversationProps} tabIndex={0} aria-label="Conversation history" role="region">
            <p>Earlier message: prepare a report and ask before publishing.</p>
            <article {...bindings.newestResponseProps} aria-label="Newest response"><p>{text || "The response will appear here."}</p></article>
          </div>
          <label htmlFor="attention-composer">Your message</label>
          <textarea id="attention-composer" {...bindings.composerProps} />
          <p>Next event: <code>{event?.type ?? "Scenario complete"}</code></p>
          <button type="button" disabled={!interactive || !event} onClick={next}>
            {event?.type === "interaction.resolved" ? "Approve publishing" : "Advance scenario"}
          </button>
          <p>Step {step} of {attentionScenario.length}. The host owns every visible control. The runtime never moves focus for ordinary events. The advance control is disabled when the scenario completes.</p>
        </section>
        <section className="a11y-surface" aria-label="Attention runtime intents">
          <h3>Runtime intents</h3>
          <ol className="announcement-list">{announcements.map((intent) => <li key={intent.id}><div><b>{intent.sourceType}</b><p>{intent.text}</p></div></li>)}</ol>
          <p>This trace is not a speech transcript. Verify actual announcements with assistive technology.</p>
        </section>
      </div>
    </section>
  );
}
