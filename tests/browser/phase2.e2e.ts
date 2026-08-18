import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("React integration fixture", () => {
  test("keeps the existing interface and delivers a streamed completion", async ({
    page,
  }) => {
    await page.goto("/");
    const composer = page.getByLabel("Message");
    await composer.focus();
    await page.evaluate(() => {
      document.getElementById("send-response")?.click();
    });

    await expect(page.getByTestId("transcript")).toContainText(
      "The existing interface is still here.",
    );
    await expect(page.locator('[aria-live="polite"]')).toContainText(
      "The existing interface is still here.",
    );
    await expect(page.locator('[aria-live="assertive"]')).toHaveCount(1);
    await expect(page.locator("body")).toContainText("Existing assistant");
    expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
      "composer",
    );
  });

  test("does not introduce axe violations in the host interface", async ({
    page,
  }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .exclude('[aria-live="polite"]')
      .exclude('[aria-live="assertive"]')
      .analyze();
    expect(results.violations).toEqual([]);
  });
});
