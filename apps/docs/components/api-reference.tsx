import inventory from "../../../docs/api-inventory.json";

type Entry = keyof typeof inventory;

/** Published declaration reference; kept in sync by the repository API check. */
export function ApiReference({ entry }: { entry: Entry }) {
  return (
    <section aria-label={`${entry} public declarations`}>
      <h2>Public declarations: {entry}</h2>
      <p>
        All exported values and types for this entry point. Import these names
        from <code>{entry}</code>; the signatures below are reference material,
        not a replacement for the ownership and lifecycle guidance above.
      </p>
      {inventory[entry].map(({ name, kind, signature }) => (
        <details key={name}>
          <summary><code>{name}</code> — {kind}</summary>
          <pre className="overflow-x-auto"><code>{signature}</code></pre>
        </details>
      ))}
    </section>
  );
}
