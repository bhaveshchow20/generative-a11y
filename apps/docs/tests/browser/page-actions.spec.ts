import { expect, test } from "@playwright/test";

for (const path of ["/docs/integrations/ai-sdk", "/api", "/api/core"]) {
  test(`page actions copy Markdown and expose destinations on ${path}`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          write: async (items: ClipboardItem[]) => {
            const blob = await items[0].getType("text/plain");
            document.documentElement.dataset.copiedMarkdown = await blob.text();
          },
          writeText: async (text: string) => {
            document.documentElement.dataset.copiedMarkdown = text;
          },
        },
      });
    });
    await page.goto(path);
    const actions = page.getByRole("group", { name: "Page actions" });
    const copy = actions.getByRole("button", { name: "Copy Markdown" });
    // Match the existing site's hydration guard before interacting with SSR buttons.
    await expect
      .poll(() =>
        copy.evaluate((button) => typeof (button as HTMLButtonElement).onclick),
      )
      .toBe("function");
    await copy.click();
    await expect
      .poll(() => page.locator("html").getAttribute("data-copied-markdown"), {
        timeout: 20_000,
      })
      .toContain(`Canonical: https://generativea11y.com${path}`);
    const open = actions.getByRole("button", { name: "Open", exact: true });
    await open.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("link", { name: "View as Markdown" }),
    ).toHaveAttribute("href", `/markdown${path}`);
    const source = path === "/api" ? "api/index.mdx" : `${path.slice(1)}.mdx`;
    await expect(
      page.getByRole("link", { name: "Open in GitHub" }),
    ).toHaveAttribute(
      "href",
      `https://github.com/bhaveshchow20/generative-a11y/blob/main/apps/docs/content/${source}`,
    );
    await expect(
      page.getByRole("link", { name: "Open in ChatGPT" }),
    ).toBeVisible();
    for (const name of [
      "Open in ChatGPT",
      "Open in Claude",
      "Open in Cursor",
      "Open in Scira AI",
    ]) {
      const href = await page.getByRole("link", { name }).getAttribute("href");
      const params = new URL(href!).searchParams;
      const prompt = params.get("q") ?? params.get("text");
      expect(prompt).toContain(`https://generativea11y.com${path}`);
      expect(prompt).not.toMatch(/localhost|127\.0\.0\.1|\/markdown\//);
    }
    await expect(
      page.getByText(/AI tools read the published page/),
    ).toHaveCount(0);
    for (const title of [
      "GitHub",
      "Scira AI",
      "OpenAI",
      "Anthropic",
      "Cursor",
    ]) {
      await expect(
        page
          .locator("a svg title")
          .filter({ hasText: new RegExp(`^${title}$`) }),
      ).toHaveCount(1);
    }
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
  });
}
