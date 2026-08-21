import Link from "next/link";
import { HeroRuntimeDemo } from "../components/hero-runtime-demo";
import { InstallCommand } from "../components/install-command";

const architecture = [
  "AI framework",
  "normalized events",
  "core policy",
  "DOM delivery",
  "assistive technology",
];

const quickStart = `import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const delivery = connectRuntimeToDOM(runtime);

runtime.dispatch({
  type: "response.started",
  responseId: "response-1",
});`;

export const metadata = {
  title: "generative-a11y | Accessible AI infrastructure",
  description:
    "Paced, framework-independent accessibility delivery for streaming AI and agent interfaces.",
};

export default function Home() {
  return (
    <>
      <header className="site-header">
        <Link className="brand" href="/" aria-label="generative-a11y home">
          generative-a11y
        </Link>
        <nav className="top-nav" aria-label="Primary navigation">
          <Link href="/docs/getting-started">Docs</Link>
          <Link href="/api">API</Link>
          <Link href="/examples/lifecycle-lab">Examples</Link>
          <a href="https://github.com/bhaveshchow20/generative-a11y">
            GitHub <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" aria-hidden="true" />
              Accessibility infrastructure for agent interfaces
            </p>
            <h1>
              Accessible AI,
              <span>without rebuilding your interface.</span>
            </h1>
            <p className="lede">
              A framework-independent layer that turns streaming responses,
              tools, approvals, and failures into paced announcement intents,
              while your existing UI stays exactly where it is.
            </p>
            <InstallCommand />
            <div className="hero-actions">
              <Link className="button button-primary" href="/docs/getting-started">
                Get started <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary" href="/examples/lifecycle-lab">
                Run the lifecycle lab
              </Link>
            </div>
          </div>

          <HeroRuntimeDemo />
        </section>

        <section className="architecture" aria-labelledby="architecture-title">
          <div className="section-heading">
            <p className="eyebrow">One narrow layer</p>
            <h2 id="architecture-title">Policy where your framework stops.</h2>
          </div>
          <ol className="architecture-flow">
            {architecture.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
          <p className="architecture-copy">
            Framework lifecycle state is translated into serializable events.
            Core policy segments, prioritizes, deduplicates, and schedules.
            Browser delivery remains a separate, observable boundary.
          </p>
        </section>

        <section className="quick-start" aria-labelledby="quick-start-title">
          <div>
            <p className="eyebrow">Five-minute integration</p>
            <h2 id="quick-start-title">Keep the interface. Add the layer.</h2>
            <p>
              Install core plus one delivery package, create a runtime, and
              dispatch lifecycle evidence your application already has.
            </p>
            <Link className="text-link" href="/docs/getting-started">
              Read Getting Started <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="code-frame">
            <div className="code-title">
              <span>TypeScript</span>
              <span>framework-neutral</span>
            </div>
            <pre>
              <code>{quickStart}</code>
            </pre>
          </div>
        </section>

        <section className="truth-strip" aria-label="Available packages">
          <p>
            <strong>Packages:</strong> core, DOM, React, AG-UI, AI SDK, and
            assistant-ui.
          </p>
          <p>
            <strong>Built for:</strong> streaming, tools, approvals, retries,
            and honest delivery evidence.
          </p>
          <p>
            <strong>Browser matrix:</strong> Chromium, Firefox, and WebKit.
          </p>
          <p>
            <strong>Release evidence:</strong> automated checks plus manual
            assistive-technology evidence.
          </p>
        </section>
      </main>

      <footer className="site-footer">
        <span>MIT licensed · TypeScript</span>
        <span>Built for evidence, not assumptions.</span>
      </footer>
    </>
  );
}
