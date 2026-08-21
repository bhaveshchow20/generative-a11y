const stages = [
  {
    label: "Host evidence",
    title: "Framework state",
    detail: "Public lifecycle and stable IDs",
  },
  {
    label: "Translation",
    title: "Normalized events",
    detail: "Serializable facts, no UI parsing",
  },
  {
    label: "Policy",
    title: "Core runtime",
    detail: "Segment, prioritize, dedupe, schedule",
  },
  {
    label: "Delivery",
    title: "DOM result",
    detail: "ariaNotify or owned live region",
  },
  {
    label: "Observation",
    title: "Assistive technology",
    detail: "Recorded through manual testing",
  },
] as const;

export function ArchitectureFlow() {
  return (
    <figure className="runtime-flow" aria-labelledby="runtime-flow-title">
      <div className="runtime-flow-heading">
        <strong id="runtime-flow-title">Accessibility runtime flow</strong>
        <span>Read left to right</span>
      </div>
      <ol>
        {stages.map((stage, index) => (
          <li key={stage.title}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <small>{stage.label}</small>
            <strong>{stage.title}</strong>
            <p>{stage.detail}</p>
          </li>
        ))}
      </ol>
      <div className="runtime-flow-evidence" aria-hidden="true">
        <span>Automated evidence boundary</span>
        <span>Manual observation</span>
      </div>
      <figcaption>
        Tests can follow evidence through the observable DOM result. What a
        person heard remains a separate, dated assistive-technology observation.
      </figcaption>
    </figure>
  );
}
