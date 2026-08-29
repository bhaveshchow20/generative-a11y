"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { runtimeScenarios } from "./runtime-scenarios";

type PlaybackState = "ready" | "playing" | "paused" | "complete";

const playbackLabels: Record<PlaybackState, string> = {
  ready: "Ready",
  playing: "Streaming",
  paused: "Paused",
  complete: "Complete",
};

function subscribeToReducedMotion(onStoreChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onStoreChange);
  return () => query.removeEventListener("change", onStoreChange);
}

function getReducedMotionPreference() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function RuntimeLaboratory() {
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionPreference,
    () => false,
  );
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [playback, setPlayback] = useState<PlaybackState>("ready");
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
  const scenario = runtimeScenarios[scenarioIndex];

  function cancelTimer() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  useEffect(() => {
    return cancelTimer;
  }, []);

  useEffect(() => {
    cancelTimer();
    if (playback !== "playing") return;

    if (reduceMotion) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setVisibleCount(scenario.events.length);
        setPlayback("complete");
      }, 0);
      return cancelTimer;
    }
    if (visibleCount >= scenario.events.length) return;

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      const nextCount = visibleCount + 1;
      setVisibleCount(nextCount);
      const nextEvent = scenario.events[nextCount - 1];
      if (
        nextCount >= scenario.events.length ||
        (nextEvent && "terminal" in nextEvent && nextEvent.terminal)
      ) {
        setPlayback("complete");
      }
    }, visibleCount === 0 ? 80 : 620);

    return cancelTimer;
  }, [playback, reduceMotion, scenario, visibleCount]);

  function play() {
    cancelTimer();
    if (reduceMotion) {
      setVisibleCount(scenario.events.length);
      setPlayback("complete");
      return;
    }
    if (visibleCount >= scenario.events.length) setVisibleCount(0);
    setPlayback("playing");
  }

  function pause() {
    cancelTimer();
    setPlayback("paused");
  }

  function replay() {
    cancelTimer();
    setVisibleCount(reduceMotion ? scenario.events.length : 1);
    setPlayback(reduceMotion ? "complete" : "playing");
  }

  return (
    <section className="home-runtime-section" aria-labelledby="runtime-lab-title">
      <div className="home-section-heading">
        <p className="home-kicker">Observe the behavior layer</p>
        <h2 id="runtime-lab-title">Interactive runtime laboratory</h2>
        <p>Step through bounded lifecycle traces without moving focus.</p>
      </div>

      <div
        className="runtime-laboratory"
        role="region"
        aria-label="Interactive runtime trace"
        data-hydrated={hydrated ? "true" : "false"}
        data-state={playback}
      >
        <div className="runtime-toolbar">
          <label>
            <span>Scenario</span>
            <select
              value={scenario.id}
              onChange={(event) => {
                cancelTimer();
                const nextIndex = runtimeScenarios.findIndex(
                  ({ id }) => id === event.target.value,
                );
                setScenarioIndex(Math.max(0, nextIndex));
                setVisibleCount(0);
                setPlayback("ready");
              }}
            >
              {runtimeScenarios.map(({ id, label }) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </select>
          </label>
          <div className="runtime-controls" aria-label="Playback controls">
            <button type="button" onClick={play} disabled={playback === "playing"}>
              Play <span className="sr-only">demo</span>
            </button>
            <button type="button" onClick={pause} disabled={playback !== "playing"}>
              Pause <span className="sr-only">demo</span>
            </button>
            <button type="button" onClick={replay}>
              Replay <span className="sr-only">demo</span>
            </button>
          </div>
          <output className="runtime-status" aria-live="polite">
            <span aria-hidden="true" />{playbackLabels[playback]}
          </output>
        </div>

        <div className="runtime-stage">
          <div className="runtime-scenario-copy">
            <p className="runtime-sequence">scenario / {scenario.id}</p>
            <h3>{scenario.label}</h3>
            <p>{scenario.summary}</p>
            <p className="runtime-evidence"><strong>Evidence boundary.</strong> {scenario.evidence}</p>
          </div>
          <div className={`motion-orbit ${playback === "playing" ? "is-playing" : ""}`} aria-hidden="true">
            <span>event</span><span>policy</span><span>intent</span>
          </div>
          <ol className="trace-list" aria-live="off" aria-label={`${scenario.label} event trace`}>
            {visibleCount === 0 ? (
              <>
                <li className="trace-placeholder" aria-hidden="true"><span>01</span><code>response.started</code><span>waiting for playback</span></li>
                <li className="trace-placeholder" aria-hidden="true"><span>02</span><code>response.text.delta</code><span>bounded segment</span></li>
                <li className="trace-placeholder" aria-hidden="true"><span>03</span><code>response.completed</code><span>terminal flush</span></li>
              </>
            ) : null}
            <AnimatePresence initial={false}>
              {scenario.events.slice(0, visibleCount).map((event, index) => (
                <motion.li
                  key={event.id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={reduceMotion ? { duration: 0 } : { duration: 0.22 }}
                >
                  <span className="trace-index">{String(index + 1).padStart(2, "0")}</span>
                  <code>{event.type}</code>
                  <span>{event.detail}</span>
                  {"terminal" in event && event.terminal ? <b>terminal</b> : null}
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        </div>
      </div>
    </section>
  );
}
