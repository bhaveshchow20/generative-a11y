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
        "...options, ...accessibility.chatCallbacks",
      );
      await expect(article).toContainText("options.onFinish?.(event)");
      await expect(article).toContainText("options.onError?.(error)");
    }
  });
}
