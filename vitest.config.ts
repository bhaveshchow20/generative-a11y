import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./packages/devtools/src", import.meta.url)),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "tests/browser/**", "apps/docs/**"],
    coverage: {
      include: ["packages/*/src/**/*.{ts,tsx}"],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 85,
        lines: 88,
        statements: 85,
      },
    },
  },
});
