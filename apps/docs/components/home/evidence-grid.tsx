import Link from "next/link";

import { BentoCard } from "./bento-card";
import { DevtoolsPreview } from "./devtools-preview";

export function EvidenceGrid() {
  return (
    <BentoCard
      id="evidence"
      title="Debug accessibility behavior before users find the problem"
      eyebrow="Development-only trace explorer"
      size="wide"
      className="home-evidence-card"
      visual={
        <>
          <DevtoolsPreview />
          <Link className="home-text-link devtools-preview-link" href="/docs/devtools">
            Explore Devtools <span aria-hidden="true">↗</span>
          </Link>
        </>
      }
    >
      <p>
        Follow each update from source to browser delivery without exposing message content.
      </p>
    </BentoCard>
  );
}
