import type { Metadata } from "next";
import Link from "next/link";

import { LifecycleLab } from "../../../components/lifecycle-lab";
import { FrameworkShowcaseLoader } from "../../../components/framework-showcase-loader";
import { SiteShell } from "../../../components/site-shell";
import { JsonLd } from "../../../components/json-ld";
import { createPageMetadata } from "../../../lib/seo";
import { absoluteUrl } from "../../../lib/site";

export const metadata: Metadata = createPageMetadata({
  path: "/examples/lifecycle-lab",
  title: "Interactive examples",
  description:
    "Run response, tool, retry, and approval scenarios through the generative-a11y runtime and DOM package.",
});

export default function LifecycleLabPage() {
  return (
    <SiteShell currentPath="/examples/lifecycle-lab">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          headline: "Accessible AI lifecycle examples",
          description:
            "Interactive examples of paced screen-reader announcements for streaming responses, tool execution, approval, failure, and retry states.",
          mainEntityOfPage: absoluteUrl("/examples/lifecycle-lab"),
        }}
      />
      <main className="lab-page">
        <header className="lab-intro">
          <div><p className="doc-kicker"><span>Interactive examples · live package APIs</span></p><h1>See the library at work</h1></div>
          <div><p>Run common app scenarios through <code>@generative-a11y/core</code> and <code>@generative-a11y/dom</code>. Follow each app event, runtime update, and browser result.</p><p className="lab-warning"><strong>Test scope:</strong> the transcript confirms what the library added to the page. Test with a real screen reader to confirm what it speaks.</p></div>
        </header>
        <section className="lab-guide" aria-labelledby="lab-guide-title">
          <div className="lab-guide-heading">
            <p className="doc-kicker"><span>Server-rendered guide</span></p>
            <h2 id="lab-guide-title">What the lifecycle lab demonstrates</h2>
            <p>
              Each scenario dispatches public events through{" "}
              <code>@generative-a11y/core</code> and delivers the resulting
              announcement intents with <code>@generative-a11y/dom</code>.
            </p>
          </div>
          <div className="lab-guide-grid">
            <article>
              <h3>Streaming response</h3>
              <p>Partial text becomes paced updates instead of token-by-token announcements.</p>
            </article>
            <article>
              <h3>Tool execution</h3>
              <p>Confirmed tool progress and results receive concise status updates tied to one tool identity.</p>
            </article>
            <article>
              <h3>Approval request</h3>
              <p>A request for user input receives higher priority while routine activity leaves focus unchanged.</p>
            </article>
            <article>
              <h3>Failure and retry</h3>
              <p>Failure, retry, stop, and stale-response events remain attached to the response that produced them.</p>
            </article>
          </div>
          <p className="lab-guide-links">
            <Link href="/docs/getting-started">Set up the packages</Link>
            <Link href="/api/core">Read the core API</Link>
            <a href="https://github.com/bhaveshchow20/generative-a11y/tree/main/apps/docs">
              View source on GitHub
            </a>
          </p>
        </section>
        <LifecycleLab />
        <FrameworkShowcaseLoader />
      </main>
    </SiteShell>
  );
}
