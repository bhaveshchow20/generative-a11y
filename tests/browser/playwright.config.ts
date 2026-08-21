import { defineConfig } from "@playwright/test";

const port = Number(process.env.AT_FIXTURE_PORT ?? 4173);

export default defineConfig({
  testDir: ".",
  testMatch: "at-fixture.spec.ts",
  fullyParallel: true,
  reporter: "line",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `node tests/browser/server.mjs --port=${port}`,
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
