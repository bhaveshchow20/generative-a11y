import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

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

const representativeThemePages = [
  "/",
  "/docs/getting-started",
  "/api/core/create-generative-a11y",
  "/examples/lifecycle-lab",
  "/docs/project/overview",
] as const;

async function readSurfacePalette(surface: Locator) {
  return surface.evaluate((element) => {
    type Rgba = [number, number, number, number];
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas color parsing is unavailable");

    const parseColor = (color: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return [...context.getImageData(0, 0, 1, 1).data] as Rgba;
    };
    const composite = (foreground: Rgba, background: Rgba): Rgba => {
      const foregroundAlpha = foreground[3] / 255;
      const backgroundAlpha = background[3] / 255;
      const alpha = foregroundAlpha + backgroundAlpha * (1 - foregroundAlpha);
      const channel = (index: 0 | 1 | 2) =>
        alpha === 0
          ? 0
          : (foreground[index] * foregroundAlpha +
              background[index] * backgroundAlpha * (1 - foregroundAlpha)) /
            alpha;
      return [channel(0), channel(1), channel(2), alpha * 255];
    };
    const luminance = ([red, green, blue]: Rgba) => {
      const channels = [red, green, blue].map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
    };

    const ancestors: Element[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      ancestors.push(current);
    }
    let background: Rgba = [255, 255, 255, 255];
    for (const ancestor of ancestors.reverse()) {
      background = composite(
        parseColor(getComputedStyle(ancestor).backgroundColor),
        background,
      );
    }
    const foreground = composite(
      parseColor(getComputedStyle(element).color),
      background,
    );
    const backgroundLuminance = luminance(background);
    const foregroundLuminance = luminance(foreground);

    return {
      backgroundLuminance,
      foregroundLuminance,
      contrast:
        (Math.max(backgroundLuminance, foregroundLuminance) + 0.05) /
        (Math.min(backgroundLuminance, foregroundLuminance) + 0.05),
    };
  });
}

async function waitForThemeControls(page: Page) {
  const themeToggle = page.locator("[data-theme-toggle]").first();
  const buttons = themeToggle.locator("button");
  await expect(buttons).toHaveCount(3);
  await expect
    .poll(() =>
      buttons
        .first()
        .evaluate((button) => typeof (button as HTMLButtonElement).onclick),
    )
    .toBe("function");
}

function appAxe(page: Page) {
  return new AxeBuilder({ page })
    .exclude(".docs-site #nd-toc")
    .exclude(".docs-site #nd-subnav")
    .exclude(".docs-site [data-toc-popover] > header")
    .exclude('.docs-site figure [role="region"]');
}

test.beforeEach(async ({ page }) => {
  await page.route("**/project-stats.json", async (route) => {
    await route.fulfill({
      json: { stars: 1, monthlyDownloads: 3_808 },
    });
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
    "/docs/project/overview",
    "/examples/lifecycle-lab",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await waitForThemeControls(page);
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

test("documentation route families use native Fumadocs title typography", async ({
  page,
}) => {
  for (const path of [
    "/docs/getting-started",
    "/api",
    "/examples/lifecycle-lab",
  ]) {
    await page.goto(path);
    const title = page.locator("h1").first();
    await expect(title).toBeVisible();

    const size = await title.evaluate((element) =>
      Number.parseFloat(window.getComputedStyle(element).fontSize),
    );
    expect(size, path).toBeGreaterThanOrEqual(24);
    expect(size, path).toBeLessThanOrEqual(36);
  }
});

test("documentation uses one native navigation hierarchy and a working sidebar collapse", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);

  await expect(page.locator("#nd-sidebar").getByText("Getting started", { exact: true })).toHaveCount(1);

  const sidebar = page.locator("#nd-sidebar");
  await sidebar.getByRole("button", { name: "Collapse Sidebar" }).click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "true");
  await page
    .locator('[data-sidebar-panel] button[aria-label="Collapse Sidebar"]')
    .click();
  await expect(sidebar).toHaveAttribute("data-collapsed", "false");
});

test("documentation has a clean canvas without legacy center lines or dark outlines", async ({
  page,
}) => {
  for (const path of ["/docs/getting-started", "/api", "/examples/lifecycle-lab"]) {
    await page.goto(path);
    expect(await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundImage)).toBe("none");
    expect(
      await page.locator(".docs-site").evaluate((element) =>
        getComputedStyle(element).getPropertyValue("--color-fd-border").trim(),
      ),
    ).toBe("transparent");
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
  await expect(
    installer.getByRole("button", { name: "Copy install command" }),
  ).toBeEnabled();

  await packageSelect.click();
  const packageList = page.getByRole("listbox", { name: "Package" });
  await expect(packageList).toBeVisible();
  await packageList
    .getByRole("option", { name: "@generative-a11y/dom" })
    .click();
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

test("hero install control keeps its command and actions aligned", async ({
  page,
}) => {
  await page.goto("/");

  const installer = page.getByRole("group", { name: "Install a package" });
  const shell = installer.locator(".install-command-shell");
  const prefix = installer.locator(".install-prefix");
  const packageSelect = installer.getByRole("combobox", { name: "Package" });
  const copy = installer.getByRole("button", { name: "Copy install command" });
  const copyIcon = copy.locator("svg");
  const copyLabel = copy.locator("span");

  const [shellBox, prefixBox, selectBox, copyBox, iconBox, labelBox] =
    await Promise.all(
      [shell, prefix, packageSelect, copy, copyIcon, copyLabel].map((locator) =>
        locator.boundingBox(),
      ),
    );

  expect([shellBox, prefixBox, selectBox, copyBox, iconBox, labelBox].every(Boolean)).toBe(
    true,
  );
  expect((prefixBox?.x ?? 0) + (prefixBox?.width ?? 0)).toBeLessThanOrEqual(
    (selectBox?.x ?? 0) + 1,
  );
  expect((selectBox?.x ?? 0) + (selectBox?.width ?? 0)).toBeLessThanOrEqual(
    (copyBox?.x ?? 0) + 1,
  );
  expect((copyBox?.x ?? 0) + (copyBox?.width ?? 0)).toBeLessThanOrEqual(
    (shellBox?.x ?? 0) + (shellBox?.width ?? 0) + 1,
  );
  expect(
    Math.abs(
      (iconBox?.y ?? 0) + (iconBox?.height ?? 0) / 2 -
        ((labelBox?.y ?? 0) + (labelBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(2);
  await expect(copyIcon).toHaveCSS("fill", "none");
  await expect(copyIcon).not.toHaveCSS("stroke", "none");
});

test("homepage dropdowns open and update their content", async ({ page }) => {
  await page.goto("/");

  const packageSelect = page.getByRole("combobox", { name: "Package" });
  const scenarioSelect = page.getByRole("combobox", { name: "Scenario" });

  expect(await scenarioSelect.evaluate((element) => element.tagName)).toBe(
    "BUTTON",
  );
  await expect(scenarioSelect).toHaveClass(/install-package-trigger/);
  await expect(
    page.getByRole("button", { name: "Copy install command" }),
  ).toBeEnabled();

  await packageSelect.click();
  const packageList = page.getByRole("listbox", { name: "Package" });
  await expect(packageList).toBeVisible();
  await packageList
    .getByRole("option", { name: "@generative-a11y/assistant-ui" })
    .click();
  await expect(
    page.getByRole("group", { name: "Install a package" }),
  ).toHaveAttribute(
    "data-command",
    "npm install @generative-a11y/assistant-ui",
  );

  await scenarioSelect.click();
  const scenarioList = page.getByRole("listbox", { name: "Scenario" });
  await expect(scenarioList).toBeVisible();
  await expect(scenarioList.locator("..")).toHaveClass(/install-package-menu/);
  await scenarioList.getByRole("option", { name: "Approval" }).click();
  await expect(
    page.getByRole("region", { name: "Interactive runtime trace" }),
  ).toContainText("Approval");
});

test("interactive cues use subtle hairlines without outlining content cards", async ({
  page,
}) => {
  await page.goto("/");
  await waitForThemeControls(page);

  const github = page.getByRole("link", {
    name: "View generative-a11y on GitHub, 1 stars",
  });
  const npm = page.getByRole("link", {
    name: /View generative-a11y packages on npm,/
  });
  const statBoxes = await Promise.all([github, npm].map((link) => link.boundingBox()));

  expect(statBoxes.every(Boolean)).toBe(true);
  expect(Math.abs((statBoxes[0]?.y ?? 0) - (statBoxes[1]?.y ?? 0))).toBeLessThan(1);
  for (const link of [github, npm]) {
    await expect(link).toHaveCSS("border-top-width", "1px");
    expect(
      await link.evaluate((element) => getComputedStyle(element).borderTopColor),
    ).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
  }

  await expect(page.locator(".home-bento-card").first()).toHaveCSS(
    "border-top-width",
    "0px",
  );

  await page.goto("/docs/getting-started");
  const search = page.locator("[data-search-full]");
  const nextPage = page.locator(
    'article a[href="/docs/integrations/ai-sdk"]',
  );
  for (const control of [search, nextPage]) {
    await expect(control).toHaveCSS("border-top-width", "1px");
    expect(
      await control.evaluate(
        (element) => getComputedStyle(element).borderTopColor,
      ),
    ).not.toMatch(/transparent|rgba\(0, 0, 0, 0\)/);
  }
});

test("documentation search finds a deep link and closes after navigation", async ({
  page,
}) => {
  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);
  await expect(
    page.getByRole("button", { name: /Open Search/ }).first(),
  ).toBeEnabled();
  await page.locator("[data-search-full]").click();
  const search = page.locator("[data-fd-search-dialog-input]");
  await expect(search).toBeFocused();
  await search.fill("stale response");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Stop, abort, retry/i })
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
  await waitForThemeControls(page);
  const menu = page.getByRole("button", {
    name: /Open Sidebar/,
  });
  await expect(menu).toBeEnabled();
  await menu.click();
  const navigation = page.locator("#nd-sidebar-mobile");
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

test("wide documentation content scrolls locally on phones", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");

  const code = page.locator('figure [role="region"]').filter({ hasText: "createGenerativeA11y" }).first();
  await expect(code).toBeVisible();
  expect(await code.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("mobile documentation drawer contains section switching", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);

  const menu = page.getByRole("button", { name: /Open Sidebar/ }).first();
  await menu.click();
  const drawer = page.locator("#nd-sidebar-mobile");
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Getting started" }).first()).toBeVisible();
  await expect(drawer.getByRole("button", { name: /Guides/ })).toBeVisible();
  await drawer.getByRole("button", { name: "Close Sidebar" }).click();
  await expect(drawer).toHaveAttribute("data-state", "closed");
});

test("search remains reachable from the mobile documentation header", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);

  const trigger = page.getByRole("button", { name: "Open Search" }).first();
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.locator("[data-fd-search-dialog-input]")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
});

test("homepage bento uses one column through 900px and two columns above it", async ({
  page,
}) => {
  const cardNames = [
    "Built for asynchronous AI",
    "Add accessibility without starting over",
    "Debug accessibility behavior before users find the problem",
  ] as const;

  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto("/");
  await waitForThemeControls(page);
  const narrowBoxes = await Promise.all(
    cardNames.map(async (name) => {
      const card = page.getByRole("article", { name });
      await expect(card).toBeVisible();
      return card.boundingBox();
    }),
  );
  expect(narrowBoxes.every((box) => box !== null)).toBe(true);
  expect(
    narrowBoxes.every(
      (box) => Math.abs((box?.x ?? 0) - (narrowBoxes[0]?.x ?? 0)) <= 1,
    ),
  ).toBe(true);
  expect(narrowBoxes[1]?.y).toBeGreaterThan(narrowBoxes[0]?.y ?? 0);
  expect(narrowBoxes[2]?.y).toBeGreaterThan(narrowBoxes[1]?.y ?? 0);

  await page.setViewportSize({ width: 901, height: 900 });
  const wideBoxes = await Promise.all(
    cardNames.map(async (name) => {
      const card = page.getByRole("article", { name });
      await expect(card).toBeVisible();
      return card.boundingBox();
    }),
  );
  expect(
    Math.abs((wideBoxes[0]?.y ?? 0) - (wideBoxes[1]?.y ?? 0)),
  ).toBeLessThanOrEqual(1);
  expect(wideBoxes[1]?.x).toBeGreaterThan(wideBoxes[0]?.x ?? 0);
  expect(wideBoxes[2]?.y).toBeGreaterThan(wideBoxes[0]?.y ?? 0);
  expect(wideBoxes[2]?.y).toBeGreaterThan(wideBoxes[1]?.y ?? 0);
  expect(
    Math.abs((wideBoxes[2]?.x ?? 0) - (wideBoxes[0]?.x ?? 0)),
  ).toBeLessThanOrEqual(1);
});

test("homepage bento never creates page-level horizontal overflow", async ({
  page,
}) => {
  for (const width of [320, 1023, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Built for asynchronous AI" }),
    ).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(
      dimensions.scrollWidth,
      `homepage overflowed at ${width}px`,
    ).toBeLessThanOrEqual(dimensions.clientWidth);
  }
});

test("homepage cards retain a logical reading order at every layout", async ({
  page,
}) => {
  const expectedOrder = [
    "Built for asynchronous AI",
    "Add accessibility without starting over",
    "Debug accessibility behavior before users find the problem",
  ] as const;

  for (const width of [390, 1024] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const headings = await page.getByRole("heading").allTextContents();
    const positions = expectedOrder.map((name) =>
      headings.findIndex((heading) => heading.trim() === name),
    );

    expect(
      positions,
      `missing homepage card heading at ${width}px`,
    ).not.toContain(-1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  }
});

test("homepage supports a dark theme", async ({ page }) => {
  await page.goto("/");
  await waitForThemeControls(page);
  const darkTheme = page.getByRole("button", { name: "Dark", exact: true });
  await expect(darkTheme).toBeVisible();
  await darkTheme.click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.locator(".home-quick-start")).toHaveCSS(
    "background-image",
    /radial-gradient/,
  );

  await expect(
    page.getByRole("button", { name: "Light", exact: true }),
  ).toBeVisible();
  const runtime = page.getByRole("region", { name: "Interactive runtime trace" });
  const surfaces = [
    ["page canvas", page.getByRole("main")],
    [
      "runtime stage",
      page.locator(".runtime-stage"),
    ],
    ["runtime trace", runtime],
  ] as const;

  for (const [name, surface] of surfaces) {
    await expect(surface).toBeVisible();
    const palette = await readSurfacePalette(surface);
    expect(
      palette.backgroundLuminance,
      `${name} should use a dark background`,
    ).toBeLessThan(0.2);
    expect(
      palette.foregroundLuminance,
      `${name} foreground should be lighter than its background`,
    ).toBeGreaterThan(palette.backgroundLuminance);
    expect(
      palette.contrast,
      `${name} foreground should remain readable`,
    ).toBeGreaterThanOrEqual(4.5);
  }
});

test("light and dark themes persist across every route family", async ({ page }) => {
  await page.goto("/");
  await waitForThemeControls(page);
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  for (const path of representativeThemePages) {
    await page.goto(path);
    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(
      page.getByRole("button", { name: "Light", exact: true }),
    ).toBeVisible();

    const palette = await readSurfacePalette(page.getByRole("main").first());
    expect(palette.backgroundLuminance, `${path} dark background`).toBeLessThan(0.2);
    expect(palette.foregroundLuminance, `${path} dark foreground`).toBeGreaterThan(
      palette.backgroundLuminance,
    );
    expect(palette.contrast, `${path} dark contrast`).toBeGreaterThanOrEqual(4.5);
  }

  await waitForThemeControls(page);
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  for (const path of representativeThemePages) {
    await page.goto(path);
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(
      page.getByRole("button", { name: "Dark", exact: true }),
    ).toBeVisible();

    const palette = await readSurfacePalette(page.getByRole("main").first());
    expect(palette.backgroundLuminance, `${path} light background`).toBeGreaterThan(0.6);
    expect(palette.foregroundLuminance, `${path} light foreground`).toBeLessThan(
      palette.backgroundLuminance,
    );
    expect(palette.contrast, `${path} light contrast`).toBeGreaterThanOrEqual(4.5);
  }
});

test("system theme follows operating system changes across navigation", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await waitForThemeControls(page);
  await page.getByRole("button", { name: "System", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.goto("/examples/lifecycle-lab");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "System", exact: true }),
  ).toBeVisible();

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.goto("/api/core/create-generative-a11y");
  await waitForThemeControls(page);
  await expect(page.locator("html")).not.toHaveClass(/dark/);
});

test("primary mobile controls provide comfortable touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Interactive runtime laboratory" }),
  ).toBeVisible();
  const installer = page.getByRole("group", { name: "Install a package" });
  const runtime = page.getByRole("region", {
    name: "Interactive runtime trace",
  });
  for (const control of [
    page.getByRole("button", { name: "Toggle Menu", exact: true }),
    installer.getByRole("combobox", { name: "Package" }),
    installer.getByRole("button", { name: "Copy install command" }),
    runtime.getByRole("button", { name: "Play demo", exact: true }),
  ]) {
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);
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
        .getByRole("button", { name: /Open Sidebar/ })
        .click();
    }
    const results = await appAxe(page).analyze();
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

test("lifecycle lab uses the available documentation width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/examples/lifecycle-lab");

  const pageShell = page.locator("#nd-page");
  const labGrid = page.locator(".lab-grid");
  await expect(labGrid).toBeVisible();

  const pageBox = await pageShell.boundingBox();
  const labBox = await labGrid.boundingBox();
  expect(pageBox?.width).toBeGreaterThan(1_100);
  expect(labBox?.width).toBeGreaterThan(1_000);
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
  await waitForThemeControls(page);
  const presetButton = page.getByRole("button", { name: /preset/i });
  await expect(presetButton).toHaveAttribute("aria-expanded", "false");
  await presetButton.click();
  await expect(presetButton).toHaveAttribute("aria-expanded", "true");
  const preset = presetButton.locator("xpath=..");
  await expect(preset).toContainText("balanced");
  await expect(preset).toContainText("Selects a complete baseline policy");
});

test("Docs and API provide separate top-level navigation and legacy reference links redirect", async ({
  page,
}) => {
  await page.goto("/docs/getting-started");
  await waitForThemeControls(page);
  await page
    .getByRole("button", { name: /Guides/ })
    .first()
    .click({ position: { x: 10, y: 10 } });
  await page.getByRole("link", { name: /API Reference/ }).click();
  await expect(page).toHaveURL(/\/api$/);
  await expect(page.getByText("API reference", { exact: true }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /API Reference/ })
    .first()
    .click({ position: { x: 10, y: 10 } });
  await expect(page.getByRole("link", { name: /Examples/ }).first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "createGenerativeA11y", exact: true })
    .click();
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
    ["/docs/project/overview", "Project overview"],
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
    const results = await appAxe(page).analyze();
    expect(results.violations).toEqual([]);
  });
}

test("subtle motion is present and respects reduced-motion preferences", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Interactive runtime laboratory" }),
  ).toBeVisible();
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo).toHaveAttribute("data-hydrated", "true");
  const motionSurface = page.locator(".home-hero-copy");
  await expect(motionSurface).toBeVisible();
  expect(
    await motionSurface.evaluate((element) => getComputedStyle(element).animationName),
  ).not.toBe("none");

  await page.emulateMedia({ reducedMotion: "reduce" });
  const duration = await motionSurface.evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.00001);

  const activeMotion = await motionSurface.evaluate((element) =>
    element
      .getAnimations({ subtree: true })
      .filter((animation) => animation.playState === "running")
      .map((animation) => Number(animation.effect?.getComputedTiming().duration)),
  );
  expect(activeMotion.every((motionDuration) => motionDuration <= 0.01)).toBe(
    true,
  );
  const captureVisualState = () =>
    motionSurface.evaluate((element) =>
      [element, ...element.querySelectorAll("*")].map((motionElement) => {
        const rect = motionElement.getBoundingClientRect();
        const styles = getComputedStyle(motionElement);
        return {
          opacity: styles.opacity,
          transform: styles.transform,
          rect: [rect.x, rect.y, rect.width, rect.height].map(
            (value) => Math.round(value * 100) / 100,
          ),
        };
      }),
    );
  const reducedMotionState = await captureVisualState();
  await page.waitForTimeout(150);
  expect(await captureVisualState()).toEqual(reducedMotionState);
});

test("homepage runtime trace waits for Play and exposes pause and replay controls", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Interactive runtime laboratory" }),
  ).toBeVisible();
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo).toHaveAttribute("data-hydrated", "true");
  await expect(demo.getByText("Ready", { exact: true })).toBeVisible();
  await expect(demo.locator('.trace-list li:not([aria-hidden="true"])')).toHaveCount(0);

  await demo.getByRole("button", { name: "Play demo", exact: true }).click();
  await expect(
    demo.getByText("response.started", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(
      () => demo.locator('.trace-list li:not([aria-hidden="true"])').count(),
      { timeout: 4_000 },
    )
    .toBeGreaterThanOrEqual(2);

  await demo.getByRole("button", { name: "Pause demo" }).click();
  await expect(demo.getByText("Paused", { exact: true })).toBeVisible();
  const pausedEntryCount = await demo.locator('.trace-list li:not([aria-hidden="true"])').count();
  await page.waitForTimeout(800);
  await expect(demo.locator('.trace-list li:not([aria-hidden="true"])')).toHaveCount(pausedEntryCount);
  await demo.getByRole("button", { name: "Replay demo" }).click();
  await expect(demo.locator("output.runtime-status")).toHaveText("Streaming");
  await expect(
    demo.getByText("response.started", { exact: true }),
  ).toBeVisible();
});

test("homepage runtime completes when reduced motion is enabled during playback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const demo = page.getByRole("region", { name: "Interactive runtime trace" });
  await expect(demo).toHaveAttribute("data-hydrated", "true");
  await demo.getByRole("button", { name: "Play demo", exact: true }).click();
  await expect(demo).toHaveAttribute("data-state", "playing");

  await page.emulateMedia({ reducedMotion: "reduce" });

  await expect(demo).toHaveAttribute("data-state", "complete", { timeout: 500 });
  await expect(demo.getByText("Complete", { exact: true })).toBeVisible();
  await expect(demo.getByRole("button", { name: "Play demo", exact: true })).toBeEnabled();
});

test("hero pointer displacement stops when reduced motion is enabled", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const hero = page.locator(".home-hero");
  const canvas = hero.locator("canvas.home-hero-dither-motion");
  await expect(canvas).toBeVisible();
  expect(
    await page.evaluate(() =>
      matchMedia("(hover: hover) and (pointer: fine)").matches,
    ),
  ).toBe(true);
  const readCanvas = () =>
    canvas.evaluate((element) => (element as HTMLCanvasElement).toDataURL());
  await expect
    .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width))
    .toBeGreaterThan(1_000);
  const bounds = await hero.boundingBox();
  if (!bounds) throw new Error("Hero bounds are unavailable");
  const restingCanvas = await readCanvas();
  await page.mouse.move(bounds.x + bounds.width * 0.82, bounds.y + bounds.height * 0.4);
  await expect.poll(readCanvas).not.toBe(restingCanvas);
  await expect.poll(readCanvas, { timeout: 2_000 }).toBe(restingCanvas);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => new Promise(requestAnimationFrame));
  const beforePointerMove = await readCanvas();
  await page.mouse.move(bounds.x + bounds.width * 0.68, bounds.y + bounds.height * 0.56);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );

  expect(await readCanvas()).toBe(beforePointerMove);
});

test("missing npm download data stays unavailable", async ({ page }) => {
  await page.unroute("**/project-stats.json");
  await page.route("**/project-stats.json", async (route) => {
    await route.fulfill({ json: { stars: 1, monthlyDownloads: null } });
  });
  await page.goto("/");

  await expect(
    page.getByRole("link", {
      name: "View generative-a11y on GitHub, 1 stars",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "View generative-a11y packages on npm",
      exact: true,
    }),
  ).toBeVisible();
});
