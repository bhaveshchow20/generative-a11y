import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { docsLayoutOptions, homeLayoutOptions } from "../lib/layout.shared";

describe("documentation layout tabs", () => {
  it("offers Guides, API Reference, and Examples through the native Fumadocs tab API", () => {
    expect(docsLayoutOptions.tabs).toEqual([
      expect.objectContaining({
        title: "Guides",
        description: "Learn how to add accessible behavior to AI interfaces.",
        url: "/docs/getting-started",
      }),
      expect.objectContaining({
        title: "API Reference",
        description: "Explore every package and public API.",
        url: "/api",
      }),
      expect.objectContaining({
        title: "Examples",
        description: "Explore the lifecycle in interactive examples.",
        url: "/examples/lifecycle-lab",
      }),
    ]);
  });

  it("does not repeat the selected documentation areas in the header links", () => {
    expect(docsLayoutOptions.links.map((link) => link.text)).not.toContain("Docs");
    expect(docsLayoutOptions.links.map((link) => link.text)).not.toContain("API");
    expect(docsLayoutOptions.links.map((link) => link.text)).not.toContain("Examples");
  });
});

describe("site-wide documentation search", () => {
  it("exposes the native Fumadocs search trigger on the website", () => {
    expect(homeLayoutOptions.searchToggle).toEqual({ enabled: true });
  });

  it("connects the app provider to the shared documentation search API", async () => {
    const provider = await readFile(
      new URL("../components/layout/app-provider.tsx", import.meta.url),
      "utf8",
    );

    expect(provider).toMatch(/search=\{\{[\s\S]*enabled:\s*true/);
    expect(provider).toMatch(/api:\s*["']\/api\/search["']/);
    expect(provider).toMatch(/attribute:\s*["']class["']/);
    expect(provider).toMatch(/defaultTheme:\s*["']system["']/);
  });
});
