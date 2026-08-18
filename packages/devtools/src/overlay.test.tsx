// @vitest-environment jsdom

import { fireEvent } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";

import { createDevtoolsStore } from "./index.js";
import { mountDevtoolsOverlay } from "./overlay.js";

afterEach(() => document.body.replaceChildren());

test("mounts explicitly in an isolated shadow root without stealing focus or creating a live region", () => {
  const launcher = document.createElement("button");
  launcher.textContent = "Host action";
  document.body.append(launcher);
  launcher.focus();
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });

  expect(document.activeElement).toBe(launcher);
  expect(mounted.host.shadowRoot).not.toBeNull();
  const panel = mounted.host.shadowRoot?.querySelector("aside");
  expect(panel?.hidden).toBe(true);
  expect(
    mounted.host.shadowRoot?.querySelector('[aria-live], [role="log"]'),
  ).toBeNull();

  const button =
    mounted.host.shadowRoot?.querySelector<HTMLButtonElement>("button");
  if (!button) throw new Error("launcher missing");
  fireEvent.pointerDown(button);
  button.focus();
  fireEvent.click(button);
  expect(panel?.hidden).toBe(false);
  expect(mounted.host.shadowRoot?.activeElement).toBe(panel);
  button.focus();
  fireEvent.keyDown(button, { key: "Escape" });
  expect(panel?.hidden).toBe(true);
  expect(document.activeElement).toBe(launcher);

  mounted.dispose();
  expect(mounted.host.isConnected).toBe(false);
});

test("disposing an open overlay restores the previously focused host element", () => {
  const hostAction = document.createElement("button");
  document.body.append(hostAction);
  hostAction.focus();
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const launcher =
    mounted.host.shadowRoot?.querySelector<HTMLButtonElement>("button");
  if (!launcher) throw new Error("launcher missing");
  fireEvent.pointerDown(launcher);
  launcher.focus();
  fireEvent.click(launcher);

  mounted.dispose();

  expect(document.activeElement).toBe(hostAction);
  expect(mounted.host.isConnected).toBe(false);
});
