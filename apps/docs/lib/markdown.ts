import { apiSource, docsSource } from "./source";
import { getSourceManifest } from "./source-manifest";
import { markdownComponents } from "./markdown-components";
import { absoluteUrl, REPOSITORY_URL } from "./site";

declare const __DOCS_BUILD_CONTEXT__: {
  channel: "source";
  revision: string;
  modified: boolean | null;
  packages: Record<string, string>;
};

/** Build identity and manifest versions, not a claim of npm release parity. */
export const docsBuildContext = __DOCS_BUILD_CONTEXT__;

/** These docs track source APIs, including changes awaiting publication. */
export const sourceContext = `Documentation channel: source checkout (may include unreleased APIs).\nRepository: ${REPOSITORY_URL}\nBuild base revision: ${docsBuildContext.revision} (modified checkout: ${String(docsBuildContext.modified)}).\nSource package manifest versions (not release parity): ${Object.entries(
  docsBuildContext.packages,
)
  .map(([name, version]) => `${name}@${version}`)
  .join(
    ", ",
  )}.\nCompare your installed package version and its release tag before using these examples. Package manifest versions alone do not identify unreleased changes. See ${absoluteUrl("/docs/stability")}.`;

/** Explicit exports never select a representation using Accept or request host. */
export function markdownUrl(publicPath: string): string {
  return absoluteUrl(`/markdown${publicPath}`);
}

/** Find only canonical guide/API pages; unknown paths have no representation. */
export function findMarkdownPage(publicPath: string) {
  return [...docsSource.getPages(), ...apiSource.getPages()].find(
    (page) => page.url === publicPath,
  );
}

/** Render the same compiled content used by HTML, with machine-readable components. */
export async function getPageMarkdown(
  page: NonNullable<ReturnType<typeof findMarkdownPage>>,
): Promise<string> {
  const text = await page.data.getText("processed", {
    components: markdownComponents,
  });
  return `# ${page.data.title}\n\n${page.data.description}\n\nCanonical: ${absoluteUrl(page.url)}\nMarkdown: ${markdownUrl(page.url)}\n${sourceContext}\n\n${text.trim()}\n`;
}

/** A deterministic, finite corpus using the existing navigation/search manifest. */
export async function getMarkdownCorpus(
  collection?: "docs" | "api",
): Promise<string> {
  const entries = await getSourceManifest();
  const pages = await Promise.all(
    entries
      .filter(
        ({ publicPath }) =>
          !collection ||
          publicPath === `/${collection}` ||
          publicPath.startsWith(`/${collection}/`),
      )
      .map(async ({ publicPath }) => {
        const page = findMarkdownPage(publicPath);
        if (!page) throw new Error(`No Markdown source for ${publicPath}`);
        return getPageMarkdown(page);
      }),
  );
  return pages.join("\n---\n\n");
}

/** Cache only successful, explicit text representations. */
export function markdownResponse(
  body: string,
  contentType = "text/markdown",
  canonical?: string,
): Response {
  return new Response(body, {
    headers: {
      "content-type": `${contentType}; charset=utf-8`,
      "cache-control": "public, max-age=300, s-maxage=3600",
      ...(canonical
        ? { link: `<${absoluteUrl(canonical)}>; rel="canonical"` }
        : {}),
    },
  });
}
