import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { createAttentionStore } from "./attention.js";
import type { AttentionIntersectionObserverFactory } from "./attention.js";
import * as publicAPI from "./index.js";

function intersectionEntry(
  target: Element,
  isIntersecting: boolean,
): IntersectionObserverEntry {
  return { target, isIntersecting } as unknown as IntersectionObserverEntry;
}

describe("createAttentionStore", () => {
  it("is exported from the package entrypoint", () => {
    expect(publicAPI.createAttentionStore).toBe(createAttentionStore);
  });

  it("returns one frozen unknown snapshot without a document", () => {
    const store = createAttentionStore();

    const first = store.getSnapshot();
    expect(first).toEqual({
      visibility: "unknown",
      windowFocus: "unknown",
      focusArea: "unknown",
      newestResponse: "unknown",
      mode: "unknown",
    });
    expect(store.getSnapshot()).toBe(first);
    expect(store.getServerSnapshot()).toBe(first);
    expect(Object.isFrozen(first)).toBe(true);
  });

  it("uses the browser document when no document is injected", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    Object.defineProperty(dom.window.document, "visibilityState", {
      value: "visible",
    });
    Object.defineProperty(dom.window.document, "hasFocus", {
      value: () => true,
    });
    vi.stubGlobal("document", dom.window.document);
    try {
      const store = createAttentionStore();
      expect(store.getSnapshot()).toMatchObject({
        visibility: "visible",
        windowFocus: "focused",
        newestResponse: "unobserved",
      });
      store.dispose();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("tracks normalized document visibility and window focus changes", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    let visibility: DocumentVisibilityState = "visible";
    let focused = true;
    Object.defineProperty(dom.window.document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(dom.window.document, "hasFocus", {
      configurable: true,
      value: () => focused,
    });
    const store = createAttentionStore({ document: dom.window.document });
    const listener = vi.fn();
    store.subscribe(listener);

    expect(store.getSnapshot()).toMatchObject({
      visibility: "visible",
      windowFocus: "focused",
    });

    focused = false;
    dom.window.dispatchEvent(new dom.window.Event("blur"));
    expect(store.getSnapshot().mode).toBe("away");

    visibility = "hidden";
    dom.window.document.dispatchEvent(new dom.window.Event("visibilitychange"));

    expect(store.getSnapshot()).toMatchObject({
      visibility: "hidden",
      windowFocus: "blurred",
      mode: "background",
    });
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("rolls back installed listeners when construction fails partway", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const document = dom.window.document;
    const originalDocumentAdd = document.addEventListener.bind(document);
    const originalDocumentRemove = document.removeEventListener.bind(document);
    const originalWindowAdd = dom.window.addEventListener.bind(dom.window);
    const originalWindowRemove = dom.window.removeEventListener.bind(
      dom.window,
    );
    const documentRemovals: string[] = [];
    const windowRemovals: string[] = [];

    vi.spyOn(document, "addEventListener").mockImplementation(
      (type, listener, options) => {
        if (type === "focusin") throw new Error("focus listener rejected");
        originalDocumentAdd(type, listener, options);
      },
    );
    vi.spyOn(document, "removeEventListener").mockImplementation(
      (type, listener, options) => {
        documentRemovals.push(type);
        if (type === "focusin") throw new Error("focus removal rejected");
        originalDocumentRemove(type, listener, options);
      },
    );
    vi.spyOn(dom.window, "addEventListener").mockImplementation(
      (type, listener, options) => originalWindowAdd(type, listener, options),
    );
    vi.spyOn(dom.window, "removeEventListener").mockImplementation(
      (type, listener, options) => {
        windowRemovals.push(type);
        originalWindowRemove(type, listener, options);
      },
    );

    expect(() => createAttentionStore({ document })).toThrow(
      "focus listener rejected",
    );
    expect(documentRemovals).toEqual(["focusin", "visibilitychange"]);
    expect(windowRemovals).toEqual(["blur", "focus"]);
  });

  it("aggregates registered focus areas and gives nested composers precedence", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <section id="conversation"><textarea id="composer"></textarea></section>
      <button id="other">Other</button>
    </body></html>`);
    const document = dom.window.document;
    const conversation = document.querySelector("#conversation");
    const composer = document.querySelector("#composer");
    const other = document.querySelector<HTMLElement>("#other");
    if (!conversation || !composer || !other)
      throw new Error("fixture missing");
    const store = createAttentionStore({ document });
    const unregisterConversation = store.registerConversation(conversation);
    const unregisterComposer = store.registerComposer(composer);

    (composer as HTMLElement).focus();
    expect(store.getSnapshot().focusArea).toBe("composer");

    other.focus();
    expect(store.getSnapshot().focusArea).toBe("elsewhere");

    other.blur();
    expect(store.getSnapshot().focusArea).toBe("none");

    unregisterComposer();
    unregisterComposer();
    (composer as HTMLElement).focus();
    expect(store.getSnapshot().focusArea).toBe("conversation");
    unregisterConversation();
  });

  it("observes one current newest response and ignores stale callbacks", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <article id="first"></article><article id="second"></article>
    </body></html>`);
    const document = dom.window.document;
    Object.defineProperty(document, "visibilityState", { value: "visible" });
    Object.defineProperty(document, "hasFocus", { value: () => true });
    const first = document.querySelector("#first");
    const second = document.querySelector("#second");
    if (!first || !second) throw new Error("fixture missing");
    let callback: IntersectionObserverCallback | undefined;
    let observerInit: IntersectionObserverInit | undefined;
    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    const createIntersectionObserver: AttentionIntersectionObserverFactory = (
      nextCallback,
      init,
    ) => {
      callback = nextCallback;
      observerInit = init;
      return { observe, unobserve, disconnect };
    };
    const store = createAttentionStore({
      document,
      createIntersectionObserver,
      intersectionObserverInit: { threshold: 0.5 },
    });

    const unregisterFirst = store.registerNewestResponse(first);
    expect(observerInit).toEqual({ threshold: 0.5 });
    callback?.(
      [{ target: first, isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot()).toMatchObject({
      newestResponse: "outside",
      mode: "reading-history",
    });

    const unregisterSecond = store.registerNewestResponse(second);
    expect(unobserve.mock.calls.at(-1)?.[0] === first).toBe(true);
    callback?.(
      [{ target: first, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot().newestResponse).toBe("unknown");
    callback?.(
      [{ target: second, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot()).toMatchObject({
      newestResponse: "visible",
      mode: "foreground",
    });

    unregisterFirst();
    expect(store.getSnapshot().newestResponse).toBe("visible");
    unregisterSecond();
    unregisterSecond();
    expect(store.getSnapshot().newestResponse).toBe("unobserved");

    store.registerNewestResponse(second);
    callback?.(
      [{ target: second, isIntersecting: true } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    store.dispose();
    callback?.(
      [{ target: second, isIntersecting: false } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot().newestResponse).toBe("visible");
    expect(disconnect).toHaveBeenCalledTimes(3);
  });

  it("ignores an old observer epoch when the same newest element is re-registered", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><article></article></body></html>",
    );
    const document = dom.window.document;
    const target = document.querySelector("article")!;
    const callbacks: IntersectionObserverCallback[] = [];
    const createIntersectionObserver: AttentionIntersectionObserverFactory = (
      callback,
    ) => {
      callbacks.push(callback);
      return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
      };
    };
    const store = createAttentionStore({
      document,
      createIntersectionObserver,
    });

    store.registerNewestResponse(target);
    callbacks[0]?.(
      [intersectionEntry(target, false)],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot().newestResponse).toBe("outside");

    store.registerNewestResponse(target);
    expect(store.getSnapshot().newestResponse).toBe("unknown");
    callbacks[0]?.(
      [intersectionEntry(target, true)],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot().newestResponse).toBe("unknown");

    callbacks[1]?.(
      [intersectionEntry(target, false), intersectionEntry(target, true)],
      {} as IntersectionObserver,
    );
    expect(store.getSnapshot().newestResponse).toBe("visible");
  });

  it("isolates listeners, preserves unchanged snapshot identity, and disposes deterministically", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><main></main></body></html>",
    );
    const document = dom.window.document;
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    Object.defineProperty(document, "hasFocus", { value: () => true });
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const removeWindowListener = vi.spyOn(dom.window, "removeEventListener");
    const disconnect = vi.fn();
    const store = createAttentionStore({
      document,
      createIntersectionObserver: () => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect,
      }),
    });
    const throwing = vi.fn(() => {
      throw new Error("listener failed");
    });
    const healthy = vi.fn();
    const unsubscribeThrowing = store.subscribe(throwing);
    store.subscribe(healthy);
    store.registerNewestResponse(document.querySelector("main")!);
    const unchanged = store.getSnapshot();

    document.dispatchEvent(new dom.window.Event("visibilitychange"));
    expect(store.getSnapshot()).toBe(unchanged);
    expect(healthy).toHaveBeenCalledOnce();

    visibility = "hidden";
    document.dispatchEvent(new dom.window.Event("visibilitychange"));
    expect(throwing).toHaveBeenCalledTimes(2);
    expect(healthy).toHaveBeenCalledTimes(2);
    unsubscribeThrowing();
    unsubscribeThrowing();

    store.dispose();
    store.dispose();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      "blur",
      expect.any(Function),
    );
    expect(() => store.subscribe(() => undefined)).toThrow("disposed");
    expect(() => store.registerComposer(document.body)).toThrow("disposed");
  });

  it("finishes listener cleanup when observer disconnect throws", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><main></main></body></html>",
    );
    const document = dom.window.document;
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const removeWindowListener = vi.spyOn(dom.window, "removeEventListener");
    const disconnect = vi.fn(() => {
      throw new Error("observer cleanup failed");
    });
    const store = createAttentionStore({
      document,
      createIntersectionObserver: () => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect,
      }),
    });
    store.registerNewestResponse(document.querySelector("main")!);

    expect(() => store.dispose()).not.toThrow();
    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "visibilitychange",
      expect.any(Function),
    );
    expect(removeDocumentListener).toHaveBeenCalledWith(
      "focusout",
      expect.any(Function),
    );
    expect(removeWindowListener).toHaveBeenCalledWith(
      "blur",
      expect.any(Function),
    );
    expect(() => store.dispose()).not.toThrow();
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it("uses a stable subscriber snapshot during notification", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const document = dom.window.document;
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    const store = createAttentionStore({ document });
    const calls: string[] = [];
    const second = () => calls.push("second");
    const added = () => calls.push("added");
    let unsubscribeSecond: () => void = () => undefined;
    store.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
      store.subscribe(second);
      store.subscribe(added);
    });
    unsubscribeSecond = store.subscribe(second);

    visibility = "hidden";
    document.dispatchEvent(new dom.window.Event("visibilitychange"));

    expect(calls).toEqual(["first", "second"]);
  });

  it("keeps registration and cleanup consistent when observer methods throw", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><main></main></body></html>",
    );
    const document = dom.window.document;
    const target = document.querySelector("main")!;
    const failedDisconnect = vi.fn();
    const unobserve = vi.fn(() => {
      throw new Error("unobserve failed");
    });
    const throwingDisconnect = vi.fn(() => {
      throw new Error("disconnect failed");
    });
    const createIntersectionObserver = vi
      .fn<AttentionIntersectionObserverFactory>()
      .mockImplementationOnce(() => ({
        observe: () => {
          throw new Error("observe failed");
        },
        unobserve: vi.fn(),
        disconnect: failedDisconnect,
      }))
      .mockImplementationOnce(() => ({
        observe: vi.fn(),
        unobserve,
        disconnect: throwingDisconnect,
      }));
    const store = createAttentionStore({
      document,
      createIntersectionObserver,
    });

    let unregister: () => void = () => undefined;
    expect(() => {
      unregister = store.registerNewestResponse(target);
    }).not.toThrow();
    expect(store.getSnapshot().newestResponse).toBe("unknown");
    expect(failedDisconnect).toHaveBeenCalledOnce();
    unregister();
    expect(store.getSnapshot().newestResponse).toBe("unobserved");

    unregister = store.registerNewestResponse(target);
    expect(() => unregister()).not.toThrow();
    expect(unobserve).toHaveBeenCalledOnce();
    expect(throwingDisconnect).toHaveBeenCalledOnce();
    expect(store.getSnapshot().newestResponse).toBe("unobserved");
  });

  it("uses unknown evidence when visibility, focus, or intersection support is unavailable", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><main></main></body></html>",
    );
    const document = dom.window.document;
    Object.defineProperty(document, "visibilityState", { value: "prerender" });
    Object.defineProperty(document, "hasFocus", { value: undefined });
    const store = createAttentionStore({ document });
    store.registerNewestResponse(document.querySelector("main")!);

    expect(store.getSnapshot()).toEqual({
      visibility: "unknown",
      windowFocus: "unknown",
      focusArea: "none",
      newestResponse: "unknown",
      mode: "unknown",
    });
  });

  it("keeps multiple stores and registrations isolated", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <section id="one"><input></section><section id="two"><input></section>
    </body></html>`);
    const document = dom.window.document;
    const one = document.querySelector("#one")!;
    const two = document.querySelector("#two")!;
    const first = createAttentionStore({ document });
    const second = createAttentionStore({ document });
    first.registerComposer(one);
    first.registerComposer(two);
    second.registerConversation(two);

    two.querySelector<HTMLElement>("input")!.focus();
    expect(first.getSnapshot().focusArea).toBe("composer");
    expect(second.getSnapshot().focusArea).toBe("conversation");

    first.dispose();
    expect(second.getSnapshot().focusArea).toBe("conversation");
  });

  it("keeps duplicate element registrations active until the final unregister", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><textarea></textarea></body></html>",
    );
    const document = dom.window.document;
    const composer = document.querySelector("textarea")!;
    const store = createAttentionStore({ document });
    const unregisterFirst = store.registerComposer(composer);
    const unregisterSecond = store.registerComposer(composer);

    composer.focus();
    unregisterFirst();
    expect(store.getSnapshot().focusArea).toBe("composer");

    unregisterSecond();
    expect(store.getSnapshot().focusArea).toBe("elsewhere");
  });

  it("does not notify a transient empty focus area between registered targets", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <section id="conversation"><button>History</button></section>
      <textarea id="composer"></textarea>
    </body></html>`);
    const document = dom.window.document;
    const conversation = document.querySelector("#conversation")!;
    const composer = document.querySelector<HTMLTextAreaElement>("#composer")!;
    const history = conversation.querySelector<HTMLButtonElement>("button")!;
    const store = createAttentionStore({ document });
    store.registerConversation(conversation);
    store.registerComposer(composer);
    history.focus();
    const observed: string[] = [];
    store.subscribe(() => observed.push(store.getSnapshot().focusArea));

    composer.focus();

    expect(observed).toEqual(["composer"]);
  });
});
