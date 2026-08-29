import { createSearchAPI } from "fumadocs-core/search/server";

import { apiSource, docsSource } from "../../../lib/source";

const search = createSearchAPI("advanced", {
  indexes: [...docsSource.getPages(), ...apiSource.getPages()].map((page) => ({
    id: page.url,
    title: page.data.title,
    description: page.data.description,
    url: page.url,
    structuredData: page.data.structuredData,
  })),
});

export const GET = search.GET;
