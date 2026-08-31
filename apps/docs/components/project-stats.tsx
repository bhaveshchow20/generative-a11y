"use client";

import { useEffect, useState } from "react";
import { siGithub, siNpm, type SimpleIcon } from "simple-icons";

const repositoryUrl = "https://github.com/bhaveshchow20/generative-a11y";
const npmUrl = "https://www.npmjs.com/org/generative-a11y";

type ProjectStats = {
  stars: number | null;
  monthlyDownloads: number | null;
};

function formatCount(value: number) {
  return new Intl.NumberFormat("en", {
    notation: value >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

function BrandIcon({ icon }: { icon: SimpleIcon }) {
  return (
    <svg
      className="project-brand-icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}

/**
 * Shows GitHub stars and the combined monthly npm downloads for published
 * packages. Until each live request succeeds, the link describes the honest
 * action available instead of presenting a bundled count as current data.
 */
export function ProjectStats({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<ProjectStats>({
    stars: null,
    monthlyDownloads: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      const response = await fetch("/project-stats.json", {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error("Project stats unavailable");
      const nextStats = (await response.json()) as ProjectStats;

      if (!controller.signal.aborted) {
        setStats({
          stars: typeof nextStats.stars === "number" ? nextStats.stars : null,
          monthlyDownloads:
            typeof nextStats.monthlyDownloads === "number"
              ? nextStats.monthlyDownloads
              : null,
        });
      }
    }

    void loadStats().catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <div className={`project-stats ${className}`.trim()}>
      <a
        className="project-stat"
        href={repositoryUrl}
        aria-label={stats.stars === null
          ? "View generative-a11y on GitHub"
          : `View generative-a11y on GitHub, ${stats.stars.toLocaleString("en")} stars`}
      >
        <BrandIcon icon={siGithub} />
        <span>GitHub</span>
        <span className="project-stat-value" aria-hidden="true">
          {stats.stars === null ? "View on GitHub" : <><span className="project-stat-icon">★</span>{formatCount(stats.stars)}</>}
        </span>
      </a>
      <a
        className="project-stat"
        href={npmUrl}
        aria-label={stats.monthlyDownloads === null
          ? "View generative-a11y packages on npm"
          : `View generative-a11y packages on npm, ${stats.monthlyDownloads.toLocaleString("en")} downloads in the last month`}
      >
        <BrandIcon icon={siNpm} />
        <span>npm</span>
        <span className="project-stat-value" aria-hidden="true">
          {stats.monthlyDownloads === null
            ? "View packages on npm"
            : formatCount(stats.monthlyDownloads)}
        </span>
      </a>
    </div>
  );
}
