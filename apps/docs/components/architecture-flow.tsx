const stages = [
  {
    label: "Your app",
    title: "Your app changes",
    detail: "A response starts, a tool runs, or an error occurs",
  },
  {
    label: "Adapter",
    title: "Adapter sends an event",
    detail: "It sends a standard event with a stable ID",
  },
  {
    label: "Runtime",
    title: "Core prepares an update",
    detail: "It chooses useful text and controls the timing",
  },
  {
    label: "Browser",
    title: "DOM updates the page",
    detail: "It uses ariaNotify or a live region",
  },
  {
    label: "Screen reader",
    title: "A screen reader may speak it",
    detail: "Test this step with the screen readers you support",
  },
] as const;

export function ArchitectureFlow() {
  return (
    <figure className="runtime-flow" aria-labelledby="runtime-flow-title">
      <div className="runtime-flow-heading">
        <strong id="runtime-flow-title">How an app update becomes a screen-reader update</strong>
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
        <span>Covered by automated tests</span>
        <span>Checked with a real screen reader</span>
      </div>
      <figcaption>
        Automated tests can confirm that the library updated the page. Test
        with real screen readers to confirm what people hear.
      </figcaption>
    </figure>
  );
}
