import { fromMarkdown } from "mdast-util-from-markdown";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import inventory from "../../../docs/api-inventory.json";
import { GET as full } from "../app/llms-full.txt/route";
import { GET as index } from "../app/llms.txt/route";
import { GET as pageRoute } from "../app/markdown/[...slug]/route";
import { docsSource, apiSource } from "../lib/source";
import {
  docsBuildContext,
  getPageMarkdown,
  getMarkdownCorpus,
} from "../lib/markdown";
import { getSourceManifest } from "../lib/source-manifest";

const pages = [...docsSource.getPages(), ...apiSource.getPages()];

describe("machine-readable documentation", () => {
  it("covers the existing manifest and preserves every authored code block", async () => {
    const manifest = await getSourceManifest();
    expect(new Set(manifest.map((page) => page.publicPath))).toEqual(
      new Set(pages.map((page) => page.url)),
    );
    for (const page of pages) {
      const body = await getPageMarkdown(page);
      const collection = page.url.startsWith("/docs") ? "docs" : "api";
      const source = await readFile(
        new URL(`../content/${collection}/${page.path}`, import.meta.url),
        "utf8",
      );
      for (const match of source.matchAll(/^```[^\n]*\n([\s\S]*?)\n```/gm)) {
        expect(body.includes(match[1]), `${page.url}: code fidelity`).toBe(
          true,
        );
      }
      // Check outside fenced examples: JSX inside an example must survive.
      const prose = body.replace(/^```[^\n]*\n[\s\S]*?^```/gm, "");
      expect(prose, page.url).not.toMatch(
        /<(?:ApiReference|TypeTable|Steps?|Callout|table|span|div)\b|export const (?:sourceMetadata|searchableText)|prettier-ignore|import \{ ApiReference/,
      );
      expect(body).toContain(
        `Canonical: https://generativea11y.com${page.url}`,
      );
      expect(body).toContain(
        `Markdown: https://generativea11y.com/markdown${page.url}`,
      );
      expect(body.match(/^# /gm), page.url).toHaveLength(1);
    }
  });

  it("includes every inventory entry's direct declarations in the full corpus", async () => {
    const body = await (await full()).text();
    for (const [entry, declarations] of Object.entries(inventory)) {
      expect(body.includes(`Public declarations: ${entry}`), entry).toBe(true);
      for (const { signature } of declarations)
        expect(body.includes(signature), signature.slice(0, 80)).toBe(true);
    }
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(1_500_000);
  });

  it("renders property tables, native tables, links and callout content", async () => {
    const ai = await getPageMarkdown(
      pages.find((page) => page.url === "/api/ai-sdk/use-chat-accessibility")!,
    );
    expect(ai).toContain(
      "| Property | Type | Required | Default | Description |",
    );
    expect(ai).toContain("Pick<Runtime, 'dispatch'>");
    expect(ai).toContain("Receives adapter events while remaining under your app's control.");
    const core = await getPageMarkdown(
      pages.find((page) => page.url === "/api/core")!,
    );
    expect(core).toMatch(
      /\| Category \| Exports \| Reference \|\n\| --- \| --- \| --- \|/,
    );
    expect(core).toContain(
      "| Runtime | createRuntime, Runtime | /api/core/create-runtime |",
    );
    const landing = await getPageMarkdown(
      pages.find((page) => page.url === "/api")!,
    );
    expect(landing).toContain("[@generative-a11y/core](/api/core)");
    expect(landing).not.toContain("<a ");
    const start = await getPageMarkdown(
      pages.find((page) => page.url === "/docs/getting-started")!,
    );
    expect(start).toContain("**Evidence and testing note**");
    const overview = await getPageMarkdown(
      pages.find((page) => page.url === "/docs/project/overview")!,
    );
    expect(overview).toContain("[stability and migrations](/docs/stability)");
    expect(core).not.toMatch(/\|\n\n\|/);
  });

  it("keeps generic types as code when Markdown is parsed", async () => {
    const body = await getPageMarkdown(
      pages.find((page) => page.url === "/api/devtools")!,
    );
    const row = body
      .split("\n")
      .find((line) => line.startsWith("| copyText |"));
    expect(row).toBeTruthy();
    const parsed = JSON.stringify(fromMarkdown(row!));
    expect(parsed).toContain('"type":"inlineCode"');
    expect(parsed).toContain("Promise<void>");
    expect(parsed).not.toContain('"type":"html"');
  });

  it("provides canonical per-page links in a bounded index and partitioned corpora", async () => {
    const body = await (await index()).text();
    for (const page of pages)
      expect(body).toContain(`https://generativea11y.com/markdown${page.url})`);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(25_000);
    const docs = await getMarkdownCorpus("docs");
    const api = await getMarkdownCorpus("api");
    expect(docs).not.toMatch(/^Canonical: https:\/\/generativea11y.com\/api/m);
    expect(api).not.toMatch(/^Canonical: https:\/\/generativea11y.com\/docs/m);
    expect((docs + api).match(/^Canonical:/gm)).toHaveLength(pages.length);
  });

  it("returns real 404s and representation-independent headers", async () => {
    for (const path of ["docs/integrations/custom", "api", "api/core"]) {
      const responses = await Promise.all(
        ["text/html", "text/markdown"].map((accept) =>
          pageRoute(
            new Request(`https://preview.invalid/markdown/${path}`, {
              headers: { accept },
            }),
            { params: Promise.resolve({ slug: path.split("/") }) },
          ),
        ),
      );
      expect(await responses[0].text()).toBe(await responses[1].text());
      expect(responses[0].status).toBe(200);
      expect(responses[0].headers.get("content-type")).toBe(
        "text/markdown; charset=utf-8",
      );
      expect(responses[0].headers.get("cache-control")).toBe(
        "public, max-age=300, s-maxage=3600",
      );
      expect(responses[0].headers.get("link")).toBe(
        `<https://generativea11y.com/${path}>; rel="canonical"`,
      );
    }
    for (const slug of [
      ["docs", "missing"],
      ["api", "missing"],
      ["llms.txt"],
      ["docs", "packages", "core"],
    ]) {
      const response = await pageRoute(new Request("https://preview.invalid"), {
        params: Promise.resolve({ slug }),
      });
      expect(response.status).toBe(404);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("labels source context even when manifest versions equal published versions", async () => {
    expect(docsBuildContext.channel).toBe("source");
    expect(docsBuildContext.packages["@generative-a11y/core"]).toBe(
      JSON.parse(
        await readFile(
          new URL("../../../packages/core/package.json", import.meta.url),
          "utf8",
        ),
      ).version,
    );
    const body = await getPageMarkdown(pages[0]);
    expect(body).toContain("may include unreleased APIs");
    expect(body).toContain(docsBuildContext.revision);
    expect(body).toContain("not release parity");
  });
});
