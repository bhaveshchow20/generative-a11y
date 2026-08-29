import Link from "next/link";

const example = `import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const delivery = connectRuntimeToDOM(runtime);

runtime.dispatch({ type: "response.started", responseId: "response-1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "response-1",
  delta: "A complete sentence.",
});
runtime.dispatch({ type: "response.completed", responseId: "response-1" });

delivery.dispose();
runtime.dispose();`;

export function QuickStart() {
  return (
    <section className="home-quick-start" aria-labelledby="quick-start-title">
      <div className="home-section-heading">
        <p className="home-kicker">From event to delivery</p>
        <h2 id="quick-start-title">Start with the runtime.</h2>
        <p>Install Core, connect DOM delivery, and dispatch only observable events.</p>
        <pre
          className="home-static-install"
          role="region"
          tabIndex={0}
          aria-label="Core install command"
        ><code>npm install @generative-a11y/core</code></pre>
        <Link className="home-text-link" href="/docs/getting-started">
          Read the getting started guide <span aria-hidden="true">↗</span>
        </Link>
      </div>
      <div className="home-code-frame">
        <div><span>core + dom</span><span>verified minimal path</span></div>
        <pre role="region" tabIndex={0} aria-label="Core and DOM quick start code"><code>{example}</code></pre>
      </div>
    </section>
  );
}
