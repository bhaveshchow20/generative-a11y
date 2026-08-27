import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const responsiveViewports = [
  { width: 320, height: 800 },
  { width: 360, height: 800 },
  { width: 375, height: 812 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 },
  { width: 640, height: 360 },
  { width: 768, height: 1024 },
  { width: 820, height: 1180 },
  { width: 844, height: 390 },
  { width: 900, height: 900 },
  { width: 1024, height: 768 },
  { width: 1280, height: 800 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
] as const;

const representativeResponsivePages = [
  "/",
  "/docs/getting-started",
  "/docs/integrations/ai-sdk",
  "/api/core/create-generative-a11y",
  "/examples/lifecycle-lab",
] as const;

test.beforeEach(async ({ page }) => {
  await page.route("https://api.github.com/**", async (route) => {
    await route.fulfill({ json: { stargazers_count: 1 } });
  });
  await page.route("https://api.npmjs.org/**", async (route) => {
    await route.fulfill({ json: { downloads: 544 } });
  });
});

test("homepage and representative deep links render without request or console errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    if (response.status() >= 400)
      errors.push(`${response.status()} ${response.url()}`);
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

test("headers use the text wordmark without a decorative logo", async ({
  page,
}) => {
  for (const path of ["/", "/docs/getting-started"]) {
    await page.goto(path);
    await expect(
      page.getByRole("link", { name: "generative-a11y home" }),
    ).toBeVisible();
    await expect(page.locator(".brand-mark")).toHaveCount(0);
  }
});

test("hero install control selects a package and copies its npm command", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const copiedCommands: string[] = [];
    Object.defineProperty(window, "__copiedInstallCommands", {
      configurable: true,
      value: copiedCommands,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          copiedCommands.push(value);
        },
      },
    });
  });
  await page.goto("/");

  const installer = page.getByRole("group", { name: "Install a package" });
  const packageSelect = installer.getByRole("combobox", { name: "Package" });
  await expect(
    installer.getByText("npm install @generative-a11y/", { exact: true }),
  ).toBeVisible();
  await expect(packageSelect).toHaveText("core");
  await expect(installer).toHaveAttribute(
    "data-command",
    "npm install @generative-a11y/core",
  );

  await packageSelect.click();
  const packageList = installer.getByRole("listbox", { name: "Package" });
  await expect(packageList).toBeVisible();
  await expect(
    packageList.getByRole("option", { name: "core" }),
  ).toHaveAttribute("aria-selected", "true");
  await packageList.getByRole("option", { name: "dom" }).click();
  await expect(packageList).toHaveCount(0);
  await expect(packageSelect).toHaveText("dom");
  await expect(installer).toHaveAttribute(
    "data-command",
    "npm install @generative-a11y/dom",
  );
  await installer.getByRole("button", { name: "Copy install command" }).click();
  await expect(installer.getByRole("status")).toHaveText(
    "Copied npm install @generative-a11y/dom",
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __copiedInstallCommands?: string[] })
          .__copiedInstallCommands,
    ),
  ).toEqual(["npm install @generative-a11y/dom"]);
});

test("keyboard search finds a deep link and closes after navigation", async ({
  page,
}) => {
  await page.goto("/docs/getting-started");
  await expect(
    page.getByRole("button", { name: /Search documentation/ }),
  ).toBeEnabled();
  await page.keyboard.press("ControlOrMeta+K");
  const search = page.getByRole("searchbox", { name: "Search documentation" });
  await expect(search).toBeFocused();
  await search.fill("stale response");
  await page
    .getByRole("dialog")
    .getByRole("link", { name: /Stop, abort, retry/i })
    .click();
  await expect(page).toHaveURL(/\/docs\/lifecycle\/stop-retry$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "stale responses",
  );
});

test("mobile navigation exposes every documentation group", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/getting-started");
  const menu = page.getByRole("button", {
    name: /Open documentation navigation/,
  });
  await expect(menu).toBeEnabled();
  await menu.click();
  const navigation = page.getByRole("navigation", {
    name: "Documentation",
    exact: true,
  });
  await expect(navigation).toBeVisible();
  await navigation.getByRole("link", { name: "Tool lifecycle" }).click();
  await expect(page).toHaveURL(/\/docs\/lifecycle\/tools$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Tool lifecycle",
  );
});

test("representative pages never create page-level horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const viewport of responsiveViewports) {
    await page.setViewportSize(viewport);
    for (const path of representativeResponsivePages) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(
        dimensions.scrollWidth,
        `${path} overflowed at ${viewport.width}x${viewport.height}`,
      ).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test("wide homepage sections share the centered content rail", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/");

  const sectionBounds = await page
    .locator(
      ".hero, .problem-guides, .home-explainer, .quick-start, .truth-strip",
    )
    .evaluateAll((sections) =>
      sections.map((section) => {
        const bounds = section.getBoundingClientRect();
        return { left: bounds.left, width: bounds.width };
      }),
    );

  expect(sectionBounds).toHaveLength(5);
  for (const bounds of sectionBounds) {
    expect(bounds.width).toBe(sectionBounds[0]?.width);
    expect(bounds.left).toBe(sectionBounds[0]?.left);
  }
});

test("wide documentation content scrolls locally on phones", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");

  const code = page.locator(".doc-code pre").filter({ hasText: "createGenerativeA11y" }).first();
  const table = page.locator(".table-wrap");
  await expect(code).toBeVisible();
  await expect(table).toBeVisible();
  expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await table.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("mobile documentation drawer contains section switching and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");

  const menu = page.getByRole("button", { name: /Open documentation navigation/ });
  await menu.click();
  const drawer = page.getByRole("dialog", { name: "Documentation navigation" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Docs", exact: true })).toBeVisible();
  await expect(drawer.getByRole("link", { name: "API", exact: true })).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  await page.keyboard.press("Escape");
  await expect(drawer).toHaveCount(0);
  await expect(menu).toBeFocused();
});

test("search opened from mobile navigation returns focus to the menu trigger", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");

  const menu = page.getByRole("button", { name: /Open documentation navigation/ });
  await menu.click();
  const currentPageLink = page
    .getByRole("dialog", { name: "Documentation navigation" })
    .getByRole("link", { name: "Getting started" });
  await currentPageLink.focus();
  await expect(currentPageLink).toBeFocused();

  await page.keyboard.press("ControlOrMeta+K");
  await expect(page.getByRole("searchbox", { name: "Search documentation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
});

test("search remains reachable from the mobile documentation header", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");

  const trigger = page.getByRole("button", { name: "Search documentation" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole("searchbox", { name: "Search documentation" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("primary mobile controls provide comfortable touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const control of await page
    .locator(
      ".install-package-trigger, .install-copy, .demo-controls button:visible",
    )
    .all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/docs/getting-started");
  for (const control of await page
    .locator(".docs-header button:visible, .doc-code-header button")
    .all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/examples/lifecycle-lab");
  for (const control of await page.locator(".lab-controls button").all()) {
    const box = await control.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});

test("hydrated framework examples stay contained on phones and tablets", async ({
  page,
}) => {
  test.setTimeout(60_000);
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/examples/lifecycle-lab");
    await expect(
      page.getByRole("heading", { name: "See the adapter inside a working chat." }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(page.locator(".real-example-panel")).toBeVisible();
  }
});

test("mobile navigation and responsive pages pass automated accessibility scans", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  for (const path of ["/", "/docs/getting-started", "/examples/lifecycle-lab"]) {
    await page.goto(path);
    if (path.startsWith("/docs")) {
      await page
        .getByRole("button", { name: /Open documentation navigation/ })
        .click();
    }
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  }
});

test("lifecycle lab uses real runtime output for streaming, stale retry, and approval", async ({
  page,
}) => {
  await page.goto("/examples/lifecycle-lab");

  await page.getByRole("button", { name: "Stream a response" }).click();
  await expect(
    page.getByRole("cell", { name: "response.completed" }),
  ).toBeVisible({ timeout: 10_000 });
  const announcementText = await page
    .locator(".announcement-list li p")
    .allTextContents();
  expect(
    announcementText.some((text) =>
      text.includes("migration completed successfully"),
    ),
  ).toBe(true);
  expect(new Set(announcementText).size).toBe(announcementText.length);

  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("cell", { name: /stale-response/ })).toBeVisible({
    timeout: 4_000,
  });

  await page.getByRole("button", { name: "Request approval" }).click();
  await expect(page.getByText("Approval required")).toBeVisible();
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(
    page.getByRole("cell", { name: "interaction.resolved" }),
  ).toBeVisible();
  await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});

test("framework showcase runs both installed framework runtimes and production adapters", async ({
  page,
}) => {
  await page.goto("/examples/lifecycle-lab");

  await page.getByRole("button", { name: /Customer support/ }).click();
  await expect(page.getByTestId("real-framework-events")).toContainText(
    "response.text.delta",
  );
  await expect(page.getByTestId("real-framework-events")).toContainText(
    "response.completed",
  );

  await page.getByRole("tab", { name: "assistant-ui" }).click();
  await page.getByRole("button", { name: /Order operations/ }).click();
  await expect(page.getByTestId("real-framework-events")).toContainText(
    "response.text.delta",
  );
  await expect(page.getByTestId("real-framework-events")).toContainText(
    "response.completed",
  );
});

test("framework trace explains events in plain language and expands technical detail", async ({
  page,
}) => {
  await page.goto("/examples/lifecycle-lab");
  await page.getByRole("button", { name: /Customer support/ }).click();

  const event = page
    .getByRole("group", { name: /Response started/ })
    .first();
  await expect(event).toBeVisible();
  await event.getByText("Response started").click();
  await expect(event).toContainText("Why it matters");
  await expect(event).toContainText("response.started");
  await expect(page.locator(".trace-guide")).toContainText("App change");
  await expect(page.locator(".trace-guide")).toContainText(
    "Screen-reader update",
  );
});

test("API reference expands option defaults and explanations", async ({
  page,
}) => {
  await page.goto("/api/core/create-generative-a11y");
  const preset = page
    .locator(".api-list details")
    .filter({ hasText: "preset" })
    .first();
  await preset.locator("summary").click();
  await expect(preset).toContainText("balanced");
  await expect(preset).toContainText("Selects a complete baseline policy");
  await expect(
    page.getByRole("heading", { name: "How this code works" }).first(),
  ).toBeVisible();
});

test("Docs and API provide separate top-level navigation and legacy reference links redirect", async ({
  page,
}) => {
  await page.goto("/docs/getting-started");
  await page.getByRole("link", { name: "API", exact: true }).click();
  await expect(page).toHaveURL(/\/api$/);
  await expect(
    page.getByRole("navigation", { name: "API reference" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "createGenerativeA11y" }).click();
  await expect(page).toHaveURL(/\/api\/core\/create-generative-a11y$/);

  await page.goto("/docs/api/runtime");
  await expect(page).toHaveURL(/\/api\/core\/create-generative-a11y$/);
});

test("release guidance covers integration choice, troubleshooting, and stability", async ({
  page,
}) => {
  for (const [path, heading] of [
    ["/docs/integrations", "Choose an integration"],
    ["/docs/troubleshooting", "Troubleshooting"],
    ["/docs/stability", "Stability and migrations"],
    ["/project/overview", "Project overview"],
  ] as const) {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: heading }),
    ).toBeVisible();
  }
});

for (const path of ["/", "/docs/getting-started", "/examples/lifecycle-lab"]) {
  test(`automated accessibility scan passes on ${path}`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("subtle motion is present and respects reduced-motion preferences", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo).toHaveAttribute("data-hydrated", "true");
  const orbit = page.locator(".motion-orbit");
  await expect(orbit).toBeVisible();
  expect(
    await orbit.evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");

  await page.getByRole("button", { name: "Play demo", exact: true }).click();
  expect(
    await orbit.evaluate((element) => getComputedStyle(element).animationName),
  ).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await orbit.evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  expect(["0s", "0.00001s"]).toContain(duration);
});

test("homepage runtime trace waits for Play and exposes pause and replay controls", async ({
  page,
}) => {
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo).toHaveAttribute("data-hydrated", "true");
  await expect(demo.getByText("Ready", { exact: true })).toBeVisible();
  await expect(demo.getByText("response.started", { exact: true })).toHaveCount(
    0,
  );

  await demo.getByRole("button", { name: "Play demo", exact: true }).click();
  await expect(
    demo.getByText("response.started", { exact: true }),
  ).toBeVisible();
  await expect(demo.locator(".trace-list li")).toHaveCount(2, {
    timeout: 4_000,
  });

  await demo.getByRole("button", { name: "Pause demo" }).click();
  await expect(demo.getByText("Paused", { exact: true })).toBeVisible();
  const pausedEntryCount = await demo.locator(".trace-list li").count();
  await page.waitForTimeout(800);
  await expect(demo.locator(".trace-list li")).toHaveCount(pausedEntryCount);
  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(demo.getByText("Streaming", { exact: true })).toBeVisible();
  await expect(
    demo.getByText("response.started", { exact: true }),
  ).toBeVisible();
});
