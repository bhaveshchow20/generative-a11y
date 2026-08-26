"use client";

import {
  createGenerativeA11y,
  type GenerativeA11yRuntime,
} from "@generative-a11y/core";
import { useCallback, useEffect, useRef, useState } from "react";

interface TraceEntry {
  readonly id: number;
  readonly time: string;
  readonly label: string;
  readonly identity?: string;
}

const responseChunks = [
  "Your release report ",
  "summarizes three outcomes. ",
  "First, the migration ",
  "completed successfully.",
] as const;

type PlaybackState = "ready" | "streaming" | "paused" | "complete";

export function HeroRuntimeDemo() {
  const [visibleText, setVisibleText] = useState("");
  const [trace, setTrace] = useState<TraceEntry[]>([]);
  const [state, setState] = useState<PlaybackState>("ready");
  const [delivery, setDelivery] = useState("Press Play to run the visual trace");
  const timers = useRef<number[]>([]);
  const demoElement = useRef<HTMLElement | null>(null);
  const runtime = useRef<GenerativeA11yRuntime | null>(null);
  const generation = useRef(0);
  const entryId = useRef(0);

  const clearRun = useCallback(() => {
    generation.current += 1;
    for (const timer of timers.current) window.clearTimeout(timer);
    timers.current = [];
    runtime.current?.dispose();
    runtime.current = null;
  }, []);

  const start = useCallback(() => {
    clearRun();
    const currentGeneration = generation.current;
    entryId.current = 0;
    setVisibleText("");
    setTrace([]);
    setDelivery("Runtime started");
    setState("streaming");

    const addTrace = (label: string, time: string, identity?: string) => {
      if (generation.current !== currentGeneration) return;
      setTrace((current) => [...current, { id: entryId.current++, time, label, identity }].slice(-5));
    };

    const nextRuntime = createGenerativeA11y({
      preset: "verbose",
      policy: {
        text: { minimumCharacters: 1, maximumDelayMs: 0 },
        tools: { announceStartAfterMs: 0, announceProgress: false },
        minimumGapMs: 0,
      },
      onAnnouncement(intent) {
        if (generation.current !== currentGeneration) return;
        addTrace(`“${intent.text}”`, formatSeconds(intent.at));
        setDelivery(`${intent.channel} announcement prepared`);
      },
    });
    runtime.current = nextRuntime;

    const schedule = (delay: number, action: () => void) => {
      const timer = window.setTimeout(() => {
        if (generation.current === currentGeneration) action();
      }, delay);
      timers.current.push(timer);
    };

    schedule(100, () => {
      addTrace("response.started", "00:00", "response:release-report");
      nextRuntime.dispatch({ type: "response.started", responseId: "release-report" });
    });
    responseChunks.forEach((delta, index) => schedule(650 + index * 500, () => {
      setVisibleText((current) => current + delta);
      nextRuntime.dispatch({ type: "response.text.delta", responseId: "release-report", delta });
    }));
    schedule(2_900, () => {
      addTrace("tool.started", "00:03", "tool:validate-report");
      nextRuntime.dispatch({ type: "tool.started", toolId: "validate-report", label: "Validate report" });
    });
    schedule(3_800, () => {
      addTrace("tool.completed", "00:04", "tool:validate-report");
      nextRuntime.dispatch({ type: "tool.completed", toolId: "validate-report", label: "Validate report", summary: "Report validation completed" });
    });
    schedule(4_800, () => {
      addTrace("response.completed", "00:05", "response:release-report");
      nextRuntime.dispatch({ type: "response.completed", responseId: "release-report" });
      setState("complete");
    });
  }, [clearRun]);

  useEffect(() => {
    demoElement.current?.setAttribute("data-hydrated", "true");
    return clearRun;
  }, [clearRun]);

  function pause() {
    clearRun();
    setState("paused");
  }

  return (
    <section ref={demoElement} className="hero-demo" data-state={state} aria-label="Interactive runtime trace">
      <div className="demo-toolbar">
        <span className="trace-title"><i className="motion-orbit" aria-hidden="true"><i /></i>Runtime trace</span>
        <div className="demo-controls">
          <span className="demo-running" data-state={state}><i aria-hidden="true" />{playbackLabel(state)}</span>
          {state === "streaming" ? <button type="button" onClick={pause} aria-label="Pause demo">Pause</button> : <button type="button" onClick={start} aria-label="Play demo">Play</button>}
          <button type="button" onClick={start} aria-label="Replay demo">Replay</button>
        </div>
      </div>
      <div className="demo-body">
        <div className="host-preview">
          <p className="panel-label">Existing application UI</p>
          <p key={visibleText || "idle"} className={visibleText ? "streaming-copy" : undefined}>{visibleText || "Your assistant response will stream here while the library leaves this interface unchanged."}</p>
          <div className={`stream-caret${state === "streaming" ? " is-active" : ""}`} aria-hidden="true" />
        </div>
        <div className="delivery-preview">
          <p className="panel-label">Screen-reader updates</p>
          <ol className="trace-list" aria-live="off">
            {trace.length ? trace.map((entry) => <li className="trace-entry" key={entry.id}><time>{entry.time}</time><span>{entry.label}</span>{entry.identity ? <b>{entry.identity}</b> : null}</li>) : <li className="trace-empty"><time>00:00</time><span>Press Play to begin</span></li>}
          </ol>
          <p className="delivery-result"><span>Latest result</span><b key={delivery}>{delivery}</b></p>
        </div>
      </div>
      <p className="evidence-note">This trace shows each update core prepares. Test with a real screen reader to confirm what it speaks.</p>
    </section>
  );
}

function formatSeconds(at: number) {
  return `00:${String(Math.min(99, Math.floor(at / 1_000))).padStart(2, "0")}`;
}

function playbackLabel(state: PlaybackState) {
  if (state === "streaming") return "Streaming";
  if (state === "complete") return "Complete";
  if (state === "paused") return "Paused";
  return "Ready";
}
