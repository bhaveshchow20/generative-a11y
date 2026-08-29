import { asyncFeatures } from "../../lib/home-content";
import { BentoCard } from "./bento-card";

export function AsyncAiGrid() {
  return (
    <BentoCard
      id="async-ai"
      title="Built for asynchronous AI"
      eyebrow="Behavior, not replacement UI"
      size="md"
      className="home-async-card"
      visual={
        <div className="async-feature-list">
          {asyncFeatures.map((feature) => (
            <section key={feature.title} aria-labelledby={`feature-${feature.eyebrow.slice(0, 2)}`}>
              <p className="home-card-eyebrow">{feature.eyebrow}</p>
              <h3 id={`feature-${feature.eyebrow.slice(0, 2)}`}>{feature.title}</h3>
              <pre role="region" tabIndex={0} aria-label={`${feature.title} event sequence`}><code>{feature.code.join("\n")}</code></pre>
            </section>
          ))}
        </div>
      }
    >
      <p>
        One normalized vocabulary covers the work between a prompt and its
        terminal state.
      </p>
    </BentoCard>
  );
}
