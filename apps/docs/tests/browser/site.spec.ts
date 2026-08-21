import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("homepage and representative deep links render without request or console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });

  for (const path of [
    "/",
    "/docs/getting-started",
    "/api/react/hooks",
    "/docs/integrations/ai-sdk",
    "/project/overview",
    "/examples/lifecycle-lab",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("headers use the text wordmark without a decorative logo", async ({ page }) => {
  for (const path of ["/", "/docs/getting-started"]) {
    await page.goto(path);
    await expect(page.getByRole("link", { name: "generative-a11y home" })).toBeVisible();
    await expect(page.locator(".brand-mark")).toHaveCount(0);
  }
});

test("keyboard search finds a deep link and closes after navigation", async ({ page }) => {
  await page.goto("/docs/getting-started");
  await expect(page.getByRole("button", { name: /Search documentation/ })).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+K");
  const search = page.getByRole("searchbox", { name: "Search documentation" });
  await expect(search).toBeFocused();
  await search.fill("stale response");
  await page.getByRole("dialog").getByRole("link", { name: /Stop, abort, retry/i }).click();
  await expect(page).toHaveURL(/\/docs\/lifecycle\/stop-retry$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("stale responses");
});

test("mobile navigation exposes every documentation group", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/getting-started");
  const menu = page.getByRole("button", { name: "Menu" });
  await expect(menu).toBeEnabled();
  await menu.click();
  const navigation = page.getByRole("navigation", { name: "Documentation", exact: true });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Tool lifecycle" }).click();
  await expect(page).toHaveURL(/\/docs\/lifecycle\/tools$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Tool lifecycle");
});

test("lifecycle lab uses real runtime output for streaming, stale retry, and approval", async ({ page }) => {
  await page.goto("/examples/lifecycle-lab");

  await page.getByRole("button", { name: "Run stream" }).click();
  await expect(page.getByRole("cell", { name: "response.completed" })).toBeVisible({ timeout: 5_000 });
  const announcementText = await page.locator(".announcement-list li p").allTextContents();
  expect(announcementText.some((text) => text.includes("migration completed successfully"))).toBe(true);
  expect(new Set(announcementText).size).toBe(announcementText.length);

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("cell", { name: /stale-response/ })).toBeVisible({ timeout: 4_000 });

  await page.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByText("Approval required")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByRole("cell", { name: "interaction.resolved" })).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});

test("framework showcase runs both installed framework runtimes and production adapters", async ({ page }) => {
  await page.goto("/examples/lifecycle-lab");

  await page.getByRole("button", { name: /Customer support/ }).click();
  await expect(page.getByTestId("real-framework-events")).toContainText("response.text.delta");
  await expect(page.getByTestId("real-framework-events")).toContainText("response.completed");

  await page.getByRole("tab", { name: "assistant-ui" }).click();
  await page.getByRole("button", { name: /Order operations/ }).click();
  await expect(page.getByTestId("real-framework-events")).toContainText("response.text.delta");
  await expect(page.getByTestId("real-framework-events")).toContainText("response.completed");
});

test("framework trace explains events in plain language and expands technical detail", async ({ page }) => {
  await page.goto("/examples/lifecycle-lab");
  await page.getByRole("button", { name: /Customer support/ }).click();

  const event = page.getByRole("group", { name: /Assistant response started/ }).first();
  await expect(event).toBeVisible();
  await event.getByText("Assistant response started").click();
  await expect(event).toContainText("Why it matters");
  await expect(event).toContainText("response.started");
  await expect(page.locator(".trace-guide")).toContainText("Framework state");
  await expect(page.locator(".trace-guide")).toContainText("Accessible announcement");
});

test("API reference expands option defaults and explanations", async ({ page }) => {
  await page.goto("/api/core/create-generative-a11y");
  const preset = page.locator(".api-list details").filter({ hasText: "preset" }).first();
  await preset.locator("summary").click();
  await expect(preset).toContainText("balanced");
  await expect(preset).toContainText("Selects a complete baseline policy");
  await expect(page.getByRole("heading", { name: "How this code works" }).first()).toBeVisible();
});

test("Docs and API provide separate top-level navigation and legacy reference links redirect", async ({ page }) => {
  await page.goto("/docs/getting-started");
  await page.getByRole("link", { name: "API", exact: true }).click();
  await expect(page).toHaveURL(/\/api$/);
  await expect(page.getByRole("navigation", { name: "API reference" })).toBeVisible();
  await page.getByRole("link", { name: "createGenerativeA11y" }).click();
  await expect(page).toHaveURL(/\/api\/core\/create-generative-a11y$/);

  await page.goto("/docs/api/runtime");
  await expect(page).toHaveURL(/\/api\/core\/create-generative-a11y$/);
});

test("release guidance covers integration choice, troubleshooting, and stability", async ({ page }) => {
  for (const [path, heading] of [
    ["/docs/integrations", "Choose an integration"],
    ["/docs/troubleshooting", "Troubleshooting"],
    ["/docs/stability", "Stability and migrations"],
    ["/project/overview", "Project overview"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
});

for (const path of ["/", "/docs/getting-started", "/examples/lifecycle-lab"]) {
  test(`automated accessibility scan passes on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("subtle motion is present and respects reduced-motion preferences", async ({ page }) => {
  await page.goto("/");
  const orbit = page.locator(".motion-orbit");
  await expect(orbit).toBeVisible();
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).toBe("none");

  await page.getByRole("button", { name: "Play demo", exact: true }).click();
  expect(await orbit.evaluate((element) => getComputedStyle(element).animationName)).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await orbit.evaluate((element) => getComputedStyle(element).animationDuration);
  expect(["0s", "0.00001s"]).toContain(duration);
});

test("homepage runtime trace waits for Play and exposes pause and replay controls", async ({ page }) => {
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo.getByText("Ready", { exact: true })).toBeVisible();
  await expect(demo.getByText("response.started", { exact: true })).toHaveCount(0);

  await demo.getByRole("button", { name: "Play demo", exact: true }).click();
  await expect(demo.getByText("response.started", { exact: true })).toBeVisible();
  await expect(demo.locator(".trace-list li")).toHaveCount(2, { timeout: 4_000 });

  await demo.getByRole("button", { name: "Pause demo" }).click();
  await expect(demo.getByText("Paused", { exact: true })).toBeVisible();
  const pausedEntryCount = await demo.locator(".trace-list li").count();
  await page.waitForTimeout(800);
  await expect(demo.locator(".trace-list li")).toHaveCount(pausedEntryCount);
  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(demo.getByText("Streaming", { exact: true })).toBeVisible();
  await expect(demo.getByText("response.started", { exact: true })).toBeVisible();
});
