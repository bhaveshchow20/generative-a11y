import { defineConfig } from "@playwright/test";

const configuredPort = process.env.AT_FIXTURE_PORT;
const port = configuredPort === undefined ? 43_123 : Number(configuredPort);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new RangeError("AT_FIXTURE_PORT must be an integer from 1 to 65535");
}

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
