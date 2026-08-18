import { composedContains, deepActiveElement } from "./composed-tree.js";

export interface ExternalStore<T> {
  subscribe(listener: () => void): () => void;
  getSnapshot(): T;
  getServerSnapshot(): T;
}

export interface AttentionSnapshot {
  readonly visibility: "visible" | "hidden" | "unknown";
  readonly windowFocus: "focused" | "blurred" | "unknown";
  readonly focusArea:
    "composer" | "conversation" | "elsewhere" | "none" | "unknown";
  readonly newestResponse: "visible" | "outside" | "unobserved" | "unknown";
  readonly mode:
    "foreground" | "background" | "reading-history" | "away" | "unknown";
}

export interface AttentionStore extends ExternalStore<AttentionSnapshot> {
  registerComposer(element: Element): () => void;
  registerConversation(element: Element): () => void;
  registerNewestResponse(element: Element): () => void;
  dispose(): void;
}

export interface AttentionStoreOptions {
  document?: Document;
  createIntersectionObserver?: AttentionIntersectionObserverFactory;
  intersectionObserverInit?: IntersectionObserverInit;
}

export interface AttentionIntersectionObserver {
  observe(target: Element): void;
  unobserve(target: Element): void;
  disconnect(): void;
}

export type AttentionIntersectionObserverFactory = (
  callback: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
) => AttentionIntersectionObserver;

const UNKNOWN_SNAPSHOT: AttentionSnapshot = Object.freeze({
  visibility: "unknown",
  windowFocus: "unknown",
  focusArea: "unknown",
  newestResponse: "unknown",
  mode: "unknown",
});

export function createAttentionStore(
  options: AttentionStoreOptions = {},
): AttentionStore {
  const selectedDocument =
    options.document ??
    (typeof document === "undefined" ? undefined : document);
  if (!selectedDocument) {
    return {
      subscribe: () => () => undefined,
      getSnapshot: () => UNKNOWN_SNAPSHOT,
      getServerSnapshot: () => UNKNOWN_SNAPSHOT,
      registerComposer: () => () => undefined,
      registerConversation: () => () => undefined,
      registerNewestResponse: () => () => undefined,
      dispose: () => undefined,
    };
  }

  const listeners = new Set<() => void>();
  const composers = new Map<Element, number>();
  const conversations = new Map<Element, number>();
  const selectedWindow = selectedDocument.defaultView;
  let disposed = false;
  let newestTarget: Element | undefined;
  let newestResult: AttentionSnapshot["newestResponse"] = "unobserved";
  let newestRegistration = 0;
  let observer: AttentionIntersectionObserver | undefined;
  let snapshot = makeSnapshot(
    selectedDocument,
    composers,
    conversations,
    newestResult,
  );
  const update = () => {
    if (disposed) return;
    const next = makeSnapshot(
      selectedDocument,
      composers,
      conversations,
      newestResult,
    );
    if (sameSnapshot(snapshot, next)) return;
    snapshot = next;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // External-store observers cannot prevent other observers from running.
      }
    }
  };
  const handleFocusOut = (event: FocusEvent) => {
    if (event.relatedTarget === null) update();
  };
  const listenerCleanups: Array<() => void> = [];
  const installListener = (install: () => void, cleanup: () => void): void => {
    // Register cleanup first because a hostile EventTarget can install and then
    // throw from addEventListener(). Removing a listener that was not installed
    // is harmless, while omitting cleanup would leak the accepted listener.
    listenerCleanups.push(cleanup);
    install();
  };
  const cleanupListeners = (): void => {
    for (const cleanup of listenerCleanups.splice(0).reverse()) {
      try {
        cleanup();
      } catch {
        // One hostile removal cannot strand the remaining listeners.
      }
    }
  };
  try {
    installListener(
      () => selectedDocument.addEventListener("visibilitychange", update),
      () => selectedDocument.removeEventListener("visibilitychange", update),
    );
    if (selectedWindow) {
      installListener(
        () => selectedWindow.addEventListener("focus", update),
        () => selectedWindow.removeEventListener("focus", update),
      );
      installListener(
        () => selectedWindow.addEventListener("blur", update),
        () => selectedWindow.removeEventListener("blur", update),
      );
    }
    installListener(
      () => selectedDocument.addEventListener("focusin", update),
      () => selectedDocument.removeEventListener("focusin", update),
    );
    installListener(
      () => selectedDocument.addEventListener("focusout", handleFocusOut),
      () => selectedDocument.removeEventListener("focusout", handleFocusOut),
    );
  } catch (error) {
    cleanupListeners();
    throw error;
  }

  const register = (
    elements: Map<Element, number>,
    element: Element,
  ): (() => void) => {
    if (disposed) throw new Error("AttentionStore is disposed");
    elements.set(element, (elements.get(element) ?? 0) + 1);
    update();
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      const remaining = (elements.get(element) ?? 1) - 1;
      if (remaining === 0) elements.delete(element);
      else elements.set(element, remaining);
      update();
    };
  };

  const createObserver = (
    registration: number,
    target: Element,
  ): AttentionIntersectionObserver | undefined => {
    const factory =
      options.createIntersectionObserver ??
      defaultIntersectionObserverFactory(selectedWindow);
    if (!factory) return undefined;
    let created: AttentionIntersectionObserver | undefined;
    try {
      created = factory((entries) => {
        if (
          disposed ||
          registration !== newestRegistration ||
          newestTarget !== target ||
          observer !== created
        ) {
          return;
        }
        let latest: IntersectionObserverEntry | undefined;
        for (const entry of entries) {
          if (entry.target === target) latest = entry;
        }
        if (!latest) return;
        newestResult = latest.isIntersecting ? "visible" : "outside";
        update();
      }, options.intersectionObserverInit);
      created.observe(target);
      return created;
    } catch {
      cleanupObserver(created, target);
      return undefined;
    }
  };

  const stopObserver = (target?: Element): void => {
    const current = observer;
    observer = undefined;
    cleanupObserver(current, target);
  };

  return {
    subscribe(listener) {
      if (disposed) throw new Error("AttentionStore is disposed");
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    getServerSnapshot: () => UNKNOWN_SNAPSHOT,
    registerComposer: (element) => register(composers, element),
    registerConversation: (element) => register(conversations, element),
    registerNewestResponse(element) {
      if (disposed) throw new Error("AttentionStore is disposed");
      const registration = ++newestRegistration;
      stopObserver(newestTarget);
      newestTarget = element;
      newestResult = "unknown";
      observer = createObserver(registration, element);
      update();
      let registered = true;
      return () => {
        if (!registered) return;
        registered = false;
        if (registration !== newestRegistration || newestTarget !== element)
          return;
        stopObserver(element);
        newestTarget = undefined;
        newestResult = "unobserved";
        update();
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      listeners.clear();
      composers.clear();
      conversations.clear();
      stopObserver(newestTarget);
      newestTarget = undefined;
      cleanupListeners();
    },
  };
}

function makeSnapshot(
  document: Document,
  composers: ReadonlyMap<Element, number>,
  conversations: ReadonlyMap<Element, number>,
  newestResponse: AttentionSnapshot["newestResponse"],
): AttentionSnapshot {
  const visibility = readVisibility(document);
  const windowFocus = readWindowFocus(document);
  return Object.freeze({
    visibility,
    windowFocus,
    focusArea: readFocusArea(document, composers, conversations),
    newestResponse,
    mode: deriveMode(visibility, windowFocus, newestResponse),
  });
}

function deriveMode(
  visibility: AttentionSnapshot["visibility"],
  windowFocus: AttentionSnapshot["windowFocus"],
  newestResponse: AttentionSnapshot["newestResponse"],
): AttentionSnapshot["mode"] {
  if (visibility === "hidden") return "background";
  if (visibility !== "visible") return "unknown";
  if (windowFocus === "blurred") return "away";
  if (windowFocus !== "focused") return "unknown";
  if (newestResponse === "outside") return "reading-history";
  if (newestResponse === "visible") return "foreground";
  return "unknown";
}

function defaultIntersectionObserverFactory(
  window: (Window & typeof globalThis) | null,
): AttentionIntersectionObserverFactory | undefined {
  const Constructor = window?.IntersectionObserver;
  if (typeof Constructor !== "function") return undefined;
  return (callback, options) => new Constructor(callback, options);
}

function cleanupObserver(
  observer: AttentionIntersectionObserver | undefined,
  target?: Element,
): void {
  if (!observer) return;
  if (target) {
    try {
      observer.unobserve(target);
    } catch {
      // Intersection cleanup errors are deliberately suppressed.
    }
  }
  try {
    observer.disconnect();
  } catch {
    // Intersection cleanup errors are deliberately suppressed.
  }
}

function readFocusArea(
  document: Document,
  composers: ReadonlyMap<Element, number>,
  conversations: ReadonlyMap<Element, number>,
): AttentionSnapshot["focusArea"] {
  let activeElement: Element | null;
  try {
    activeElement = deepActiveElement(document);
  } catch {
    return "unknown";
  }
  if (
    activeElement === null ||
    activeElement === document.body ||
    activeElement === document.documentElement
  ) {
    return "none";
  }
  if (
    [...composers.keys()].some((element) =>
      composedContains(element, activeElement),
    )
  ) {
    return "composer";
  }
  if (
    [...conversations.keys()].some((element) =>
      composedContains(element, activeElement),
    )
  ) {
    return "conversation";
  }
  return "elsewhere";
}

function readVisibility(document: Document): AttentionSnapshot["visibility"] {
  try {
    if (document.visibilityState === "visible") return "visible";
    if (document.visibilityState === "hidden") return "hidden";
  } catch {
    // Browser integrations can expose throwing accessors.
  }
  return "unknown";
}

function readWindowFocus(document: Document): AttentionSnapshot["windowFocus"] {
  try {
    if (typeof document.hasFocus !== "function") return "unknown";
    return document.hasFocus() ? "focused" : "blurred";
  } catch {
    return "unknown";
  }
}

function sameSnapshot(
  left: AttentionSnapshot,
  right: AttentionSnapshot,
): boolean {
  return (
    left.visibility === right.visibility &&
    left.windowFocus === right.windowFocus &&
    left.focusArea === right.focusArea &&
    left.newestResponse === right.newestResponse &&
    left.mode === right.mode
  );
}
