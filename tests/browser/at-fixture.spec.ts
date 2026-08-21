import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const fixturePath = "/examples/at-fixture/";

test.beforeEach(async ({ page }) => {
  await page.goto(fixturePath);
  await expect(
    page.getByRole("heading", { name: "Assistive technology test console" }),
  ).toBeVisible();
  await page.evaluate(() => window.generativeA11yATFixture.reset());
});

test("serves only the fixture and required package artifacts", async ({
  request,
}) => {
  await expect((await request.get("/README.md")).status()).toBe(404);
  await expect((await request.get("/.git/config")).status()).toBe(404);
  await expect(
    (await request.get("/packages/core/package.json")).status(),
  ).toBe(404);
  await expect(
    (await request.get("/packages/core/dist/index.js")).status(),
  ).toBe(200);
});

test("has semantic landmarks and no serious automated accessibility findings", async ({
  page,
}) => {
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Scenario controls" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Host conversation" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Event ledger" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(
    results.violations.filter(
      ({ impact }) => impact === "critical" || impact === "serious",
    ),
  ).toEqual([]);
});

test("mounts stable, separate polite and assertive live regions", async ({
  page,
}) => {
  const polite = page.locator("#fixture-live-polite");
  const assertive = page.locator("#fixture-live-assertive");
  await expect(polite).toHaveAttribute("aria-live", "polite");
  await expect(assertive).toHaveAttribute("aria-live", "assertive");
  await expect(polite).toHaveAttribute("aria-atomic", "true");
  await expect(assertive).toHaveAttribute("aria-relevant", "additions text");
  await expect(page.locator("main #fixture-live-polite")).toHaveCount(0);
});

test("delivers channels, repeated literal text, and locale changes without parsing HTML", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Auto fallback mode" }).click();
  await page.getByRole("button", { name: "Polite sample" }).click();
  await expect(page.locator("#fixture-live-polite")).toHaveText(
    "Routine status available.",
  );

  await page.getByRole("button", { name: "Assertive sample" }).click();
  await expect(page.locator("#fixture-live-assertive")).toHaveText(
    "Action is required now.",
  );

  await page.getByRole("button", { name: "Repeat identical" }).click();
  await expect(page.locator("#fixture-live-polite")).toHaveText(
    "Repeated identical notice.",
  );
  await expect(
    page.locator("#delivery-ledger [data-text='Repeated identical notice.']"),
  ).toHaveCount(2);

  await page.getByRole("button", { name: "French locale" }).click();
  await expect(page.locator("#fixture-live-polite")).toHaveAttribute(
    "lang",
    "fr",
  );
  await page.getByRole("button", { name: "Non-Latin locale" }).click();
  await expect(page.locator("#fixture-live-polite")).toHaveAttribute(
    "lang",
    "ja",
  );
  await page.getByRole("button", { name: "Clear locale" }).click();
  await expect(page.locator("#fixture-live-polite")).not.toHaveAttribute(
    "lang",
    /.+/,
  );

  await page.getByRole("button", { name: "Literal hostile HTML" }).click();
  await expect(page.locator("#fixture-live-polite")).toHaveText(
    '<img src=x onerror="window.__fixtureInjected=true"> Literal only.',
  );
  await expect(page.locator("#fixture-live-polite img")).toHaveCount(0);
  expect(await page.evaluate(() => window.__fixtureInjected)).toBeUndefined();
});

test("routine response and tool scenarios never steal composer focus", async ({
  page,
}) => {
  const composer = page.getByLabel("Message composer");
  await composer.focus();
  for (const action of ["stream", "fast-tool", "slow-tool", "tool-failure"]) {
    await page.evaluate(
      (selectedAction) =>
        window.generativeA11yATFixture.actions[selectedAction]?.(),
      action,
    );
    await expect(composer).toBeFocused();
  }
  await expect(page.locator("#current-focus")).toContainText(
    "Message composer",
  );
});

test("explicit focus capture restores only while focus remains in the guarded interaction", async ({
  page,
}) => {
  const composer = page.getByLabel("Message composer");
  const interaction = page.getByRole("group", {
    name: "Explicit focus interaction",
  });
  const unrelated = page.getByRole("button", {
    name: "Unrelated focus target",
  });

  await composer.focus();
  await page.evaluate(() =>
    window.generativeA11yATFixture.captureAndEnterInteraction(),
  );
  await expect(
    interaction.getByRole("button", { name: "Resolve interaction" }),
  ).toBeFocused();
  await interaction
    .getByRole("button", { name: "Resolve interaction" })
    .press("Enter");
  await expect(composer).toBeFocused();

  await composer.focus();
  await page.evaluate(() =>
    window.generativeA11yATFixture.captureAndEnterInteraction(),
  );
  await unrelated.focus();
  await page.evaluate(() =>
    window.generativeA11yATFixture.restoreCapturedFocus(),
  );
  await expect(unrelated).toBeFocused();
  await expect(page.locator("#focus-result")).toContainText("guard-mismatch");
});

test("stop cancels pending text and retry rejects stale-instance output", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Stop response" }).click();
  await expect(page.locator("#announcement-ledger")).toContainText(
    "Response stopped.",
  );
  await expect(page.locator("#announcement-ledger")).not.toContainText(
    "Cancelled pending sentence.",
  );

  await page.getByRole("button", { name: "Retry with stale delta" }).click();
  await expect(page.locator("#announcement-ledger")).toContainText(
    "Fresh response sentence.",
  );
  await expect(page.locator("#announcement-ledger")).not.toContainText(
    "Stale response sentence.",
  );
  await expect(page.locator("#event-ledger")).toContainText(
    '"responseInstanceId":"attempt-old"',
  );
});

test("supports forced fallback, auto fallback, and a throwing ariaNotify test path", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Force live-region mode" }).click();
  await page.getByRole("button", { name: "Polite sample" }).click();
  await expect(page.locator("#delivery-ledger li").last()).toContainText(
    '"method":"live-region"',
  );

  await page.getByRole("button", { name: "Auto fallback mode" }).click();
  await page.getByRole("button", { name: "Polite sample" }).click();
  await expect(page.locator("#delivery-ledger li").last()).toContainText(
    '"method":"live-region"',
  );

  await page.getByRole("button", { name: "Throwing ariaNotify path" }).click();
  await expect(page.locator("#delivery-ledger li").last()).toContainText(
    "Fixture ariaNotify failure",
  );
  await expect(page.locator("#delivery-ledger li").last()).toContainText(
    '"status":"mutated"',
  );
});

test("shows normalized events and DOM delivery results without speech claims", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Actionable interaction" }).click();
  await page.getByRole("button", { name: "Response failure" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.generativeA11yATFixture
          .snapshot()
          .events.map(({ type }) => type),
      ),
    )
    .toEqual(["interaction.requested", "response.started", "response.failed"]);
  await expect(page.locator("#delivery-ledger li")).not.toHaveCount(0);
  await expect(page.locator("#announcement-ledger li")).not.toHaveCount(0);
  await expect(
    page.getByText(
      "Delivery logs record API calls or DOM mutations, not confirmed speech.",
    ),
  ).toBeVisible();
});

declare global {
  interface Window {
    __fixtureInjected?: boolean;
    generativeA11yATFixture: {
      reset(): void;
      captureAndEnterInteraction(): void;
      restoreCapturedFocus(): void;
      actions: Readonly<Record<string, () => void>>;
      snapshot(): { events: Array<{ type: string }> };
    };
  }
}
