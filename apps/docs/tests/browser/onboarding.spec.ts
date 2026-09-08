import { expect, test } from "@playwright/test";

for (const route of [
  "/docs/getting-started",
  "/docs/integrations/ai-sdk",
  "/api/ai-sdk",
  "/api/ai-sdk/use-chat-accessibility",
]) {
  test(`onboarding renders the two-package journey at ${route}`, async ({
    page,
  }) => {
    const response = await page.goto(route);
    expect(response?.status(), route).toBe(200);
    const article = page.locator("article");
    await expect(article).toContainText(
      "npm install @generative-a11y/react @generative-a11y/ai-sdk",
    );
    if (route !== "/docs/integrations/ai-sdk") {
      await expect(
        article.locator('a[href="/docs/integrations/ai-sdk"]').first(),
      ).toBeVisible();
    }
    if (route.endsWith("use-chat-accessibility")) {
      await expect(article).toContainText(
        "...existingOptions, ...accessibility.chatCallbacks",
      );
      const firstExample = article
        .locator("pre")
        .filter({ hasText: "function Chat()" })
        .first();
      await expect(firstExample).not.toContainText("UseChatOptions");
      await expect(firstExample).not.toContainText("defaultOptions");
    }
  });
}

test("native onboarding blocks support keyboard selection and narrow screens", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const copied: string[] = [];
    Object.defineProperty(window, "__copiedCode", {
      value: copied,
      configurable: true,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copied.push(text);
        },
      },
    });
  });
  await page.goto("/docs/integrations/ai-sdk");
  const npm = page.getByRole("tab", { name: "npm", exact: true });
  const pnpm = page.getByRole("tab", { name: "pnpm", exact: true });
  await npm.press("ArrowRight");
  await expect(pnpm).toBeFocused();
  await pnpm.press("Enter");
  await expect(pnpm).toHaveAttribute("aria-selected", "true");
  const panel = page.getByRole("tabpanel", { name: "pnpm", exact: true });
  await expect(panel).toContainText(
    "pnpm add @generative-a11y/react @generative-a11y/ai-sdk",
  );
  await expect(
    panel.getByRole("button", { name: "Copy Text", exact: true }),
  ).toBeEnabled();
  await panel
    .getByRole("button", { name: "Copy Text", exact: true })
    .press("Enter");
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as Window & { __copiedCode?: string[] }).__copiedCode?.at(-1),
      ),
    )
    .toBe("pnpm add @generative-a11y/react @generative-a11y/ai-sdk");
  const code = page
    .locator("article figure")
    .filter({ hasText: "const runtime = useRuntime()" });
  await expect(code).toContainText("components/chat.tsx");
  const compatibility = page
    .getByRole("table")
    .filter({ hasText: "Checked version" });
  for (const row of await compatibility.locator("tbody tr").all()) {
    await expect(row.locator("td")).toHaveCount(3);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width + 1);
});
