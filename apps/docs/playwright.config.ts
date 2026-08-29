import { defineConfig, devices } from "@playwright/test";

/**
 * Returns an integer port from 1 through 65,535, or 3001 when the value is
 * undefined, non-integer, or outside the valid TCP port range.
 */
export function resolvePlaywrightPort(value: string | undefined): number {
  const candidate = Number(value);
  return Number.isInteger(candidate) && candidate >= 1 && candidate <= 65_535
    ? candidate
    : 3001;
}

const port = resolvePlaywrightPort(process.env.DOCS_PLAYWRIGHT_PORT);
const serverUrl = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: serverUrl,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: `pnpm dev -- --port ${port}`,
    url: serverUrl,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
