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
    await expect(page.getByTestId("announcement-log")).toContainText(
      "The existing interface is still here.",
    );
    await expect(page.locator('[aria-live="polite"]')).not.toHaveText("");
    await expect(page.locator('[aria-live="assertive"]')).toHaveCount(1);
    await expect(page.locator("body")).toContainText("Existing assistant");
    expect(await page.evaluate(() => document.activeElement?.id ?? "")).toBe(
      "composer",
    );
  });

  test("delivers tool, approval, and failure states through the expected channels", async ({
    page,
  }) => {
    await page.goto("/");

    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="tool-workflow"]')
        ?.click(),
    );
    await expect(page.getByTestId("announcement-log")).toContainText(
      "Forecast ready",
    );

    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="approval-request"]')
        ?.click(),
    );
    await expect(page.locator('[aria-live="assertive"]')).toContainText(
      "Review the generated plan",
    );

    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>('[data-testid="response-failure"]')
        ?.click(),
    );
    await expect(page.locator('[aria-live="assertive"]')).toContainText(
      "The service timed out",
    );
  });

  test("persists a host preference without changing the visible interface", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("preference-preset")).toContainText(
      "verbose",
    );

    await page.evaluate(() =>
      document
        .querySelector<HTMLButtonElement>(
          '[data-testid="set-completion-preference"]',
        )
        ?.click(),
    );
    await expect(page.getByTestId("preference-preset")).toContainText(
      "completion-only",
    );
    await expect(page.locator("h1")).toHaveText("Existing assistant");

    await page.reload();
    await expect(page.getByTestId("preference-preset")).toContainText(
      "completion-only",
    );
    await expect(page.locator("h1")).toHaveText("Existing assistant");
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
