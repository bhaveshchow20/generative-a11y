"use client";

import {
  createGenerativeA11y,
  type AnnouncementDiagnostic,
  type AnnouncementIntent,
  type GenerativeA11yEvent,
  type GenerativeA11yRuntime,
} from "@generative-a11y/core";
import {
  connectRuntimeToDOM,
  type DOMDeliveryResult,
  type DOMRuntimeBinding,
} from "@generative-a11y/dom";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { createScenarioSteps, type ScenarioName } from "../lib/scenarios";

interface ObservedEvent {
  readonly index: number;
  readonly at: number;
  readonly event: GenerativeA11yEvent;
  readonly label: string;
}

const scenarioLabels: Array<{ name: ScenarioName; label: string }> = [
  { name: "stream", label: "Stream a response" },
  { name: "tool-success", label: "Complete a tool" },
  { name: "tool-error", label: "Fail a tool" },
  { name: "retry", label: "Retry a response" },
  { name: "approval", label: "Request approval" },
];

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function LifecycleLab() {
  const [events, setEvents] = useState<ObservedEvent[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementIntent[]>([]);
  const [diagnostics, setDiagnostics] = useState<AnnouncementDiagnostic[]>([]);
  const [deliveries, setDeliveries] = useState<DOMDeliveryResult[]>([]);
  const [visibleText, setVisibleText] = useState("");
  const [toolState, setToolState] = useState("Idle");
  const [running, setRunning] = useState(false);
  const [pendingApproval, setPendingApproval] = useState(false);
  const interactive = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const runtimeRef = useRef<GenerativeA11yRuntime | null>(null);
  const bindingRef = useRef<DOMRuntimeBinding | null>(null);
  const timersRef = useRef<number[]>([]);
  const eventIndexRef = useRef(0);

  const disposeSession = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
    bindingRef.current?.dispose();
    bindingRef.current = null;
    runtimeRef.current?.dispose();
    runtimeRef.current = null;
  }, []);

  function reset() {
    disposeSession();
    setEvents([]);
    setAnnouncements([]);
    setDiagnostics([]);
    setDeliveries([]);
    setVisibleText("");
    setToolState("Idle");
    setRunning(false);
    setPendingApproval(false);
    eventIndexRef.current = 0;
  }

  useEffect(() => {
    return () => disposeSession();
  }, [disposeSession]);

  function createSession() {
    const runtime = createGenerativeA11y({
      preset: "verbose",
      policy: {
        text: { minimumCharacters: 1, maximumDelayMs: 0 },
        tools: { announceStartAfterMs: 0, announceProgress: true },
        minimumGapMs: 0,
      },
      onDiagnostic(diagnostic) {
        setDiagnostics((current) => [...current, diagnostic].slice(-14));
      },
    });
    runtime.subscribeAnnouncements((announcement) => {
      setAnnouncements((current) => [...current, announcement].slice(-10));
    });
    const binding = connectRuntimeToDOM(runtime, {
      mode: "live-region",
      onDiagnostic(result) {
        setDeliveries((current) => [...current, result].slice(-10));
      },
    });
    runtimeRef.current = runtime;
    bindingRef.current = binding;
    return runtime;
  }

  function updateHostState(event: GenerativeA11yEvent, appendedText?: string) {
    if (appendedText) setVisibleText((current) => current + appendedText);
    if (event.type === "tool.started") setToolState("Running");
    if (event.type === "tool.progress") {
      setToolState(`${Math.round((event.progress ?? 0) * 100)}% complete`);
    }
    if (event.type === "tool.completed") setToolState("Completed");
    if (event.type === "tool.failed") setToolState("Failed");
    if (event.type === "response.interrupted") setToolState("Response stopped");
    if (event.type === "response.retrying") {
      setVisibleText("");
      setToolState("Regenerating");
    }
    if (event.type === "interaction.requested") {
      setPendingApproval(true);
      setToolState("Awaiting approval");
    }
  }

  function dispatchObserved(
    runtime: GenerativeA11yRuntime,
    event: GenerativeA11yEvent,
    label: string,
    at: number,
    appendedText?: string,
  ) {
    updateHostState(event, appendedText);
    setEvents((current) => [
      ...current,
      { index: eventIndexRef.current++, at, event, label },
    ]);
    runtime.dispatch(event);
  }

  function runScenario(name: ScenarioName) {
    reset();
    const runtime = createSession();
    setRunning(true);
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const allSteps = createScenarioSteps(name);
    const steps = name === "approval" ? allSteps.slice(0, 2) : allSteps;
    steps.forEach((step, index) => {
      const delay = reduceMotion ? index * 30 : step.at;
      const timer = window.setTimeout(() => {
        dispatchObserved(runtime, step.event, step.label, step.at, step.visibleText);
        if (index === steps.length - 1) setRunning(false);
      }, delay);
      timersRef.current.push(timer);
    });
  }

  function stop() {
    if (!runtimeRef.current) {
      runScenario("abort");
      return;
    }
    for (const timer of timersRef.current) window.clearTimeout(timer);
    timersRef.current = [];
    dispatchObserved(
      runtimeRef.current,
      {
        type: "response.interrupted",
        responseId: "release-report",
        responseInstanceId: "attempt-1",
      },
      "Response interrupted by Stop",
      events.at(-1)?.at ?? 0,
    );
    setRunning(false);
  }

  function resolveApproval(outcome: "approved" | "rejected") {
    const runtime = runtimeRef.current;
    if (!runtime || !pendingApproval) return;
    dispatchObserved(runtime, {
      type: "interaction.resolved",
      interactionId: "publish-approval",
      kind: "approval",
      outcome,
      label: outcome === "approved" ? "Publishing approved" : "Publishing rejected",
    }, `Approval ${outcome}`, 1_200);
    dispatchObserved(runtime, outcome === "approved" ? {
      type: "tool.completed",
      toolId: "prepare-report",
      toolInstanceId: "approval-tool-1",
      label: "Publish release report",
    } : {
      type: "tool.failed",
      toolId: "prepare-report",
      toolInstanceId: "approval-tool-1",
      label: "Publish release report",
      announcement: "Publishing was cancelled.",
    }, outcome === "approved" ? "Tool completed" : "Tool cancelled", 1_700);
    setPendingApproval(false);
    setRunning(false);
  }

  return (
    <div className="lab">
      <div className="lab-controls" aria-label="Lifecycle scenarios">
        {scenarioLabels.map((scenario) => (
          <button key={scenario.name} type="button" onClick={() => runScenario(scenario.name)} disabled={!interactive || running}>
            {scenario.label}
          </button>
        ))}
        <button className="danger-control" type="button" onClick={stop} disabled={!interactive}>Stop response</button>
        <button className="quiet-control" type="button" onClick={reset} disabled={!interactive}>Reset</button>
      </div>

      <div className="lab-grid">
        <section className="host-surface" aria-labelledby="host-title">
          <div className="surface-heading">
            <span>01</span><div><p>Your app</p><h2 id="host-title">Your existing interface</h2></div>
          </div>
          <div className="existing-ui">
            <div className="user-message">Prepare a release report and ask before publishing.</div>
            <div className="assistant-message">
              <span aria-hidden="true">GA</span>
              <p>{visibleText || "Choose a scenario. Your app's response will appear here, with screen-reader updates beside it."}</p>
            </div>
            <div className="tool-row"><span>prepare_release_report</span><b>{toolState}</b></div>
            {pendingApproval ? (
              <div className="approval-card">
                <p><strong>Approval required</strong>Publish the release report?</p>
                <div><button type="button" onClick={() => resolveApproval("approved")}>Approve</button><button type="button" onClick={() => resolveApproval("rejected")}>Reject</button></div>
              </div>
            ) : null}
          </div>
          <p className="surface-caption">generative-a11y leaves this interface and its focus behavior unchanged.</p>
        </section>

        <section className="a11y-surface" aria-labelledby="a11y-title">
          <div className="surface-heading">
            <span>02</span><div><p>Accessibility layer</p><h2 id="a11y-title">Screen-reader updates</h2></div>
          </div>
          <ol className="announcement-list">
            {announcements.length ? announcements.map((announcement) => (
              <li key={announcement.id}>
                <time>{formatTime(announcement.at)}</time>
                <div><b>{announcement.sourceType}</b><p>“{announcement.text}”</p></div>
                <span data-channel={announcement.channel}>{announcement.channel}</span>
              </li>
            )) : <li className="empty-trace">Choose a scenario to see the updates.</li>}
          </ol>
          <div className="delivery-summary">
            <span>Latest browser update</span>
            <b>{deliveries.length ? `${deliveries.at(-1)?.method} · ${deliveries.at(-1)?.status}` : "Waiting"}</b>
          </div>
          <p className="surface-caption">Browser results confirm the page update. Test with a real screen reader to confirm what it speaks.</p>
        </section>
      </div>

      <section className="timeline" aria-labelledby="timeline-title">
        <div className="timeline-head"><div><p>Event timeline</p><h2 id="timeline-title">Follow each response and tool from start to finish.</h2></div><span>{events.length} events</span></div>
        <div className="timeline-scroll" role="region" aria-label="Lifecycle event timeline" tabIndex={0}>
          <table>
            <thead><tr><th scope="col">Time</th><th scope="col">Event</th><th scope="col">Identity</th><th scope="col">Observed result</th></tr></thead>
            <tbody>
              {events.length ? events.map((entry) => (
                <tr key={entry.index}>
                  <td>{formatElapsed(entry.at)}</td>
                  <td><code>{entry.event.type}</code></td>
                  <td>{eventIdentity(entry.event)}</td>
                  <td>{entry.label}</td>
                </tr>
              )) : <tr><td colSpan={4}>Choose a scenario to fill the timeline.</td></tr>}
            </tbody>
          </table>
        </div>
        <details className="diagnostics">
          <summary>Runtime diagnostics ({diagnostics.length})</summary>
          <ul>{diagnostics.map((diagnostic, index) => <li key={`${diagnostic.at}:${index}`}><code>{diagnostic.disposition}</code> · {diagnostic.reason} · {diagnostic.sourceType ?? "scheduler"}</li>)}</ul>
        </details>
      </section>
    </div>
  );
}

function eventIdentity(event: GenerativeA11yEvent): string {
  if ("responseId" in event) return `${event.responseId}${event.responseInstanceId ? ` / ${event.responseInstanceId}` : ""}`;
  if ("toolId" in event) return `${event.toolId}${event.toolInstanceId ? ` / ${event.toolInstanceId}` : ""}`;
  if ("interactionId" in event) return event.interactionId;
  if ("approvalId" in event) return event.approvalId;
  return "system";
}

function formatElapsed(at: number): string {
  return `+${(at / 1000).toFixed(2)}s`;
}

function formatTime(at: number): string {
  return new Date(at).toISOString().slice(14, 19);
}
