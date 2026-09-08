import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { markdownOptions } from "./lib/markdown-options.ts";

/** Guide content source used by the `/docs` route family and site search. */
export const docs = defineDocs({
  dir: "content/docs",
  docs: { postprocess: { includeProcessedMarkdown: markdownOptions } },
});

/** API-reference content source used by the `/api` route family and site search. */
export const api = defineDocs({
  dir: "content/api",
  docs: { postprocess: { includeProcessedMarkdown: markdownOptions } },
});

/** Shared Fumadocs MDX configuration for both content collections. */
export default defineConfig();
