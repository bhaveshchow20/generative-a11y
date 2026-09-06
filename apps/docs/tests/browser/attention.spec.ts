import { expect, test } from "@playwright/test";

test("host quiet controls preserve visible text, approval, and ordinary focus", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/examples/lifecycle-lab");
  const lab = page.getByRole("region", { name: "Attention and your announcement controls" });
  await lab.getByRole("button", { name: "Quiet", exact: true }).click();
  await expect(lab.getByTestId("attention-state")).toContainText("effective: quiet");
  const advance = lab.getByRole("button", { name: "Advance scenario", exact: true });
  // Use keyboard activation to check that runtime events preserve focus;
  // WebKit pointer clicks can clear button focus.
  await advance.focus();
  await advance.press("Enter");
  await expect(advance).toBeFocused();
  await advance.press("Enter");
  await expect(lab.getByRole("article", { name: "Newest response" })).toContainText("The report is ready.");
  const trace = lab.getByRole("region", { name: "Attention runtime intents" });
  await expect(trace).not.toContainText("The report is ready.");
  for (let step = 2; step < 8; step += 1) await advance.press("Enter");
  await expect(trace).toContainText("tool.completed");
  await expect(trace).toContainText("interaction.requested");
  const approve = lab.getByRole("button", { name: "Approve publishing", exact: true });
  await expect(approve).toBeFocused();
  await approve.press("Enter");
  await expect(trace).toContainText("interaction.resolved");
  await advance.press("Enter");
  await expect(advance).toBeFocused();
  await expect(trace).toContainText("response.completed");
  await lab.getByRole("button", { name: "Normal", exact: true }).click();
  await expect(lab.getByTestId("attention-state")).toContainText("effective: normal");
  await expect(trace).not.toContainText("The report is ready.");
  await lab.getByRole("button", { name: "Auto", exact: true }).click();
  await expect(lab.getByTestId("attention-state")).toContainText("override: auto");
});
