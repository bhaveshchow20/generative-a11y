// @vitest-environment jsdom

import { fireEvent, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";

import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";

import { createDevtoolsStore } from "./index.js";
import { mountDevtoolsOverlay } from "./overlay.js";

class TestResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  value: TestResizeObserver,
});

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
  expect(panel?.classList.contains("ga-bottom-dock")).toBe(true);
  expect(
    mounted.host.shadowRoot?.querySelector(".ga-launcher-mark"),
  ).toBeNull();
  expect(
    mounted.host.shadowRoot?.querySelector('[aria-live], [role="log"]'),
  ).toBeNull();

  const button =
    mounted.host.shadowRoot?.querySelector<HTMLButtonElement>("button");
  if (!button) throw new Error("launcher missing");
  expect(button.textContent).toBe("Open workspace");
  fireEvent.click(button);
  expect(panel?.hidden).toBe(false);
  expect(panel?.getAttribute("data-state")).toBe("expanded");
  fireEvent.keyDown(panel ?? document.body, { key: "Escape" });
  expect(panel?.hidden).toBe(true);
  expect(document.activeElement).toBe(launcher);

  mounted.dispose();
  expect(mounted.host.isConnected).toBe(false);
});

test("renders a visual trace map and confirms local workspace actions", async () => {
  const clock = new ManualClock();
  const runtime = createGenerativeA11y({
    clock,
    onAnnouncement: () => undefined,
  });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "support", runtime });
  runtime.dispatch({ type: "response.started", responseId: "reply-1" });
  runtime.dispatch({ type: "response.completed", responseId: "reply-1" });
  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>("button");
  if (!root || !launcher) throw new Error("workspace launcher missing");

  fireEvent.click(launcher);
  expect(root.querySelector('[data-testid="trace-map"]')).not.toBeNull();
  expect(root.textContent).toContain("Trace map");
  const traceNode = root.querySelector<SVGGElement>("[data-trace-key]");
  if (!traceNode) throw new Error("trace node missing");
  fireEvent.click(traceNode);
  expect(
    root.querySelector('[data-testid="trace-map-selection"]')?.textContent,
  ).toContain("Selected signal");

  const pause = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Pause capture",
  );
  if (!pause) throw new Error("pause action missing");
  fireEvent.click(pause);
  await waitFor(() =>
    expect(
      root.querySelector('[data-testid="workspace-feedback"]')?.textContent,
    ).toContain("Capture paused"),
  );
  mounted.dispose();
});

test("provides a searchable, inspectable workbench with runtime actions", async () => {
  const clock = new ManualClock();
  const runtime = createGenerativeA11y({
    clock,
    onAnnouncement: () => undefined,
  });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "support", runtime });
  runtime.dispatch({ type: "response.started", responseId: "reply-1" });
  runtime.dispatch({
    type: "connection.lost",
    label: "Private connection label",
  });
  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>("button");
  if (!root || !launcher) throw new Error("inspector launcher missing");

  fireEvent.click(launcher);
  expect(root.textContent).toContain("Trace");
  expect(root.textContent).toContain("Events");
  expect(root.textContent).toContain("Runtime");
  expect(root.textContent).toContain("Export trace");
  expect(root.textContent).not.toContain("Private connection label");

  const timeline = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Events",
  );
  if (!timeline) throw new Error("timeline tab missing");
  fireEvent.mouseDown(timeline, { button: 0 });
  expect(timeline.getAttribute("data-state")).toBe("active");
  await waitFor(() =>
    expect(
      root.querySelector<HTMLInputElement>('input[type="search"]'),
    ).not.toBeNull(),
  );
  const search = root.querySelector<HTMLInputElement>('input[type="search"]');
  fireEvent.change(search as HTMLInputElement, {
    target: { value: "connection" },
  });
  expect(root.textContent).toContain("connection.lost");

  const pause = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Pause capture",
  );
  if (!pause) throw new Error("pause action missing");
  fireEvent.click(pause);
  expect(root.textContent).toContain("Capture paused");
  mounted.dispose();
});

test("reports only the latest copy completion and ignores stale failures", async () => {
  let rejectFirst: ((reason?: unknown) => void) | undefined;
  let resolveSecond: (() => void) | undefined;
  const first = new Promise<void>((_resolve, reject) => {
    rejectFirst = reject;
  });
  const second = new Promise<void>((resolve) => {
    resolveSecond = resolve;
  });
  const copyText = vi
    .fn()
    .mockReturnValueOnce(first)
    .mockReturnValueOnce(second);
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
    copyText,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("inspector launcher missing");
  fireEvent.click(launcher);
  const exportButton = [
    ...root.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.includes("Export trace"));
  if (!exportButton) throw new Error("export action missing");

  fireEvent.click(exportButton);
  expect(root.textContent).toContain("Copying trace");
  expect(root.textContent).not.toContain("Trace copied");
  fireEvent.click(exportButton);
  resolveSecond?.();
  await waitFor(() => expect(root.textContent).toContain("Trace copied"));
  rejectFirst?.(new Error("clipboard denied"));
  await waitFor(() => expect(copyText).toHaveBeenCalledTimes(2));
  expect(root.textContent).toContain("Trace copied");
  expect(root.textContent).not.toContain("Copy unavailable");
  mounted.dispose();
});

test("cancels copy-status cleanup when the workbench closes", async () => {
  const clearTimeout = vi.spyOn(window, "clearTimeout");
  const setTimeout = vi.spyOn(window, "setTimeout");
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
    copyText: () => Promise.resolve(),
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("inspector launcher missing");
  fireEvent.click(launcher);
  const exportButton = [
    ...root.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.includes("Export trace"));
  if (!exportButton) throw new Error("export action missing");
  fireEvent.click(exportButton);
  await waitFor(() => expect(root.textContent).toContain("Trace copied"));
  const timerIndex = setTimeout.mock.calls.findIndex(
    ([, delay]) => delay === 2_200,
  );
  expect(timerIndex).toBeGreaterThanOrEqual(0);
  const timer = setTimeout.mock.results[timerIndex]?.value;

  const close = root.querySelector<HTMLButtonElement>(
    'button[aria-label="Close inspector"]',
  );
  if (!close) throw new Error("close action missing");
  fireEvent.click(close);

  expect(clearTimeout).toHaveBeenCalledWith(timer);
  mounted.dispose();
  clearTimeout.mockRestore();
  setTimeout.mockRestore();
});

test("disposing an open workspace restores host focus", async () => {
  const hostAction = document.createElement("button");
  document.body.append(hostAction);
  hostAction.focus();
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const launcher =
    mounted.host.shadowRoot?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!launcher) throw new Error("workspace launcher missing");
  fireEvent.pointerDown(launcher);
  launcher.focus();
  fireEvent.click(launcher);
  await waitFor(() =>
    expect(
      mounted.host.shadowRoot?.querySelector('[data-testid="trace-map"]'),
    ).not.toBeNull(),
  );

  mounted.dispose();

  expect(document.activeElement).toBe(hostAction);
  expect(mounted.host.isConnected).toBe(false);
});
