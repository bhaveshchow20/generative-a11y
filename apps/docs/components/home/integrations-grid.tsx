import Link from "next/link";

import { BentoCard } from "./bento-card";

const supportedStacks = ["AI SDK", "assistant-ui", "AG-UI", "React"] as const;

export function IntegrationsGrid() {
  return (
    <BentoCard
      id="integrations"
      title="Add accessibility without starting over"
      eyebrow="Keep your UI"
      size="md"
      className="home-integrations-card"
      visual={
        <div className="adapter-showcase">
          <div className="adapter-stack">
            <p>Works with your stack</p>
            <div className="adapter-stack-list">
              {supportedStacks.map((stack) => <span key={stack}>{stack}</span>)}
            </div>
          </div>
          <div className="adapter-outcome">
            <p>One behavior layer</p>
            <strong>Make asynchronous AI easier to follow.</strong>
            <span>Clear updates for streams, tools, approvals, and completion.</span>
          </div>
          <Link className="home-text-link adapter-showcase-link" href="/docs/integrations">
            Choose your integration <span aria-hidden="true">↗</span>
          </Link>
        </div>
      }
    >
      <p>
        Connect generative-a11y to the AI stack and interface you already use.
      </p>
    </BentoCard>
  );
}
