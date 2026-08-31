import Link from "next/link";

import { NPM_SCOPE_URL, REPOSITORY_URL } from "../../lib/site";

const internalLinks = [
  ["Docs", "/docs/getting-started"],
  ["API", "/api"],
  ["Examples", "/examples/lifecycle-lab"],
  ["Why it exists", "/docs/why-generative-a11y"],
  ["Streaming AI", "/docs/screen-readers-and-streaming-ai"],
  ["ARIA live regions", "/docs/aria-live-and-generative-ai"],
  ["AI agents", "/docs/accessible-ai-agents"],
] as const;

export function SiteFooter() {
  return (
    <footer className="home-footer">
      <div className="home-footer-inner">
        <div>
          <p className="home-footer-title">generative-a11y</p>
          <p>
            Open-source accessibility infrastructure for asynchronous AI
            interfaces.
          </p>
        </div>
        <nav aria-label="Footer navigation">
          {internalLinks.map(([label, href]) => (
            <Link href={href} key={href}>
              {label}
            </Link>
          ))}
          <a href={REPOSITORY_URL} rel="noreferrer" target="_blank">
            GitHub <span aria-hidden="true">↗</span>
          </a>
          <a href={NPM_SCOPE_URL} rel="noreferrer" target="_blank">
            npm <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </footer>
  );
}
