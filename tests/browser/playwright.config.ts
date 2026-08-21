import { defineConfig } from "@playwright/test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const browserTestRoot = dirname(fileURLToPath(import.meta.url));

const configuredPort = process.env.AT_FIXTURE_PORT;
const port = configuredPort === undefined ? 43_123 : Number(configuredPort);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError("AT_FIXTURE_PORT must be an integer from 1 to 65535");
}

export default defineConfig({
  testDir: ".",
  testMatch: "at-fixture.spec.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  outputDir: resolve(browserTestRoot, "test-results"),
  reporter: process.env.CI
    ? [
        ["line"],
        [
          "html",
          {
            open: "never",
            outputFolder: resolve(browserTestRoot, "playwright-report"),
          },
        ],
      ]
    : "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node server.mjs --port=${port}`,
    url: `http://127.0.0.1:${port}/examples/at-fixture/`,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
