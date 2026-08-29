import { AsyncAiGrid } from "../../components/home/async-ai-grid";
import { EvidenceGrid } from "../../components/home/evidence-grid";
import { HomeHero } from "../../components/home/home-hero";
import { HomeManifesto } from "../../components/home/home-manifesto";
import { IntegrationsGrid } from "../../components/home/integrations-grid";
import { MotionReveal } from "../../components/home/motion-reveal";
import { OpenSourceSection } from "../../components/home/open-source-section";
import { QuickStart } from "../../components/home/quick-start";
import { RuntimeLaboratory } from "../../components/home/runtime-laboratory";
import { SiteFooter } from "../../components/home/site-footer";
import { JsonLd } from "../../components/json-ld";
import { createHomeJsonLd, createPageMetadata } from "../../lib/seo";

export const metadata = createPageMetadata({
  path: "/",
  title: "generative-a11y | Accessible streaming AI",
  description:
    "Add framework-independent accessibility behavior to asynchronous AI interfaces without replacing the host application's visual UI.",
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
      <main className="home-main">
        <HomeHero />
        <MotionReveal>
          <HomeManifesto />
        </MotionReveal>
        <MotionReveal>
          <RuntimeLaboratory />
        </MotionReveal>
        <MotionReveal>
          <div className="home-section-statement" aria-hidden="true">
            <span>Make every AI state understandable.</span>
          </div>
        </MotionReveal>
        <section className="home-bento-grid" aria-label="Accessibility behavior capabilities">
          <MotionReveal className="home-bento-motion">
            <AsyncAiGrid />
          </MotionReveal>
          <MotionReveal className="home-bento-motion" delay={0.04}>
            <IntegrationsGrid />
          </MotionReveal>
          <MotionReveal className="home-bento-motion home-bento-motion-wide" delay={0.08}>
            <EvidenceGrid />
          </MotionReveal>
        </section>
        <MotionReveal>
          <QuickStart />
        </MotionReveal>
        <MotionReveal>
          <OpenSourceSection />
        </MotionReveal>
      </main>
      <SiteFooter />
    </>
  );
}
