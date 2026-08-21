import type { Metadata } from "next";

import { LifecycleLab } from "../../../components/lifecycle-lab";
import { FrameworkShowcaseLoader } from "../../../components/framework-showcase-loader";
import { SiteShell } from "../../../components/site-shell";

export const metadata: Metadata = {
  title: "Lifecycle lab",
  description:
    "Run streaming, tool, stop, retry, stale-response, and approval events through the real generative-a11y runtime and DOM delivery layer.",
};

export default function LifecycleLabPage() {
  return (
    <SiteShell currentPath="/examples/lifecycle-lab">
      <main className="lab-page">
        <header className="lab-intro">
          <div><p className="doc-kicker"><span>Interactive example · live package APIs</span></p><h1>Lifecycle lab</h1></div>
          <div><p>Run deterministic local scenarios through <code>@generative-a11y/core</code> and <code>@generative-a11y/dom</code>. Watch normalized events, announcement intents, delivery diagnostics, and identity without changing the host interface.</p><p className="lab-warning"><strong>Honest boundary:</strong> the transcript shows observable runtime and DOM behavior. It does not prove a screen reader spoke.</p></div>
        </header>
        <LifecycleLab />
        <FrameworkShowcaseLoader />
      </main>
    </SiteShell>
  );
}
