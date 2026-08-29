import Link from "next/link";

import { InstallCommand } from "../install-command";
import { HeroDitherMotion } from "./hero-dither-motion";

const trace = [
  ["01", "response.started", "polite queue opened"],
  ["02", "response.text.delta", "segment buffered"],
  ["03", "tool.started", "research in progress"],
  ["04", "response.completed", "final update delivered"],
] as const;

export function HomeHero() {
  return (
    <section className="home-hero" aria-labelledby="home-hero-title">
      <div className="home-hero-atmosphere" aria-hidden="true" />
      <HeroDitherMotion />
      <div className="home-hero-copy">
        <h1 id="home-hero-title">Accessible AI, without rebuilding your interface.</h1>
        <p className="home-hero-lede">
          Framework-independent accessibility for the AI interface you already have.
        </p>
        <div className="home-hero-actions" aria-label="Get started">
          <Link className="home-button home-button-primary" href="/docs/getting-started">
            Getting started <span aria-hidden="true">↗</span>
          </Link>
          <Link className="home-button home-button-secondary" href="/examples/lifecycle-lab">
            Open lifecycle lab
          </Link>
        </div>
      </div>

      <div className="home-hero-product">
        <div className="hero-product-bar">
          <span className="hero-product-dots" aria-hidden="true"><i /><i /><i /></span>
          <span>generative-a11y / runtime</span>
        </div>
        <div className="hero-product-layout">
          <aside className="hero-product-sidebar" aria-hidden="true">
            <strong>generative-a11y</strong>
            <small>OVERVIEW</small>
            <span className="is-active">Quick start</span>
            <span>assistant-ui</span>
            <span>AG-UI</span>
          </aside>
          <div className="hero-product-document">
            <p className="hero-doc-label">RUNTIME / QUICK START</p>
            <h2>Start with the package that fits your stack.</h2>
            <div className="hero-install"><InstallCommand /></div>
            <div className="hero-trace" aria-label="Example normalized event trace">
              <div><span>event trace</span><span className="hero-live"><i /> complete</span></div>
              {trace.map(([index, event, result]) => (
                <p key={event}><b>{index}</b><code>{event}</code><span>{result}</span></p>
              ))}
            </div>
          </div>
          <aside className="hero-product-toc" aria-hidden="true">
            <small>ON THIS PAGE</small>
            <span className="is-active">Runtime</span>
            <span>Dispatch events</span>
            <span>Connect delivery</span>
            <span>Dispose cleanly</span>
          </aside>
        </div>
      </div>
    </section>
  );
}
