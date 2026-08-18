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

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: () => undefined,
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
  expect(root.textContent).toContain("Overview");
  expect(root.textContent).toContain("Timeline");
  expect(root.textContent).toContain("Runtime");
  expect(root.textContent).toContain("Export trace");
  expect(root.textContent).not.toContain("Private connection label");

  const timeline = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Timeline",
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

test("synchronizes a store update that occurs while subscribing", async () => {
  const store = createDevtoolsStore();
  let updateDuringSubscribe = true;
  const synchronizingStore = {
    ...store,
    subscribe(listener: () => void) {
      if (updateDuringSubscribe) {
        updateDuringSubscribe = false;
        store.pauseCapture();
      }
      return store.subscribe(listener);
    },
  };
  const mounted = mountDevtoolsOverlay({
    store: synchronizingStore,
    document,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("inspector launcher missing");

  fireEvent.click(launcher);

  await waitFor(() => expect(root.textContent).toContain("Capture paused"));
  mounted.dispose();
});

test("shows capture sequence for delivery records without runtime sequence", async () => {
  const store = createDevtoolsStore();
  store.recordDelivery({
    runtimeId: "primary",
    result: {
      announcementId: "delivery-1",
      at: 10,
      channel: "polite",
      method: "live-region",
      sourceType: "response.completed",
      status: "mutated",
    },
  });
  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("inspector launcher missing");
  fireEvent.click(launcher);
  const timeline = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Timeline",
  );
  if (!timeline) throw new Error("timeline tab missing");
  fireEvent.mouseDown(timeline, { button: 0 });
  const record = await waitFor(() => {
    const value = root.querySelector<HTMLButtonElement>(
      ".ga-inspector-trace-row",
    );
    if (!value) throw new Error("trace record missing");
    return value;
  });
  fireEvent.click(record);

  expect(root.textContent).toContain("Capture sequence");
  expect(root.textContent).not.toContain("Runtime sequence");
  mounted.dispose();
});

test("focuses the command search, closes it before the overlay, and restores focus", async () => {
  const hostAction = document.createElement("button");
  document.body.append(hostAction);
  hostAction.focus();
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("inspector launcher missing");
  fireEvent.pointerDown(launcher);
  launcher.focus();
  fireEvent.click(launcher);

  const commands = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes("Commands"),
  );
  if (!commands) throw new Error("command trigger missing");
  const hostShortcut = vi.fn();
  document.addEventListener("keydown", hostShortcut);
  const inspector = root.querySelector<HTMLElement>(".ga-inspector");
  if (!inspector) throw new Error("inspector missing");
  fireEvent.keyDown(inspector, { key: "k", ctrlKey: true });
  expect(hostShortcut).not.toHaveBeenCalled();
  document.removeEventListener("keydown", hostShortcut);
  const input = root.querySelector<HTMLInputElement>(
    '[data-slot="command-input"]',
  );
  await waitFor(() => expect(root.activeElement).toBe(input));

  fireEvent.keyDown(input as HTMLInputElement, { key: "Escape" });
  await waitFor(() => expect(root.querySelector('[role="dialog"]')).toBeNull());
  await waitFor(() => expect(root.activeElement).toBe(commands));
  expect(root.querySelector("aside")?.hidden).toBe(false);

  fireEvent.keyDown(commands, { key: "Escape" });
  expect(root.querySelector("aside")?.hidden).toBe(true);
  expect(document.activeElement).toBe(hostAction);

  fireEvent.click(launcher);
  fireEvent.click(commands);
  await waitFor(() =>
    expect(root.querySelector('[role="dialog"]')).not.toBeNull(),
  );
  const close = root.querySelector<HTMLButtonElement>(
    'button[aria-label="Close inspector"]',
  );
  if (!close) throw new Error("close action missing");
  fireEvent.click(close);
  fireEvent.click(launcher);
  expect(root.querySelector('[role="dialog"]')).toBeNull();
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
  await first.catch(() => undefined);
  await waitFor(() => {
    expect(copyText).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain("Trace copied");
    expect(root.textContent).not.toContain("Copy unavailable");
  });
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
    ([, delay]) => delay === 1_800,
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

test("cancels pending copy-status cleanup on direct disposal", async () => {
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
    ([, delay]) => delay === 1_800,
  );
  expect(timerIndex).toBeGreaterThanOrEqual(0);
  const timer = setTimeout.mock.results[timerIndex]?.value;

  mounted.dispose();

  expect(clearTimeout).toHaveBeenCalledWith(timer);
  clearTimeout.mockRestore();
  setTimeout.mockRestore();
});

test("disposing an open workbench restores host focus", async () => {
  const hostAction = document.createElement("button");
  document.body.append(hostAction);
  hostAction.focus();
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const launcher =
    mounted.host.shadowRoot?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!launcher) throw new Error("inspector launcher missing");
  fireEvent.pointerDown(launcher);
  launcher.focus();
  fireEvent.click(launcher);
  await waitFor(() =>
    expect(mounted.host.shadowRoot?.textContent).toContain("Overview"),
  );

  mounted.dispose();

  expect(document.activeElement).toBe(hostAction);
  expect(mounted.host.isConnected).toBe(false);
});
