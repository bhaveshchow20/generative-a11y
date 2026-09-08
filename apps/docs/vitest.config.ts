import { getDocsBuildContext } from "./lib/docs-build-context.ts";
import { fileURLToPath } from "node:url";

import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vitest/config";
import * as MdxConfig from "./source.config.ts";

export default defineConfig({
  define: { __DOCS_BUILD_CONTEXT__: JSON.stringify(getDocsBuildContext()) },
  plugins: [fumadocsMdx({ forcedConfig: MdxConfig, index: true })],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "fumadocs-mdx:collections/server": fileURLToPath(
        new URL("./.source/server.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "scripts/**/*.test.ts",
    ],
  },
});
