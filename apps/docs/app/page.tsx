import Link from "next/link";
import { HeroRuntimeDemo } from "../components/hero-runtime-demo";
import { InstallCommand } from "../components/install-command";
import { ProjectStats } from "../components/project-stats";

const architecture = [
  "AI framework",
  "standard events",
  "announcement rules",
  "browser update",
  "screen reader",
];

const packages = ["core", "dom", "react", "ag-ui", "ai-sdk", "assistant-ui"] as const;

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
    "Add clear, well-timed screen-reader updates to any AI or agent interface.",
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
          <ProjectStats className="project-stats-home" />
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" aria-hidden="true" />
              Accessibility for AI interfaces
            </p>
            <h1>
              Accessible AI,
              <span>without rebuilding your interface.</span>
            </h1>
            <p className="lede">
              Give screen-reader users useful updates as responses stream,
              tools run, and decisions need attention.
            </p>
            <InstallCommand />
            <div className="hero-actions">
              <Link className="button button-primary" href="/docs/getting-started">
                Read the setup guide <span aria-hidden="true">→</span>
              </Link>
              <Link className="button button-secondary" href="/examples/lifecycle-lab">
                Try the live examples
              </Link>
            </div>
          </div>

          <HeroRuntimeDemo />
        </section>

        <section className="architecture" aria-labelledby="architecture-title">
          <div className="section-heading">
            <p className="eyebrow">How it works</p>
            <h2 id="architecture-title">From app event to screen-reader update.</h2>
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
            An adapter reports a response, tool, approval, or error. Core chooses
            the text and timing. DOM adds the update to the page.
          </p>
        </section>

        <section className="quick-start" aria-labelledby="quick-start-title">
          <div>
            <p className="eyebrow">Quick start</p>
            <h2 id="quick-start-title">Connect the runtime in a few lines.</h2>
            <p>
              Install core and DOM, create one runtime, and dispatch the events
              from your existing response and tool callbacks.
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
            <strong>Packages:</strong>{" "}
            {packages.map((packageName, index) => (
              <span key={packageName}>
                <a href={`https://www.npmjs.com/package/@generative-a11y/${packageName}`}>
                  {packageName}
                </a>
                {index < packages.length - 1 ? ", " : "."}
              </span>
            ))}
          </p>
          <p>
            <strong>Built for:</strong> streaming, tools, approvals, retries,
            and clear status updates.
          </p>
          <p>
            <strong>Browser matrix:</strong> Chromium, Firefox, and WebKit.
          </p>
          <p><strong>License:</strong> MIT.</p>
        </section>
      </main>

      <footer className="site-footer">
        <span>MIT licensed · TypeScript</span>
        <span>Works with any AI framework.</span>
      </footer>
    </>
  );
}
