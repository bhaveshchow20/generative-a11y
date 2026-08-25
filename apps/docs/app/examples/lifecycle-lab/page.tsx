import type { Metadata } from "next";

import { LifecycleLab } from "../../../components/lifecycle-lab";
import { FrameworkShowcaseLoader } from "../../../components/framework-showcase-loader";
import { SiteShell } from "../../../components/site-shell";

export const metadata: Metadata = {
  title: "Interactive examples",
  description:
    "Run response, tool, retry, and approval scenarios through the generative-a11y runtime and DOM package.",
};

export default function LifecycleLabPage() {
  return (
    <SiteShell currentPath="/examples/lifecycle-lab">
      <main className="lab-page">
        <header className="lab-intro">
          <div><p className="doc-kicker"><span>Interactive examples · live package APIs</span></p><h1>See the library at work</h1></div>
          <div><p>Run common app scenarios through <code>@generative-a11y/core</code> and <code>@generative-a11y/dom</code>. Follow each app event, runtime update, and browser result.</p><p className="lab-warning"><strong>Test scope:</strong> the transcript confirms what the library added to the page. Test with a real screen reader to confirm what it speaks.</p></div>
        </header>
        <LifecycleLab />
        <FrameworkShowcaseLoader />
      </main>
    </SiteShell>
  );
}
