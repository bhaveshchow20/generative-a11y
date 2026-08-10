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
    for (const listener of listeners) {
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
  selectedDocument.addEventListener("visibilitychange", update);
  selectedWindow?.addEventListener("focus", update);
  selectedWindow?.addEventListener("blur", update);
  selectedDocument.addEventListener("focusin", update);
  selectedDocument.addEventListener("focusout", handleFocusOut);

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

  const ensureObserver = (): AttentionIntersectionObserver | undefined => {
    if (observer) return observer;
    const factory =
      options.createIntersectionObserver ??
      defaultIntersectionObserverFactory(selectedWindow);
    if (!factory) return undefined;
    try {
      observer = factory((entries) => {
        if (disposed || newestTarget === undefined) return;
        const entry = entries.find(({ target }) => target === newestTarget);
        if (!entry) return;
        newestResult = entry.isIntersecting ? "visible" : "outside";
        update();
      }, options.intersectionObserverInit);
    } catch {
      observer = undefined;
    }
    return observer;
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
      if (newestTarget) observer?.unobserve(newestTarget);
      newestTarget = element;
      newestResult = "unknown";
      ensureObserver()?.observe(element);
      update();
      let registered = true;
      return () => {
        if (!registered) return;
        registered = false;
        if (registration !== newestRegistration || newestTarget !== element)
          return;
        observer?.unobserve(element);
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
      observer?.disconnect();
      newestTarget = undefined;
      selectedDocument.removeEventListener("visibilitychange", update);
      selectedWindow?.removeEventListener("focus", update);
      selectedWindow?.removeEventListener("blur", update);
      selectedDocument.removeEventListener("focusin", update);
      selectedDocument.removeEventListener("focusout", handleFocusOut);
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

function readFocusArea(
  document: Document,
  composers: ReadonlyMap<Element, number>,
  conversations: ReadonlyMap<Element, number>,
): AttentionSnapshot["focusArea"] {
  let activeElement: Element | null;
  try {
    activeElement = document.activeElement;
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
    [...composers.keys()].some((element) => element.contains(activeElement))
  ) {
    return "composer";
  }
  if (
    [...conversations.keys()].some((element) => element.contains(activeElement))
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
