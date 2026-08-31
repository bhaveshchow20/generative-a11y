import { readFileSync, statSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { JsonLd } from "../components/json-ld";
import {
  createArticleJsonLd,
  createDocMetadata,
  createHomeJsonLd,
  createPageMetadata,
} from "../lib/seo";
import {
  absoluteUrl,
  REPOSITORY_URL,
  PROJECT_AUTHOR_NAME,
  PROJECT_AUTHOR_URL,
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
          type: "image/png",
        }),
      ]),
    );
    expect(metadata.twitter?.images).toEqual([
      {
        url: "https://generativea11y.com/og.png",
        alt: "generative-a11y: accessible AI infrastructure",
      },
    ]);

    const page = {
      path: "/docs/devtools",
      title: "Devtools",
      description: "Inspect accessibility events without exposing private data.",
    };
    expect(createDocMetadata(page).description).toBe(page.description);
    expect(createDocMetadata(page).openGraph).toEqual(
      expect.objectContaining({ type: "article" }),
    );
    expect(createHomeJsonLd()).toEqual(
      expect.objectContaining({ "@context": "https://schema.org" }),
    );
  });

  it("keeps long search titles within the recommended display length", () => {
    const title = "Why generative AI needs an accessibility runtime";
    const metadata = createPageMetadata({
      path: "/docs/why-generative-a11y",
      title,
      description:
        "Learn why streaming responses and agent lifecycle changes require accessibility behavior beyond ordinary chat patterns.",
    });

    expect(metadata.title).toEqual({ absolute: title });
  });

  it("links the project and documentation to a truthful author entity", () => {
    expect(PROJECT_AUTHOR_NAME).toBe("Bhavesh Chowdhury");
    expect(PROJECT_AUTHOR_URL).toBe("https://github.com/bhaveshchow20");

    const homeGraph = createHomeJsonLd()["@graph"] as Array<
      Record<string, unknown>
    >;
    const person = homeGraph.find((entry) => entry["@type"] === "Person");
    const software = homeGraph.find(
      (entry) => entry["@type"] === "SoftwareSourceCode",
    );
    const image = homeGraph.find((entry) => entry["@type"] === "ImageObject");

    expect(person).toEqual(
      expect.objectContaining({
        name: PROJECT_AUTHOR_NAME,
        url: PROJECT_AUTHOR_URL,
      }),
    );
    expect(software?.creator).toEqual({ "@id": `${SITE_URL}/#author` });
    expect(software?.sameAs).toEqual([
      REPOSITORY_URL,
      "https://www.npmjs.com/org/generative-a11y",
    ]);
    expect(image).toEqual(
      expect.objectContaining({
        contentUrl: "https://generativea11y.com/og.png",
      }),
    );

    const articleGraph = createArticleJsonLd({
      path: "/docs/getting-started",
      title: "Getting started",
      description:
        "Install generative-a11y and connect its accessibility runtime to an existing AI interface.",
    })["@graph"] as Array<Record<string, unknown>>;
    const article = articleGraph.find(
      (entry) => entry["@type"] === "TechArticle",
    );
    expect(article?.author).toEqual({ "@id": `${SITE_URL}/#author` });

    const apiGraph = createArticleJsonLd({
      path: "/api/core",
      title: "@generative-a11y/core",
      description: "Core API reference.",
    })["@graph"] as Array<Record<string, unknown>>;
    expect(
      apiGraph.find((entry) => entry["@id"] === `${SITE_URL}/api/core#webpage`),
    ).toEqual(expect.objectContaining({ "@type": "WebPage" }));
  });

  it("keeps the social preview within the hero-image size budget", () => {
    const socialImage = statSync(
      new URL(`../public${SOCIAL_IMAGE_PATH}`, import.meta.url),
    );

    expect(socialImage.size).toBeLessThanOrEqual(200_000);
  });

  it("matches structured breadcrumbs to the visible Docs and API hierarchy", () => {
    const docs = createArticleJsonLd({
      path: "/docs/screen-readers-and-streaming-ai",
      title: "Screen readers and streaming AI",
      description: "Understand accessible streaming behavior.",
    });
    const api = createArticleJsonLd({
      path: "/api/devtools",
      title: "Devtools",
      description: "Inspect accessibility events.",
    });
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
