const packages = [
  "core",
  "dom",
  "react",
  "ag-ui",
  "ai-sdk",
  "assistant-ui",
  "devtools",
] as const;

async function githubStars(): Promise<number | null> {
  const response = await fetch(
    "https://api.github.com/repos/bhaveshchow20/generative-a11y",
    { headers: { accept: "application/vnd.github+json" } },
  );
  if (!response.ok) return null;
  const data = (await response.json()) as { stargazers_count?: unknown };
  return typeof data.stargazers_count === "number"
    ? data.stargazers_count
    : null;
}

async function npmDownloads(): Promise<number | null> {
  const results = await Promise.all(
    packages.map(async (packageName) => {
      const response = await fetch(
        `https://api.npmjs.org/downloads/point/last-month/%40generative-a11y%2F${packageName}`,
      );
      if (!response.ok) return null;
      const data = (await response.json()) as { downloads?: unknown };
      return typeof data.downloads === "number" ? data.downloads : null;
    }),
  );

  return results.every((value): value is number => value !== null)
    ? results.reduce((total, value) => total + value, 0)
    : null;
}

export async function GET() {
  const [stars, monthlyDownloads] = await Promise.all([
    githubStars().catch(() => null),
    npmDownloads().catch(() => null),
  ]);

  return Response.json(
    { stars, monthlyDownloads },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
