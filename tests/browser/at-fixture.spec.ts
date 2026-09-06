import { AxeBuilder } from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { AttentionState, RuntimeEvent } from "@generative-a11y/core";

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
  await expect(page.getByRole("status")).toHaveCount(0);

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

for (const deliveryMode of [
  "live-mode",
  "auto-fallback",
  "auto-mode",
] as const) {
  test(`attention follows real intersection without moving focus (${deliveryMode})`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 300 });
    await page.bringToFront();
    await page.evaluate((mode) => {
      window.generativeA11yATFixture.reset({ attention: true });
      window.generativeA11yATFixture.actions[mode]?.();
      document
        .querySelector<HTMLTextAreaElement>("#composer")
        ?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }, deliveryMode);
    await expect
      .poll(() =>
        page.evaluate(
          () => window.generativeA11yATFixture.snapshot().attention?.effective,
        ),
      )
      .toBe("quiet");
    await expect
      .poll(() =>
        page.evaluate(
          () => window.generativeA11yATFixture.snapshot().attention?.observed,
        ),
      )
      .toBe("reading-history");
    await page.evaluate(() => {
      const fixture = window.generativeA11yATFixture;
      fixture.dispatch({
        type: "response.started",
        responseId: "attention-response",
      });
      fixture.dispatch({
        type: "response.text.delta",
        responseId: "attention-response",
        delta: "Suppressed complete sentence. ",
      });
      fixture.dispatch({
        type: "interaction.requested",
        interactionId: "attention-approval",
        kind: "approval",
        label: "Approval remains available.",
        urgent: true,
      });
      fixture.drain();
    });
    await expect(
      page.locator(
        "#delivery-ledger [data-text='Approval remains available.']",
      ),
    ).toHaveCount(1);
    if (deliveryMode !== "auto-mode") {
      await expect(page.locator("#fixture-live-assertive")).toHaveText(
        "Approval remains available.",
      );
    }
    await expect(page.locator("#fixture-live-polite")).toHaveText("");
    await expect(page.locator("#composer")).toBeFocused();
    await page.locator("#response-copy").scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        page.evaluate(
          () => window.generativeA11yATFixture.snapshot().attention?.effective,
        ),
      )
      .toBe("normal");
    await page.evaluate(() => {
      const fixture = window.generativeA11yATFixture;
      fixture.dispatch({
        type: "response.text.delta",
        responseId: "attention-response",
        delta: "Fresh complete sentence. ",
      });
      fixture.dispatch({
        type: "response.completed",
        responseId: "attention-response",
      });
      fixture.dispatch({
        type: "interaction.resolved",
        interactionId: "attention-approval",
        kind: "approval",
        outcome: "approved",
      });
      fixture.drain();
    });
    await expect(
      page.locator(
        "#announcement-ledger [data-text='Fresh complete sentence.']",
      ),
    ).toHaveCount(1);
    await expect(
      page.locator(
        "#announcement-ledger [data-text='Suppressed complete sentence.']",
      ),
    ).toHaveCount(0);
    await expect(
      page.locator("#announcement-ledger [data-text='Response complete.']"),
    ).toHaveCount(1);
    await expect(page.locator("#composer")).toBeFocused();
  });
}

test("explicit override wins over simulated background evidence and cancels queued text", async ({
  page,
}) => {
  await page.evaluate(() => {
    const fixture = window.generativeA11yATFixture;
    fixture.reset({ attention: true });
    fixture.dispatch({ type: "attention.override", mode: "normal" });
    fixture.dispatch({ type: "attention.changed", mode: "background" });
    fixture.dispatch({ type: "response.started", responseId: "pending" });
    fixture.dispatch({
      type: "response.text.delta",
      responseId: "pending",
      delta: "Queued text. ",
    });
    fixture.dispatch({ type: "response.completed", responseId: "pending" });
    fixture.dispatch({ type: "attention.override", mode: "quiet" });
    fixture.drain();
  });
  await expect(
    page.locator("#announcement-ledger [data-text='Queued text.']"),
  ).toHaveCount(0);
  await expect(
    page.locator("#announcement-ledger [data-text='Response complete.']"),
  ).toHaveCount(1);
});

declare global {
  interface Window {
    __fixtureInjected?: boolean;
    generativeA11yATFixture: {
      reset(options?: {
        attention?: boolean;
        syntheticCatalog?: boolean;
      }): void;
      dispatch(event: RuntimeEvent): void;
      drain(): void;
      captureAndEnterInteraction(): void;
      restoreCapturedFocus(): void;
      actions: Readonly<Record<string, () => void>>;
      snapshot(): {
        events: Array<{ type: string }>;
        attention?: AttentionState;
      };
    };
  }
}

for (const mode of ["live-mode", "auto-mode", "throwing-notifier"]) {
  test(`synthetic RTL catalog preserves language and focus through ${mode}`, async ({
    page,
  }) => {
    await page.evaluate((deliveryMode) => {
      const fixture = window.generativeA11yATFixture;
      fixture.reset({ syntheticCatalog: true, attention: true });
      fixture.actions[deliveryMode]!();
      fixture.actions["clear-ledgers"]!();
      document.getElementById("composer")!.focus();
      fixture.dispatch({ type: "attention.override", mode: "quiet" });
      fixture.dispatch({
        type: "response.started",
        responseId: "rtl",
        locale: "en",
      });
      fixture.dispatch({
        type: "response.text.delta",
        responseId: "rtl",
        locale: "en",
        delta: "Suppressed English text. ",
      });
      fixture.dispatch({ type: "response.completed", responseId: "rtl" });
      fixture.drain();
    }, mode);
    await expect(
      page.locator('#announcement-ledger [data-text="إشعار تجريبي."]'),
    ).toHaveCount(1);
    await expect(page.locator("#announcement-ledger")).not.toContainText(
      "Suppressed English text.",
    );
    await expect(page.locator("#fixture-live-polite")).toHaveAttribute(
      "lang",
      "ar",
    );
    await expect(page.locator("#composer")).toBeFocused();
    await page.evaluate(() => window.generativeA11yATFixture.reset());
  });
}
