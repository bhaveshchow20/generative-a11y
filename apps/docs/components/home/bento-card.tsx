import type { ReactNode } from "react";

import type { HomeCardSize } from "../../lib/home-content";

interface BentoCardProps {
  readonly id: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly size?: HomeCardSize;
  readonly children: ReactNode;
  readonly visual?: ReactNode;
  readonly className?: string;
}

export function BentoCard({
  id,
  eyebrow,
  title,
  size = "md",
  children,
  visual,
  className = "",
}: BentoCardProps) {
  const titleId = `${id}-title`;
  return (
    <article
      className={`home-bento-card home-bento-${size} ${className}`.trim()}
      aria-labelledby={titleId}
    >
      <header>
        {eyebrow ? <p className="home-card-eyebrow">{eyebrow}</p> : null}
        <h2 id={titleId}>{title}</h2>
      </header>
      <div className="home-card-copy">{children}</div>
      {visual ? <div className="home-card-visual">{visual}</div> : null}
    </article>
  );
}
