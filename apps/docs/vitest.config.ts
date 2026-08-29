import { fileURLToPath } from "node:url";

import { fumadocsMdx } from "fumadocs-mdx/vite";
import { defineConfig } from "vitest/config";
import * as MdxConfig from "./source.config.ts";

export default defineConfig({
  plugins: [fumadocsMdx({ forcedConfig: MdxConfig, index: true })],
  resolve: {
    alias: {
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
