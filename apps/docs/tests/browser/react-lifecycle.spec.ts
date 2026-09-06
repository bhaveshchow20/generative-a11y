import { expect, test } from "@playwright/test";

test("React recipe delivers the host lifecycle while keeping native controls and focus", async ({ page }) => {
  await page.goto("/docs/react-lifecycle");
  const chat = page.getByRole("region", { name: "Draft assistant" });
  const composer = chat.getByRole("textbox", { name: "Message" });
  await composer.fill("Plan a trip");
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await composer.focus();
  await expect(chat).toContainText("You can choose whether to use it.");
  await expect(chat.getByRole("button", { name: "Use draft", exact: true })).toBeEnabled();
  await expect(page.locator('[aria-live="assertive"]')).toHaveText("Use this draft?");
  await expect(composer).toBeFocused();
  await chat.getByRole("button", { name: "Use draft", exact: true }).click();
  await expect(chat).toContainText("Draft selected.");
  await expect(page.locator('[aria-live="polite"]')).toHaveText("confirmation approved.");
  await expect(chat.locator('[aria-live]')).toHaveCount(0);
  // A fresh host request uses a new identity; either decision is supported.
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await expect(chat.getByRole("button", { name: "Discard draft", exact: true })).toBeEnabled();
  await chat.getByRole("button", { name: "Discard draft", exact: true }).click();
  await expect(page.locator('[aria-live="polite"]')).toHaveText("confirmation rejected.");
  // Navigate away during another host operation; the provider leaves no regions.
  await chat.getByRole("button", { name: "Send", exact: true }).click();
  await page.getByRole("link", { name: "existing adapter", exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/integrations$/);
  await expect(page.locator('[aria-live="polite"]')).toHaveCount(0);
  await expect(page.locator('[aria-live="assertive"]')).toHaveCount(0);
});
