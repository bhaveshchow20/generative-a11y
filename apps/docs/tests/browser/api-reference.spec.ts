import { expect, test } from "@playwright/test";

test("public declarations can be opened with the keyboard", async ({ page }) => {
  await page.goto("/api/core");
  const reference = page.getByRole("region", {
    name: "@generative-a11y/core public declarations",
    exact: true,
  });
  const declaration = reference.locator("details").filter({
    has: page.locator("summary code", { hasText: /^createRuntime$/ }),
  });
  const summary = declaration.locator("summary");
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(declaration).toHaveAttribute("open", "");
  await expect(declaration.locator("pre")).toContainText("RuntimeOptions");
  await page.keyboard.press("Enter");
  await expect(declaration).not.toHaveAttribute("open", "");
});
