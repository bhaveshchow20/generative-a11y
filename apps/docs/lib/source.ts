import { loader } from "fumadocs-core/source";
import { api, docs } from "fumadocs-mdx:collections/server";

export const docsSource = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});

export const apiSource = loader({
  baseUrl: "/api",
  source: api.toFumadocsSource(),
});
