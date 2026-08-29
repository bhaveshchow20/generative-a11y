import { defineConfig, defineDocs } from "fumadocs-mdx/config";

/** Guide content source used by the `/docs` route family and site search. */
export const docs = defineDocs({ dir: "content/docs" });

/** API-reference content source used by the `/api` route family and site search. */
export const api = defineDocs({ dir: "content/api" });

/** Shared Fumadocs MDX configuration for both content collections. */
export default defineConfig();
