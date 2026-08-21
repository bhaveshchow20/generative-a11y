import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/browser/**"],
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
