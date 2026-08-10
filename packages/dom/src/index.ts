import type {
  AnnouncementIntent,
  GenerativeA11yRuntime,
} from "@generative-a11y/core";

export {
  createAttentionStore,
  type AttentionIntersectionObserver,
  type AttentionIntersectionObserverFactory,
  type AttentionSnapshot,
  type AttentionStore,
  type AttentionStoreOptions,
  type ExternalStore,
} from "./attention.js";

export {
  captureFocus,
  focusElement,
  restoreFocus,
  type FocusCapture,
  type FocusElementOptions,
  type FocusResult,
  type FocusSkippedReason,
  type RestoreFocusOptions,
} from "./focus.js";

export {
  createPreferenceStore,
  defaultPreferences,
  preferencesToCoreConfiguration,
  type CorePreferenceConfiguration,
  type PreferenceDiagnostic,
  type PreferenceDiagnosticCode,
  type PreferenceDiagnosticSource,
  type PreferencePersistence,
  type PreferenceSchemaV1,
  type PreferenceStorage,
  type PreferenceStorageEvent,
  type PreferenceStorageEventSource,
  type PreferenceStore,
  type PreferenceStoreOptions,
  type StreamingVerbosity,
  type ToolVerbosity,
} from "./preferences.js";

export type DOMAnnouncementMode = "auto" | "aria-notify" | "live-region";

export interface DOMLiveRegions {
  polite: HTMLElement;
  assertive: HTMLElement;
}

export interface DOMDeliveryResult {
  status: "notified" | "mutated" | "unavailable" | "disposed";
  method: "aria-notify" | "live-region" | "none";
  channel: AnnouncementIntent["channel"];
  error?: { name: string; message: string };
}

export interface DOMAnnouncerOptions {
  document?: Document;
  mode?: DOMAnnouncementMode;
  regions?: DOMLiveRegions;
  onDiagnostic?: (result: DOMDeliveryResult) => void;
}

export interface DOMAnnouncer {
  announce(intent: AnnouncementIntent): DOMDeliveryResult;
  getRegions(): DOMLiveRegions | undefined;
  dispose(): void;
}

export interface DOMRuntimeBinding {
  announcer: DOMAnnouncer;
  dispose(): void;
}

export function createDOMAnnouncer(
  options: DOMAnnouncerOptions = {},
): DOMAnnouncer {
  validateSuppliedRegions(options);
  const selectedDocument =
    options.document ??
    options.regions?.polite.ownerDocument ??
    (typeof document === "undefined" ? undefined : document);
  const ownsRegions = options.regions === undefined;
  const regions = options.regions ?? createLiveRegions(selectedDocument);

  if (regions) {
    configureRegion(regions.polite, "polite");
    configureRegion(regions.assertive, "assertive");
  }
  let notifierEnabled = true;
  let disposed = false;

  const report = (result: DOMDeliveryResult): DOMDeliveryResult => {
    try {
      options.onDiagnostic?.(result);
    } catch {
      // Diagnostics are observational and cannot affect delivery.
    }
    return result;
  };

  return {
    announce(intent) {
      if (disposed) {
        return report({
          status: "disposed",
          method: "none",
          channel: intent.channel,
        });
      }
      if (regions) {
        const region = regions[intent.channel];
        applyLocale(region, intent.locale);
        let error: DOMDeliveryResult["error"];
        if (notifierEnabled && options.mode !== "live-region") {
          let notified = false;
          try {
            const ariaNotify = (region as AriaNotifyRegion).ariaNotify;
            if (typeof ariaNotify === "function") {
              ariaNotify.call(region, intent.text, {
                priority: intent.channel === "assertive" ? "high" : "normal",
              });
              notified = true;
            }
          } catch (cause) {
            notifierEnabled = false;
            error = serializeError(cause);
          }
          if (notified) {
            return report({
              status: "notified",
              method: "aria-notify",
              channel: intent.channel,
            });
          }
        }
        region.textContent = intent.text;
        return report({
          status: "mutated",
          method: "live-region",
          channel: intent.channel,
          ...(error === undefined ? {} : { error }),
        });
      }
      return report({
        status: "unavailable",
        method: "none",
        channel: intent.channel,
      });
    },
    getRegions() {
      return regions;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (ownsRegions) {
        regions?.polite.remove();
        regions?.assertive.remove();
      }
    },
  };
}

function validateSuppliedRegions(options: DOMAnnouncerOptions): void {
  if (options.regions === undefined) return;
  const { polite, assertive } = options.regions;
  if (polite === assertive) {
    throw new TypeError(
      "Polite and assertive regions must be distinct elements",
    );
  }
  if (polite.contains(assertive) || assertive.contains(polite)) {
    throw new TypeError(
      "Polite and assertive regions must not contain one another",
    );
  }
  if (polite.ownerDocument !== assertive.ownerDocument) {
    throw new TypeError(
      "Polite and assertive regions must belong to the same document",
    );
  }
  if (
    options.document !== undefined &&
    (polite.ownerDocument !== options.document ||
      assertive.ownerDocument !== options.document)
  ) {
    throw new TypeError(
      "Supplied regions must belong to the provided document",
    );
  }
}

function serializeError(
  error: unknown,
): NonNullable<DOMDeliveryResult["error"]> {
  try {
    if (error instanceof Error) {
      return {
        name: readErrorString(error, "name", "Error"),
        message: readErrorString(error, "message", "Unknown error"),
      };
    }
  } catch {
    // Hostile proxies can throw during instanceof checks.
  }
  return { name: "Error", message: safeString(error, "Unknown error") };
}

function readErrorString(
  error: Error,
  property: "name" | "message",
  fallback: string,
): string {
  try {
    return safeString(error[property], fallback);
  } catch {
    return fallback;
  }
}

function safeString(value: unknown, fallback: string): string {
  try {
    return String(value);
  } catch {
    return fallback;
  }
}

interface AriaNotifyRegion extends HTMLElement {
  ariaNotify?: (text: string, options: { priority: "normal" | "high" }) => void;
}

function createLiveRegions(
  selectedDocument: Document | undefined,
): DOMLiveRegions | undefined {
  const parent = selectedDocument?.body ?? selectedDocument?.documentElement;
  if (!selectedDocument || !parent) return undefined;

  const regions = {
    polite: selectedDocument.createElement("div"),
    assertive: selectedDocument.createElement("div"),
  };
  parent.append(regions.polite, regions.assertive);
  return regions;
}

function configureRegion(
  region: HTMLElement,
  channel: AnnouncementIntent["channel"],
): void {
  region.removeAttribute("role");
  region.removeAttribute("aria-busy");
  region.removeAttribute("hidden");
  region.removeAttribute("aria-hidden");
  region.inert = false;
  region.removeAttribute("inert");
  region.style.removeProperty("display");
  region.style.removeProperty("visibility");
  region.style.removeProperty("content-visibility");
  region.setAttribute("aria-live", channel);
  region.setAttribute("aria-atomic", "true");
  region.setAttribute("aria-relevant", "additions text");
  Object.assign(region.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
  });
}

function applyLocale(region: HTMLElement, locale: string | undefined): void {
  if (locale === undefined) region.removeAttribute("lang");
  else region.setAttribute("lang", locale);
}

export function connectRuntimeToDOM(
  runtime: GenerativeA11yRuntime,
  options: DOMAnnouncerOptions = {},
): DOMRuntimeBinding {
  const announcer = createDOMAnnouncer(options);
  let disposed = false;
  let unsubscribe: () => void;
  try {
    unsubscribe = runtime.subscribeAnnouncements((intent) => {
      if (!disposed) announcer.announce(intent);
    });
  } catch (cause) {
    announcer.dispose();
    throw cause;
  }

  return {
    announcer,
    dispose() {
      if (disposed) return;
      disposed = true;
      try {
        unsubscribe();
      } finally {
        announcer.dispose();
      }
    },
  };
}
