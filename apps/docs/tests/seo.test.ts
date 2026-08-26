import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "../components/json-ld";
import { getDocPage } from "../lib/content";
import {
  createArticleJsonLd,
  createDocMetadata,
  createHomeJsonLd,
  createPageMetadata,
} from "../lib/seo";
import {
  absoluteUrl,
  REPOSITORY_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE_PATH,
} from "../lib/site";

describe("site metadata contracts", () => {
  it("uses the monochrome Focus mark for the browser favicon", () => {
    const favicon = readFileSync(
      new URL("../public/favicon.svg", import.meta.url),
      "utf8",
    );

    expect(favicon).toContain('fill="#111111"');
    expect(favicon).toContain('stroke="#ffffff"');
    expect(favicon).toContain('fill="#8b8b8b"');
    expect(favicon).toContain('cx="32" cy="32" r="6"');
    expect(favicon).not.toMatch(/#(?:68c4ff|0c79d8|2e9eff)/i);
  });

  it("resolves canonical site paths without changing the configured origin", () => {
    expect(SITE_URL).toBe("https://generativea11y.com");
    expect(SITE_NAME).toBe("generative-a11y");
    expect(SITE_DESCRIPTION).toMatch(/streaming AI/i);
    expect(REPOSITORY_URL).toMatch(/github\.com\/bhaveshchow20/);
    expect(SOCIAL_IMAGE_PATH).toBe("/og.png");
    expect(absoluteUrl("/docs/getting-started")).toBe(
      "https://generativea11y.com/docs/getting-started",
    );
  });

  it("builds canonical social metadata for general and documentation pages", () => {
    const metadata = createPageMetadata({
      path: "/docs/example",
      title: "Example",
      description: "A sufficiently detailed description for an example page.",
    });
    expect(metadata.alternates?.canonical).toBe(
      "https://generativea11y.com/docs/example",
    );
    expect(metadata.openGraph?.images).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          url: "https://generativea11y.com/og.png",
        }),
      ]),
    );

    const page = getDocPage("/docs/devtools")!;
    expect(createDocMetadata(page).description).toBe(page.description);
    expect(createHomeJsonLd()).toEqual(
      expect.objectContaining({ "@context": "https://schema.org" }),
    );
  });

  it("matches structured breadcrumbs to the visible Docs and API hierarchy", () => {
    const docs = createArticleJsonLd(
      getDocPage("/docs/screen-readers-and-streaming-ai")!,
    );
    const api = createArticleJsonLd(getDocPage("/api/devtools")!);
    const docsBreadcrumbs = (
      docs["@graph"] as Array<Record<string, unknown>>
    ).find((entry) => entry["@type"] === "BreadcrumbList")!;
    const apiBreadcrumbs = (
      api["@graph"] as Array<Record<string, unknown>>
    ).find((entry) => entry["@type"] === "BreadcrumbList")!;

    expect(docsBreadcrumbs.itemListElement).toEqual([
      expect.objectContaining({ position: 1, name: SITE_NAME, item: SITE_URL }),
      expect.objectContaining({
        position: 2,
        name: "Docs",
        item: "https://generativea11y.com/docs/getting-started",
      }),
      expect.objectContaining({ position: 3 }),
    ]);
    expect(apiBreadcrumbs.itemListElement).toEqual([
      expect.objectContaining({ position: 1, name: SITE_NAME, item: SITE_URL }),
      expect.objectContaining({
        position: 2,
        name: "API",
        item: "https://generativea11y.com/api",
      }),
      expect.objectContaining({ position: 3 }),
    ]);
  });

  it("escapes script-closing text inside serialized JSON-LD", () => {
    const html = renderToStaticMarkup(
      createElement(JsonLd, { data: { value: "</script><script>unsafe" } }),
    );

    expect(html).toContain("\\u003c/script>\\u003cscript>unsafe");
    expect(html).not.toContain("</script><script>unsafe");
  });
});
