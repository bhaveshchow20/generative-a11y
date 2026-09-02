import { readdir, readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/project-stats.json/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("project stats endpoint", () => {
  it("includes every published workspace package", async () => {
    const packagesDirectory = new URL("../../../packages/", import.meta.url);
    const packageDirectories = await readdir(packagesDirectory, {
      withFileTypes: true,
    });
    const expectedPackages = (
      await Promise.all(
        packageDirectories
          .filter((entry) => entry.isDirectory())
          .map(async (entry) => {
            const manifest = JSON.parse(
              await readFile(
                new URL(`${entry.name}/package.json`, packagesDirectory),
                "utf8",
              ),
            ) as { name: string; private?: boolean };

            return manifest.private ? undefined : manifest.name.split("/").at(-1);
          }),
      )
    )
      .filter((name): name is string => name !== undefined)
      .sort();

    const route = await readFile(
      new URL("../app/project-stats.json/route.ts", import.meta.url),
      "utf8",
    );
    const configuredPackages = route
      .match(/const packages = \[([^\]]+)\]/u)?.[1]
      .match(/"([^"]+)"/gu)
      ?.map((name) => name.slice(1, -1))
      .sort();

    expect(configuredPackages).toEqual(expectedPackages);
  });

  it("preserves GitHub stars when an npm request rejects", async () => {
    let githubRequest: Request | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const request = new Request(input, init);
        const url = new URL(request.url);
        if (url.hostname === "api.github.com") {
          githubRequest = request;
          return Response.json({ stargazers_count: 12 });
        }
        if (url.pathname.endsWith("%2Fdom")) throw new Error("npm unavailable");
        return Response.json({ downloads: 10 });
      }),
    );

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      stars: 12,
      monthlyDownloads: null,
    });
    expect(githubRequest?.headers.get("user-agent")).toBe(
      "generative-a11y.com",
    );
    expect(githubRequest?.headers.get("x-github-api-version")).toBe(
      "2022-11-28",
    );
  });

  it("preserves npm downloads when the GitHub request rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : input);
        if (url.hostname === "api.github.com") {
          throw new Error("GitHub unavailable");
        }
        return Response.json({ downloads: 10 });
      }),
    );

    const response = await GET();

    await expect(response.json()).resolves.toEqual({
      stars: null,
      monthlyDownloads: 70,
    });
  });
});
