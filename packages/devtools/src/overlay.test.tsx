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

const scrollIntoView = vi.fn();
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: scrollIntoView,
});

afterEach(() => {
  document.body.replaceChildren();
  scrollIntoView.mockClear();
});

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
  fireEvent.pointerDown(button);
  button.focus();
  fireEvent.click(button);
  expect(panel?.hidden).toBe(false);
  expect(panel?.getAttribute("data-state")).toBe("expanded");
  fireEvent.keyDown(panel ?? document.body, { key: "Escape" });
  expect(panel?.hidden).toBe(true);
  expect(document.activeElement).toBe(launcher);

  mounted.dispose();
  expect(mounted.host.isConnected).toBe(false);
});

test("renders a causal trace explorer and confirms local workspace actions", async () => {
  const clock = new ManualClock();
  const runtime = createGenerativeA11y({
    clock,
    onAnnouncement: () => undefined,
  });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "support", runtime });
  runtime.dispatch({ type: "response.started", responseId: "reply-1" });
  runtime.dispatch({ type: "response.completed", responseId: "reply-1" });
  store.recordDelivery({
    runtimeId: "support",
    result: {
      announcementId: "delivery-1",
      at: 10,
      channel: "polite",
      method: "live-region",
      responseId: "reply-1",
      sourceType: "response.completed",
      status: "mutated",
    },
  });
  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>("button");
  if (!root || !launcher) throw new Error("workspace launcher missing");

  fireEvent.click(launcher);
  expect(root.querySelector('[data-testid="causal-chain"]')).not.toBeNull();
  expect(root.textContent).toContain("Accessibility trace");
  const traceList = root.querySelector<HTMLElement>('[role="listbox"]');
  if (!traceList) throw new Error("trace list missing");
  const initialSelection = traceList.getAttribute("aria-activedescendant");
  fireEvent.keyDown(traceList, { key: "ArrowDown" });
  expect(traceList.getAttribute("aria-activedescendant")).not.toBe(
    initialSelection,
  );
  expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
  expect(
    root.querySelector('[data-testid="trace-detail"]')?.textContent,
  ).toContain("Related evidence");
  const deliveryFilter = [
    ...root.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent === "Delivery");
  if (!deliveryFilter) throw new Error("delivery filter missing");
  fireEvent.click(deliveryFilter);
  const options = [...traceList.querySelectorAll('[role="option"]')];
  expect(options.length).toBeGreaterThan(0);
  expect(
    options.every((option) => option.textContent?.includes("DOM delivery")),
  ).toBe(true);

  const pause = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Pause",
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

test("correlates source and decision records when no event id was supplied", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "support", runtime });
  runtime.dispatch({ type: "response.started", responseId: "reply-1" });
  const announcementId = store
    .getSnapshot()
    .records.find((record) => record.kind === "decision")?.announcementId;
  store.recordDelivery({
    runtimeId: "support",
    result: {
      announcementId: announcementId ?? "delivery-1",
      at: 10,
      channel: "polite",
      method: "live-region",
      responseId: "reply-1",
      sourceType: "response.started",
      status: "mutated",
    },
  });
  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);

  expect(
    root.querySelector('[data-testid="causal-chain"]')?.textContent,
  ).toContain("3 records");
  mounted.dispose();
});

test("renders workflow identity, hierarchy, attempt, and terminal state", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "workflow", runtime });
  runtime.dispatch({ type: "run.started", runId: "parent" });
  runtime.dispatch({
    type: "run.started",
    runId: "child",
    runInstanceId: "attempt-1",
    parentRunId: "parent",
  });
  runtime.dispatch({
    type: "step.started",
    runId: "child",
    runInstanceId: "attempt-1",
    stepId: "search",
    stepInstanceId: "step-attempt-1",
    label: "Search",
  });
  store.refreshSnapshots();

  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>("button");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);

  const detail = root.querySelector('[data-testid="trace-detail"]');
  expect(detail?.textContent).toContain("Workflow hierarchy");
  expect(detail?.textContent).toContain("child");
  expect(detail?.textContent).toContain("attempt-1");
  expect(detail?.textContent).toContain("search");
  expect(detail?.textContent).toContain("active");
  mounted.dispose();
});

test("joins run, step, and tool evidence into a hierarchical causal chain", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "workflow", runtime });
  runtime.dispatch({ type: "run.started", runId: "run" });
  runtime.dispatch({
    type: "step.started",
    runId: "run",
    stepId: "search",
    label: "Search",
  });
  runtime.dispatch({
    type: "tool.started",
    toolId: "browser",
    runId: "run",
    stepId: "search",
    label: "Browser",
  });

  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);

  const chain = root.querySelector('[data-testid="causal-chain"]')?.textContent;
  expect(chain).toContain("run.started");
  expect(chain).toContain("step.started");
  expect(chain).toContain("tool.started");
  mounted.dispose();
});

test("links a retry record to its replacement run attempt", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "workflow", runtime });
  runtime.dispatch({
    type: "run.started",
    runId: "run",
    runInstanceId: "attempt-1",
  });
  runtime.dispatch({
    type: "run.retrying",
    runId: "run",
    runInstanceId: "attempt-1",
    nextRunInstanceId: "attempt-2",
  });
  runtime.dispatch({
    type: "run.completed",
    runId: "run",
    runInstanceId: "attempt-2",
  });

  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const retry = [...root.querySelectorAll<HTMLElement>(".ga-trace-row")].find(
    (row) => row.textContent?.includes("run.retrying"),
  );
  if (!retry) throw new Error("run retry record missing");
  fireEvent.click(retry);

  expect(
    root.querySelector('[data-testid="causal-chain"]')?.textContent,
  ).toContain("run.completed");
  mounted.dispose();
});

test("does not display a newer attempt snapshot for an older record", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "workflow", runtime });
  runtime.dispatch({
    type: "run.started",
    runId: "run",
    runInstanceId: "attempt-1",
  });
  runtime.dispatch({
    type: "run.started",
    runId: "run",
    runInstanceId: "attempt-2",
  });
  store.refreshSnapshots();

  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const oldStart = [...root.querySelectorAll<HTMLElement>(".ga-trace-row")]
    .filter((row) => row.textContent?.includes("run.started"))
    .at(-1);
  if (!oldStart) throw new Error("older run start record missing");
  fireEvent.click(oldStart);

  const detail = root.querySelector('[data-testid="trace-detail"]');
  expect(detail?.textContent).toContain("attempt-1");
  expect(detail?.textContent).toContain("Run stateNot retained");
  mounted.dispose();
});

test("does not infer an attempt snapshot for a record without attempt identity", () => {
  const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
  const store = createDevtoolsStore();
  store.attachRuntime({ id: "workflow", runtime });
  runtime.dispatch({ type: "run.started", runId: "run" });
  runtime.dispatch({
    type: "run.started",
    runId: "run",
    runInstanceId: "attempt-2",
  });
  store.refreshSnapshots();

  const mounted = mountDevtoolsOverlay({ store, document });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const unidentifiedStart = [
    ...root.querySelectorAll<HTMLElement>(".ga-trace-row"),
  ]
    .filter((row) => row.textContent?.includes("run.started"))
    .at(-1);
  if (!unidentifiedStart) throw new Error("unidentified run start missing");
  fireEvent.click(unidentifiedStart);

  const detail = root.querySelector('[data-testid="trace-detail"]');
  expect(detail?.textContent).toContain("Run attemptNot supplied");
  expect(detail?.textContent).toContain("Run stateNot retained");
  mounted.dispose();
});

test("cancels feedback cleanup when the workspace unmounts", async () => {
  const clearTimeout = vi.spyOn(window, "clearTimeout");
  const setTimeout = vi.spyOn(window, "setTimeout");
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const pause = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Pause",
  );
  if (!pause) throw new Error("pause action missing");
  fireEvent.click(pause);
  await waitFor(() =>
    expect(
      root.querySelector('[data-testid="workspace-feedback"]'),
    ).not.toBeNull(),
  );
  const feedbackTimerIndex = setTimeout.mock.calls.findIndex(
    ([, delay]) => delay === 2_200,
  );
  expect(feedbackTimerIndex).toBeGreaterThanOrEqual(0);
  const feedbackTimer = setTimeout.mock.results[feedbackTimerIndex]?.value;
  mounted.dispose();
  expect(clearTimeout).toHaveBeenCalledWith(feedbackTimer);
  clearTimeout.mockRestore();
  setTimeout.mockRestore();
});

test("unmounts feedback when the launcher collapses the workspace", async () => {
  const clearTimeout = vi.spyOn(window, "clearTimeout");
  const setTimeout = vi.spyOn(window, "setTimeout");
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const pause = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Pause",
  );
  if (!pause) throw new Error("pause action missing");
  fireEvent.click(pause);
  await waitFor(() =>
    expect(
      root.querySelector('[data-testid="workspace-feedback"]'),
    ).not.toBeNull(),
  );
  const timerIndex = setTimeout.mock.calls.findIndex(
    ([, delay]) => delay === 2_200,
  );
  expect(timerIndex).toBeGreaterThanOrEqual(0);
  const timer = setTimeout.mock.results[timerIndex]?.value;

  fireEvent.click(launcher);

  expect(clearTimeout).toHaveBeenCalledWith(timer);
  expect(root.querySelector('[data-testid="workspace-feedback"]')).toBeNull();
  fireEvent.click(launcher);
  expect(root.querySelector('[data-testid="workspace-feedback"]')).toBeNull();
  mounted.dispose();
  clearTimeout.mockRestore();
  setTimeout.mockRestore();
});

test("confirms copy only after the clipboard operation completes", async () => {
  let rejectCopy: ((reason?: unknown) => void) | undefined;
  const pendingCopy = new Promise<void>((_resolve, reject) => {
    rejectCopy = reject;
  });
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
    copyText: () => pendingCopy,
  });
  const root = mounted.host.shadowRoot;
  const launcher = root?.querySelector<HTMLButtonElement>(".ga-launcher");
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const copy = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === "Copy",
  );
  if (!copy) throw new Error("copy action missing");
  fireEvent.click(copy);
  expect(root.textContent).toContain("Copying trace");
  expect(root.textContent).not.toContain("Trace copied");
  rejectCopy?.(new Error("clipboard denied"));
  await waitFor(() =>
    expect(root.textContent).toContain("Copy could not complete"),
  );
  mounted.dispose();
});

test("ignores completion from an older copy request", async () => {
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
  if (!root || !launcher) throw new Error("workspace launcher missing");
  fireEvent.click(launcher);
  const copy = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.trim() === "Copy",
  );
  if (!copy) throw new Error("copy action missing");

  fireEvent.click(copy);
  fireEvent.click(copy);
  resolveSecond?.();
  await waitFor(() => expect(root.textContent).toContain("Trace copied"));
  rejectFirst?.(new Error("clipboard denied"));
  await waitFor(() => expect(copyText).toHaveBeenCalledTimes(2));
  expect(root.textContent).toContain("Trace copied");
  expect(root.textContent).not.toContain("Copy could not complete");
  mounted.dispose();
});

test("keeps the trace surface intentionally spacious instead of compressing it into a dashboard", () => {
  const mounted = mountDevtoolsOverlay({
    store: createDevtoolsStore(),
    document,
  });
  const styles = mounted.host.shadowRoot?.querySelector("style")?.textContent;
  expect(styles).toContain("padding: 22px 24px");
  expect(styles).toContain("grid-template-columns: 76px 110px");
  expect(styles).toContain(
    '[data-slot="resizable-handle"] { width: 100%; height: 1px; }',
  );
  expect(styles).not.toContain(".ga-trace-map");
  expect(styles).not.toContain('[data-slot="tabs-');
  expect(styles).not.toContain('[data-slot="command-');
  expect(styles).not.toContain(".ga-inspector-metric");
  expect(styles).not.toContain(".ga-inspector-timeline");
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
  expect(root.textContent).toContain("Accessibility trace");
  expect(root.textContent).toContain("Source");
  expect(root.textContent).toContain("Decisions");
  expect(root.textContent).toContain("Copy");
  expect(root.textContent).not.toContain("Private connection label");

  const timeline = [...root.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent === "Source",
  );
  if (!timeline) throw new Error("timeline tab missing");
  fireEvent.click(timeline);
  expect(timeline.getAttribute("aria-pressed")).toBe("true");
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
    (button) => button.textContent === "Pause",
  );
  if (!pause) throw new Error("pause action missing");
  fireEvent.click(pause);
  expect(root.textContent).toContain("Capture paused");
  expect(
    root.querySelector('[role="status"][aria-live="polite"]'),
  ).not.toBeNull();
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
  const copyButton = [
    ...root.querySelectorAll<HTMLButtonElement>("button"),
  ].find((button) => button.textContent?.trim() === "Copy");
  if (!copyButton) throw new Error("copy action missing");
  fireEvent.click(copyButton);
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
    expect(mounted.host.shadowRoot?.textContent).toContain(
      "Accessibility trace",
    ),
  );

  mounted.dispose();

  expect(document.activeElement).toBe(hostAction);
  expect(mounted.host.isConnected).toBe(false);
});
