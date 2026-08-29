"use client";

import { useRef, useState, type KeyboardEvent } from "react";

const traces = [
  {
    id: "response-started",
    time: "+0.00s",
    label: "Response started",
    status: "Observed",
    summary: "A new response was confirmed by the connected adapter.",
    decision: "Opened one bounded, polite update queue.",
    browser: "Nothing announced yet.",
    redaction: "Message text hidden",
  },
  {
    id: "streaming-update",
    time: "+0.42s",
    label: "Streaming update",
    status: "Merged",
    summary: "A partial update joined work already waiting in the queue.",
    decision: "Held incomplete text to avoid repetitive updates.",
    browser: "No extra DOM update.",
    redaction: "Stream content hidden",
  },
  {
    id: "response-complete",
    time: "+1.18s",
    label: "Response complete",
    status: "Delivered",
    summary: "The final meaningful update was ready for delivery.",
    decision: "Completion flushed the remaining useful message.",
    browser: "Polite live region updated.",
    redaction: "Sensitive payload omitted",
  },
] as const;

export function DevtoolsPreview() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = traces[selectedIndex];

  function select(index: number) {
    const nextIndex = (index + traces.length) % traces.length;
    setSelectedIndex(nextIndex);
    buttonRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      select(index + 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      select(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(traces.length - 1);
    }
  }

  return (
    <div className="devtools-preview">
      <div className="devtools-preview-bar">
        <span>Accessibility trace</span>
        <span><i aria-hidden="true" /> Live session</span>
      </div>
      <div className="devtools-preview-workbench">
        <div className="devtools-trace-list" role="tablist" aria-label="Accessibility trace records">
          {traces.map((trace, index) => (
            <button
              key={trace.id}
              ref={(element) => { buttonRefs.current[index] = element; }}
              id={`devtools-tab-${trace.id}`}
              type="button"
              role="tab"
              aria-selected={selectedIndex === index}
              aria-controls={`devtools-panel-${trace.id}`}
              tabIndex={selectedIndex === index ? 0 : -1}
              onClick={() => setSelectedIndex(index)}
              onKeyDown={(event) => handleKeyDown(event, index)}
            >
              <time>{trace.time}</time>
              <span>
                <strong>{trace.label}</strong>
                <small>{trace.status}</small>
              </span>
              <b aria-hidden="true">›</b>
            </button>
          ))}
        </div>
        <div
          className="devtools-trace-detail"
          id={`devtools-panel-${selected.id}`}
          role="tabpanel"
          aria-labelledby={`devtools-tab-${selected.id}`}
          tabIndex={0}
        >
          <p>{selected.status}</p>
          <h3>{selected.label}</h3>
          <span>{selected.summary}</span>
          <dl>
            <div><dt>Why</dt><dd>{selected.decision}</dd></div>
            <div><dt>Browser</dt><dd>{selected.browser}</dd></div>
            <div><dt>Privacy</dt><dd>{selected.redaction}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}
