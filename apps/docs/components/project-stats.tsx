"use client";

import { useEffect, useState } from "react";
import { siGithub, siNpm, type SimpleIcon } from "simple-icons/icons";

const repositoryUrl = "https://github.com/bhaveshchow20/generative-a11y";
const npmUrl = "https://www.npmjs.com/org/generative-a11y";
const packages = ["core", "dom", "react", "ag-ui", "ai-sdk", "assistant-ui"];

type ProjectStats = {
  stars: number;
  monthlyDownloads: number;
};

const currentStats: ProjectStats = {
  stars: 1,
  monthlyDownloads: 544,
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
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={icon.path} />
    </svg>
  );
}

export function ProjectStats({ className = "" }: { className?: string }) {
  const [stats, setStats] = useState<ProjectStats>(currentStats);

  useEffect(() => {
    const controller = new AbortController();

    async function loadStats() {
      const githubRequest = fetch(
        "https://api.github.com/repos/bhaveshchow20/generative-a11y",
        { signal: controller.signal },
      )
        .then(async (response) => {
          if (!response.ok) throw new Error("GitHub stats unavailable");
          return (await response.json()) as { stargazers_count?: number };
        })
        .then((data) => data.stargazers_count);

      const npmRequest = Promise.all(
        packages.map(async (packageName) => {
          const response = await fetch(
            `https://api.npmjs.org/downloads/point/last-month/%40generative-a11y%2F${packageName}`,
            { signal: controller.signal },
          );
          if (!response.ok) throw new Error("npm stats unavailable");
          const data = (await response.json()) as { downloads?: number };
          return data.downloads ?? 0;
        }),
      ).then((counts) => counts.reduce((total, count) => total + count, 0));

      const [github, npm] = await Promise.allSettled([githubRequest, npmRequest]);

      if (!controller.signal.aborted) {
        setStats({
          stars:
            github.status === "fulfilled" && github.value !== undefined
              ? github.value
              : currentStats.stars,
          monthlyDownloads:
            npm.status === "fulfilled" ? npm.value : currentStats.monthlyDownloads,
        });
      }
    }

    void loadStats();
    return () => controller.abort();
  }, []);

  return (
    <div className={`project-stats ${className}`.trim()}>
      <a
        className="project-stat"
        href={repositoryUrl}
        aria-label={`View generative-a11y on GitHub, ${stats.stars.toLocaleString("en")} stars`}
      >
        <BrandIcon icon={siGithub} />
        <span>GitHub</span>
        <span className="project-stat-value" aria-hidden="true">
          <span className="project-stat-icon">★</span>
          {formatCount(stats.stars)}
        </span>
      </a>
      <a
        className="project-stat"
        href={npmUrl}
        aria-label={`View generative-a11y packages on npm, ${stats.monthlyDownloads.toLocaleString("en")} downloads in the last month`}
      >
        <BrandIcon icon={siNpm} />
        <span>npm</span>
        <span className="project-stat-value" aria-hidden="true">
          {formatCount(stats.monthlyDownloads)}
          <span className="project-stat-period">/mo</span>
        </span>
      </a>
    </div>
  );
}
