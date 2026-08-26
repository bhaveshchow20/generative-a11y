import Link from "next/link";
import { HeroRuntimeDemo } from "../components/hero-runtime-demo";
import { InstallCommand } from "../components/install-command";
import { ProjectStats } from "../components/project-stats";
import { JsonLd } from "../components/json-ld";
import { createHomeJsonLd, createPageMetadata } from "../lib/seo";

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

export const metadata = createPageMetadata({
  path: "/",
  title: "generative-a11y | Accessible streaming AI",
  description:
    "Add paced screen-reader announcements for streaming responses, tool calls, approvals, retries, and failures without rebuilding your AI interface.",
  keywords: [
    "AI accessibility",
    "streaming AI accessibility",
    "screen reader",
    "AI agents",
    "ARIA live region",
  ],
  absoluteTitle: true,
});

export default function Home() {
  return (
    <>
      <JsonLd data={createHomeJsonLd()} />
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
                Try live examples
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

        <section className="problem-guides" aria-labelledby="problem-guides-title">
          <div className="section-heading">
            <p className="eyebrow">Designed for asynchronous AI</p>
            <h2 id="problem-guides-title">
              Useful updates for streams, tools, and decisions.
            </h2>
          </div>
          <div className="problem-guide-grid">
            <article>
              <span>01</span>
              <h3>Streaming responses</h3>
              <p>
                Group partial output into meaningful updates instead of sending
                every token or the growing transcript to a live region.
              </p>
              <Link href="/docs/screen-readers-and-streaming-ai">
                Screen readers and streaming AI <span aria-hidden="true">→</span>
              </Link>
            </article>
            <article>
              <span>02</span>
              <h3>Agents and tool calls</h3>
              <p>
                Prioritize confirmed tool progress, approval requests,
                interruptions, failures, retries, and connection changes.
              </p>
              <Link href="/docs/accessible-ai-agents">
                Accessible AI agents <span aria-hidden="true">→</span>
              </Link>
            </article>
            <article>
              <span>03</span>
              <h3>Framework integrations</h3>
              <p>
                Connect documented lifecycle state from React, the Vercel AI
                SDK, assistant-ui, or AG-UI without replacing the host UI.
              </p>
              <p className="integration-links">
                <Link href="/docs/integrations/ai-sdk">AI SDK</Link>
                <Link href="/docs/integrations/assistant-ui">assistant-ui</Link>
                <Link href="/docs/integrations/ag-ui">AG-UI</Link>
              </p>
            </article>
          </div>
        </section>

        <section className="home-explainer" aria-labelledby="home-explainer-title">
          <div>
            <p className="eyebrow">The accessibility layer</p>
            <h2 id="home-explainer-title">
              How does generative-a11y make streaming AI accessible?
            </h2>
          </div>
          <div className="home-explainer-copy">
            <p>
              Streaming AI interfaces can change faster than a screen reader can
              present useful information. Sending each token to an ARIA live
              region creates repeated fragments, while replacing the full answer
              can make assistive technology announce growing text more than once.
              Agents add tool progress, approval requests, connection changes,
              failures, and retries that compete with response text.
            </p>
            <p>
              generative-a11y accepts confirmed lifecycle events from your app,
              groups response text into meaningful units, prioritizes status
              updates, removes duplicates, and sends bounded announcement intents
              to the DOM package. The browser layer updates live regions without
              moving focus during normal streaming or tool activity. Your visual
              interface, semantic HTML, keyboard behavior, and application state
              remain under your control. Read the{" "}
              <Link href="/docs/aria-live-and-generative-ai">
                ARIA live region guide
              </Link>{" "}
              or review the{" "}
              <Link href="/docs/why-generative-a11y">
                accessibility model
              </Link>
              .
            </p>
          </div>
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
          <p>
            <strong>Development:</strong>{" "}
            <Link href="/docs/devtools">redacted trace explorer</Link> and{" "}
            <Link href="/docs/testing/replay">deterministic replay tests</Link>.
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
