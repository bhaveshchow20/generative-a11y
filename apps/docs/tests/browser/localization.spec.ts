import { expect, test } from "@playwright/test";

test("French notices coexist with English response content and preserve focus", async ({ page }) => {
  await page.goto("/examples/lifecycle-lab");
  const button = page.getByRole("button", {name:"Try localized announcements"});
  await button.click();
  const focusTarget = page.getByRole("region", {name:"Lifecycle event timeline"});
  await focusTarget.focus();
  await expect(page.locator('.announcement-list p').filter({hasText:"Réponse terminée."})).toBeVisible();
  await expect(page.locator('[aria-live="polite"][lang="fr"]')).toHaveText("Réponse terminée.");
  await expect(focusTarget).toBeFocused();
  await expect(page.locator('.assistant-message p')).toContainText("release");
  await expect(page.locator('.announcement-list p[lang="en"]').first()).toBeVisible();
  await page.getByRole("button", {name:"Reset",exact:true}).first().click();
  await expect(page.locator('[aria-live="polite"][lang="fr"]')).toHaveCount(0);
});
