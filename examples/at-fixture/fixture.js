/* global document, queueMicrotask, window */

import {
  ManualClock,
  createGenerativeA11y,
} from "../../packages/core/dist/index.js";
import {
  captureFocus,
  createDOMAnnouncer,
  focusElement,
  restoreFocus,
} from "../../packages/dom/dist/index.js";

const elements = {
  polite: document.querySelector("#fixture-live-polite"),
  assertive: document.querySelector("#fixture-live-assertive"),
  eventLedger: document.querySelector("#event-ledger"),
  announcementLedger: document.querySelector("#announcement-ledger"),
  deliveryLedger: document.querySelector("#delivery-ledger"),
  deliveryMode: document.querySelector("#delivery-mode"),
  clock: document.querySelector("#clock-value"),
  currentFocus: document.querySelector("#current-focus"),
  composer: document.querySelector("#composer"),
  responseCopy: document.querySelector("#response-copy"),
  interaction: document.querySelector("#focus-interaction"),
  interactionResolution: document.querySelector("#interaction-resolution"),
  focusResult: document.querySelector("#focus-result"),
};

for (const [name, element] of Object.entries(elements)) {
  if (!element)
    throw new Error(`AT fixture is missing required element: ${name}`);
}

const ledgers = {
  events: [],
  announcements: [],
  deliveries: [],
};

let clock;
let runtime;
let announcer;
let capturedFocus;
let nextIdentity = 1;

function id(prefix) {
  return `${prefix}-${nextIdentity++}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function appendLedger(list, value, attributes = {}) {
  list.push(clone(value));
  const item = document.createElement("li");
  item.textContent = JSON.stringify(value);
  for (const [name, attributeValue] of Object.entries(attributes)) {
    item.dataset[name] = attributeValue;
  }
  return item;
}

function recordEvent(event) {
  elements.eventLedger.append(appendLedger(ledgers.events, event));
}

function recordAnnouncement(intent) {
  elements.announcementLedger.append(
    appendLedger(ledgers.announcements, intent, { text: intent.text }),
  );
}

function recordDelivery(result, intent) {
  const entry = {
    ...result,
    text: intent.text,
    ...(intent.locale ? { locale: intent.locale } : {}),
  };
  elements.deliveryLedger.append(
    appendLedger(ledgers.deliveries, entry, { text: intent.text }),
  );
}

function clearLedgers() {
  for (const list of Object.values(ledgers)) list.length = 0;
  elements.eventLedger.replaceChildren();
  elements.announcementLedger.replaceChildren();
  elements.deliveryLedger.replaceChildren();
}

function clearNotifierOverrides() {
  delete elements.polite.ariaNotify;
  delete elements.assertive.ariaNotify;
}

function setNotifierOverride(value) {
  for (const region of [elements.polite, elements.assertive]) {
    Object.defineProperty(region, "ariaNotify", {
      configurable: true,
      value,
    });
  }
}

function selectDeliveryMode(mode, notifier = "native") {
  announcer?.dispose();
  clearNotifierOverrides();
  if (notifier === "unavailable") setNotifierOverride(undefined);
  if (notifier === "throwing") {
    setNotifierOverride(() => {
      throw new Error("Fixture ariaNotify failure");
    });
  }
  announcer = createDOMAnnouncer({
    document,
    mode,
    regions: { polite: elements.polite, assertive: elements.assertive },
  });
  elements.deliveryMode.textContent =
    notifier === "native" ? mode : `${mode} / ${notifier}`;
}

function createRuntime() {
  clock = new ManualClock();
  runtime = createGenerativeA11y({
    clock,
    preset: "verbose",
    policy: {
      minimumGapMs: 20,
      dedupeWindowMs: 0,
      text: { minimumCharacters: 1, maximumDelayMs: 500 },
      tools: {
        announceStartAfterMs: 1_500,
        announceProgress: true,
        progressEveryPercent: 25,
      },
    },
    onAnnouncement(intent) {
      recordAnnouncement(intent);
      const result = announcer.announce(intent);
      recordDelivery(result, intent);
    },
  });
}

function updateClock() {
  elements.clock.textContent = `${clock.now()} ms`;
}

function advanceBy(duration) {
  clock.advanceBy(duration);
  updateClock();
}

function drain() {
  clock.runUntilIdle();
  updateClock();
}

function dispatch(event) {
  recordEvent(event);
  runtime.dispatch(event);
}

function announcePolite(text = "Routine status available.", locale) {
  dispatch({
    type: "interaction.requested",
    interactionId: id("polite"),
    kind: "confirmation",
    label: text,
    ...(locale ? { locale } : {}),
  });
  drain();
}

function announceAssertive(text = "Action is required now.") {
  dispatch({
    type: "interaction.requested",
    interactionId: id("assertive"),
    kind: "approval",
    label: text,
    urgent: true,
  });
  drain();
}

function repeatIdentical() {
  announcePolite("Repeated identical notice.");
  advanceBy(1);
  announcePolite("Repeated identical notice.");
}

function streamAndComplete() {
  const responseId = id("response");
  elements.responseCopy.textContent =
    "First deterministic sentence. Final fragment";
  dispatch({ type: "response.started", responseId });
  dispatch({
    type: "response.text.delta",
    responseId,
    delta: "First deterministic sentence. Final fragment",
  });
  dispatch({ type: "response.completed", responseId });
  drain();
}

function stopResponse() {
  const responseId = id("stopped-response");
  dispatch({ type: "response.started", responseId });
  dispatch({
    type: "response.text.delta",
    responseId,
    delta: "Cancelled pending sentence.",
  });
  dispatch({ type: "response.interrupted", responseId });
  elements.responseCopy.textContent =
    "Response stopped before pending text delivery.";
  drain();
}

function retryResponse() {
  const responseId = id("retried-response");
  dispatch({
    type: "response.started",
    responseId,
    responseInstanceId: "attempt-old",
  });
  dispatch({
    type: "response.text.delta",
    responseId,
    responseInstanceId: "attempt-old",
    delta: "Stale queued sentence.",
  });
  dispatch({
    type: "response.retrying",
    responseId,
    responseInstanceId: "attempt-old",
    nextResponseInstanceId: "attempt-new",
    attempt: 2,
  });
  dispatch({
    type: "response.text.delta",
    responseId,
    responseInstanceId: "attempt-old",
    delta: "Stale response sentence.",
  });
  dispatch({
    type: "response.text.delta",
    responseId,
    responseInstanceId: "attempt-new",
    delta: "Fresh response sentence. Final retry fragment",
  });
  dispatch({
    type: "response.completed",
    responseId,
    responseInstanceId: "attempt-new",
  });
  elements.responseCopy.textContent =
    "Fresh response sentence. Final retry fragment";
  drain();
}

function fastTool() {
  const toolId = id("fast-tool");
  dispatch({ type: "tool.started", toolId, label: "Fast lookup" });
  advanceBy(300);
  dispatch({ type: "tool.completed", toolId, label: "Fast lookup" });
  drain();
}

function slowTool() {
  const toolId = id("slow-tool");
  dispatch({ type: "tool.started", toolId, label: "Archive scan" });
  advanceBy(1_500);
  dispatch({
    type: "tool.progress",
    toolId,
    label: "Archive scan",
    progress: 0.5,
  });
  advanceBy(20);
  dispatch({
    type: "tool.completed",
    toolId,
    label: "Archive scan",
    summary: "Archive scan complete.",
  });
  drain();
}

function toolFailure() {
  const toolId = id("failed-tool");
  dispatch({ type: "tool.started", toolId, label: "Export" });
  dispatch({
    type: "tool.failed",
    toolId,
    label: "Export",
    announcement: "Export could not finish.",
  });
  drain();
}

function responseFailure() {
  const responseId = id("failed-response");
  dispatch({ type: "response.started", responseId });
  dispatch({
    type: "response.failed",
    responseId,
    error: "Fixture backend detail that must not be announced",
    announcement: "The response could not be generated.",
  });
  drain();
}

function actionableInteraction() {
  announceAssertive("Review and approve the requested action.");
}

function captureAndEnterInteraction() {
  capturedFocus = captureFocus(document);
  const result = focusElement(elements.interactionResolution);
  showFocusResult(result);
}

function restoreCapturedFocus() {
  const result = capturedFocus
    ? restoreFocus(capturedFocus, { onlyIfFocusWithin: elements.interaction })
    : { status: "skipped", reason: "unavailable" };
  showFocusResult(result);
  return result;
}

function showFocusResult(result) {
  elements.focusResult.textContent =
    result.status === "focused" ? "focused" : `skipped: ${result.reason}`;
}

function focusName(element) {
  if (!element || element === document.body) return "Document body";
  if (element === elements.composer) return "Message composer";
  if (element.id === "interaction-resolution") return "Resolve interaction";
  if (element.id === "unrelated-focus") return "Unrelated focus target";
  return (
    element.textContent?.trim().replace(/\s+/g, " ").slice(0, 48) ||
    element.tagName
  );
}

function updateFocus() {
  elements.currentFocus.textContent = focusName(document.activeElement);
}

function reset() {
  runtime?.dispose();
  announcer?.dispose();
  clearNotifierOverrides();
  clearLedgers();
  elements.polite.textContent = "";
  elements.assertive.textContent = "";
  elements.responseCopy.textContent = "No response scenario has run.";
  elements.focusResult.textContent = "No explicit focus operation yet.";
  capturedFocus = undefined;
  nextIdentity = 1;
  selectDeliveryMode("auto");
  createRuntime();
  updateClock();
  updateFocus();
}

const actions = {
  polite: () => announcePolite(),
  assertive: () => announceAssertive(),
  repeat: repeatIdentical,
  hostile: () =>
    announcePolite(
      '<img src=x onerror="window.__fixtureInjected=true"> Literal only.',
    ),
  english: () => announcePolite("English locale selected.", "en"),
  french: () => announcePolite("Paramètre français sélectionné.", "fr"),
  "non-latin": () => announcePolite("日本語の通知です。", "ja"),
  "clear-locale": () => announcePolite("Locale metadata cleared."),
  stream: streamAndComplete,
  stop: stopResponse,
  retry: retryResponse,
  "response-failure": responseFailure,
  "fast-tool": fastTool,
  "slow-tool": slowTool,
  "tool-failure": toolFailure,
  actionable: actionableInteraction,
  "live-mode": () => selectDeliveryMode("live-region"),
  "auto-mode": () => selectDeliveryMode("auto"),
  "auto-fallback": () => selectDeliveryMode("auto", "unavailable"),
  "throwing-notifier": () => {
    selectDeliveryMode("auto", "throwing");
    announcePolite("Throwing notifier fallback exercised.");
  },
  "capture-focus": captureAndEnterInteraction,
  "restore-focus": restoreCapturedFocus,
  "clear-ledgers": clearLedgers,
};

document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  actions[button.dataset.action]?.();
});
document.addEventListener("focusin", updateFocus);
document.addEventListener("focusout", () => queueMicrotask(updateFocus));

window.generativeA11yATFixture = Object.freeze({
  reset,
  captureAndEnterInteraction,
  restoreCapturedFocus,
  snapshot: () => clone({ ...ledgers, clock: clock.now() }),
  actions: Object.freeze({ ...actions }),
});

reset();
