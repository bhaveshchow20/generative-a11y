import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  createGenerativeA11y,
  ManualClock,
  type AnnouncementIntent,
} from "@generative-a11y/core";
import { connectRuntimeToDOM, createDOMAnnouncer } from "./index.js";

function intent(
  text = "Update available",
  channel: AnnouncementIntent["channel"] = "polite",
  locale?: string,
): AnnouncementIntent {
  return {
    id: "announcement-1",
    at: 1,
    channel,
    text,
    sourceType: "response.text.delta",
    ...(locale === undefined ? {} : { locale }),
  };
}

describe("createDOMAnnouncer", () => {
  it("is inert without a document", () => {
    const onDiagnostic = vi.fn();
    const announcer = createDOMAnnouncer({ onDiagnostic });

    expect(announcer.getRegions()).toBeUndefined();
    const result = announcer.announce(intent());
    expect(result).toEqual({
      status: "unavailable",
      method: "none",
      channel: "polite",
    });
    expect(onDiagnostic).toHaveBeenCalledWith(result);
  });

  it("mounts two isolated live regions synchronously", () => {
    const firstDOM = new JSDOM("<!doctype html><html><body></body></html>");
    const secondDOM = new JSDOM("<!doctype html><html><body></body></html>");

    const first = createDOMAnnouncer({ document: firstDOM.window.document });
    const second = createDOMAnnouncer({ document: secondDOM.window.document });

    const firstRegions = first.getRegions();
    const secondRegions = second.getRegions();
    expect(firstRegions).toBeDefined();
    expect(secondRegions).toBeDefined();
    expect(firstDOM.window.document.body.children).toHaveLength(2);
    expect(secondDOM.window.document.body.children).toHaveLength(2);
    expect(firstRegions?.polite).not.toBe(secondRegions?.polite);
    expect(firstRegions?.polite.isConnected).toBe(true);
    expect(firstRegions?.assertive.isConnected).toBe(true);

    for (const [channel, region] of Object.entries(firstRegions ?? {})) {
      expect(region.getAttribute("aria-live")).toBe(channel);
      expect(region.getAttribute("aria-atomic")).toBe("true");
      expect(region.getAttribute("aria-relevant")).toBe("additions text");
      expect(region.hasAttribute("role")).toBe(false);
      expect(region.hasAttribute("aria-busy")).toBe(false);
      expect(region.hasAttribute("hidden")).toBe(false);
      expect(region.hasAttribute("aria-hidden")).toBe(false);
      expect(region.style.position).toBe("absolute");
      expect(region.style.display).not.toBe("none");
      expect(region.style.visibility).not.toBe("hidden");
    }
  });

  it.each(["polite", "assertive"] as const)(
    "mutates only the %s channel in forced live-region mode",
    (channel) => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      const announcer = createDOMAnnouncer({
        document: dom.window.document,
        mode: "live-region",
      });
      const regions = announcer.getRegions();
      const notify = vi.fn();
      Object.defineProperty(regions?.[channel], "ariaNotify", {
        value: notify,
      });

      expect(announcer.announce(intent("Ready", channel))).toEqual({
        status: "mutated",
        method: "live-region",
        channel,
      });
      expect(regions?.[channel].textContent).toBe("Ready");
      expect(
        regions?.[channel === "polite" ? "assertive" : "polite"].textContent,
      ).toBe("");
      expect(notify).not.toHaveBeenCalled();
    },
  );

  it("replaces an identical announcement with a distinct text node", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const announcer = createDOMAnnouncer({
      document: dom.window.document,
      mode: "live-region",
    });
    const region = announcer.getRegions()?.polite;

    announcer.announce(intent("Same"));
    const firstTextNode = region?.firstChild;
    announcer.announce(intent("Same"));

    expect(region?.firstChild).not.toBe(firstTextNode);
    expect(region?.firstChild).toBeInstanceOf(dom.window.Text);
  });

  it("applies locale before content and clears a stale locale", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const announcer = createDOMAnnouncer({
      document: dom.window.document,
      mode: "live-region",
    });
    const region = announcer.getRegions()?.polite;
    const observedLanguages: Array<string | null> = [];
    const observer = new dom.window.MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "childList") {
          observedLanguages.push(region?.getAttribute("lang") ?? null);
        }
      }
    });
    if (region) observer.observe(region, { childList: true });

    announcer.announce(intent("Bonjour", "polite", "fr-FR"));
    observer.takeRecords().forEach((record) => {
      if (record.type === "childList") {
        observedLanguages.push(region?.getAttribute("lang") ?? null);
      }
    });
    expect(region?.getAttribute("lang")).toBe("fr-FR");
    expect(observedLanguages).toEqual(["fr-FR"]);

    announcer.announce(intent("Hello"));
    expect(region?.hasAttribute("lang")).toBe(false);
  });

  it.each([
    { initialLocale: undefined, locale: "fr-FR", expectedLocale: "fr-FR" },
    { initialLocale: "en-US", locale: undefined, expectedLocale: null },
  ])(
    "applies locale $expectedLocale before ariaNotify",
    ({ initialLocale, locale, expectedLocale }) => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      const announcer = createDOMAnnouncer({
        document: dom.window.document,
        mode: "auto",
      });
      const region = announcer.getRegions()?.polite;
      if (!region) throw new Error("polite region missing");
      if (initialLocale !== undefined) {
        region.setAttribute("lang", initialLocale);
      }
      let localeAtNotify: string | null | undefined;
      Object.defineProperty(region, "ariaNotify", {
        value: () => {
          localeAtNotify = region.getAttribute("lang");
        },
      });

      announcer.announce(intent("Bonjour", "polite", locale));

      expect(localeAtNotify).toBe(expectedLocale);
    },
  );

  it.each([
    ["auto", "polite", "normal"],
    ["aria-notify", "assertive", "high"],
  ] as const)(
    "%s uses ariaNotify on %s with %s priority and leaves fallback content unchanged",
    (mode, channel, priority) => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      const announcer = createDOMAnnouncer({
        document: dom.window.document,
        mode,
      });
      const region = announcer.getRegions()?.[channel];
      const notify = vi.fn();
      Object.defineProperty(region, "ariaNotify", { value: notify });

      expect(announcer.announce(intent("Finished", channel))).toEqual({
        status: "notified",
        method: "aria-notify",
        channel,
      });
      expect(notify).toHaveBeenCalledOnce();
      expect(notify).toHaveBeenCalledWith("Finished", { priority });
      expect(region?.textContent).toBe("");
    },
  );

  it("isolates a throwing diagnostic callback from notifier delivery", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const onDiagnostic = vi.fn(() => {
      throw new Error("diagnostic failed");
    });
    const announcer = createDOMAnnouncer({
      document: dom.window.document,
      onDiagnostic,
    });
    const region = announcer.getRegions()?.polite;
    const notify = vi.fn();
    Object.defineProperty(region, "ariaNotify", { value: notify });

    expect(announcer.announce(intent("First"))).toEqual({
      status: "notified",
      method: "aria-notify",
      channel: "polite",
    });
    expect(announcer.announce(intent("Second"))).toEqual({
      status: "notified",
      method: "aria-notify",
      channel: "polite",
    });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(onDiagnostic).toHaveBeenCalledTimes(2);
    expect(region?.textContent).toBe("");
  });

  it.each([
    [
      "hostile value",
      () => ({
        [Symbol.toPrimitive]() {
          throw new Error("cannot stringify");
        },
      }),
    ],
    [
      "hostile Error subclass",
      () => {
        const cause = new Error();
        Object.defineProperties(cause, {
          name: {
            get() {
              throw new Error("cannot read name");
            },
          },
          message: {
            get() {
              throw new Error("cannot read message");
            },
          },
        });
        return cause;
      },
    ],
  ] as const)(
    "disables a throwing ariaNotify accessor with a serializable %s diagnostic",
    (_label, createCause) => {
      const dom = new JSDOM("<!doctype html><html><body></body></html>");
      const announcer = createDOMAnnouncer({ document: dom.window.document });
      const region = announcer.getRegions()?.polite;
      const accessor = vi.fn(() => {
        throw createCause();
      });
      Object.defineProperty(region, "ariaNotify", { get: accessor });

      const first = announcer.announce(intent("First"));

      expect(first.status).toBe("mutated");
      expect(first.method).toBe("live-region");
      expect(typeof first.error?.name).toBe("string");
      expect(typeof first.error?.message).toBe("string");
      expect(() => JSON.stringify(first)).not.toThrow();
      expect(region?.textContent).toBe("First");

      expect(announcer.announce(intent("Second"))).toEqual({
        status: "mutated",
        method: "live-region",
        channel: "polite",
      });
      expect(region?.textContent).toBe("Second");
      expect(accessor).toHaveBeenCalledOnce();
    },
  );

  it("disables a throwing notifier and falls back for this and later intents", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const diagnostics: unknown[] = [];
    const announcer = createDOMAnnouncer({
      document: dom.window.document,
      onDiagnostic: (result) => diagnostics.push(result),
    });
    const region = announcer.getRegions()?.polite;
    const notify = vi.fn(() => {
      throw new TypeError("not allowed");
    });
    Object.defineProperty(region, "ariaNotify", { value: notify });

    expect(announcer.announce(intent("First"))).toEqual({
      status: "mutated",
      method: "live-region",
      channel: "polite",
      error: { name: "TypeError", message: "not allowed" },
    });
    expect(region?.textContent).toBe("First");

    expect(announcer.announce(intent("Second"))).toEqual({
      status: "mutated",
      method: "live-region",
      channel: "polite",
    });
    expect(region?.textContent).toBe("Second");
    expect(notify).toHaveBeenCalledOnce();
    expect(diagnostics).toHaveLength(2);
  });

  it("removes owned regions once and prevents post-disposal delivery", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const announcer = createDOMAnnouncer({ document: dom.window.document });
    const regions = announcer.getRegions();
    const notify = vi.fn();
    Object.defineProperty(regions?.polite, "ariaNotify", { value: notify });

    announcer.dispose();
    announcer.dispose();

    expect(regions?.polite.isConnected).toBe(false);
    expect(regions?.assertive.isConnected).toBe(false);
    expect(announcer.announce(intent())).toEqual({
      status: "disposed",
      method: "none",
      channel: "polite",
    });
    expect(regions?.polite.textContent).toBe("");
    expect(notify).not.toHaveBeenCalled();
  });

  it("configures but does not remove supplied regions", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><div id='p'></div><div id='a'></div></body></html>",
    );
    const polite = dom.window.document.querySelector<HTMLElement>("#p");
    const assertive = dom.window.document.querySelector<HTMLElement>("#a");
    if (!polite || !assertive) throw new Error("fixture regions missing");

    const announcer = createDOMAnnouncer({ regions: { polite, assertive } });

    expect(announcer.getRegions()).toEqual({ polite, assertive });
    expect(polite.getAttribute("aria-live")).toBe("polite");
    expect(assertive.getAttribute("aria-live")).toBe("assertive");
    expect(polite.getAttribute("aria-atomic")).toBe("true");
    expect(assertive.getAttribute("aria-relevant")).toBe("additions text");
    expect(polite.style.position).toBe("absolute");

    announcer.dispose();
    expect(polite.isConnected).toBe(true);
    expect(assertive.isConnected).toBe(true);
  });

  it("removes prohibited semantics and hiding from supplied regions", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <div id="p" role="status" aria-busy="true" aria-hidden="true" hidden inert
        style="display: none; visibility: hidden; content-visibility: hidden"></div>
      <div id="a" role="alert" aria-busy="true" aria-hidden="true" hidden inert
        style="display: none; visibility: hidden; content-visibility: hidden"></div>
    </body></html>`);
    const polite = dom.window.document.querySelector<HTMLElement>("#p");
    const assertive = dom.window.document.querySelector<HTMLElement>("#a");
    if (!polite || !assertive) throw new Error("fixture regions missing");

    createDOMAnnouncer({ regions: { polite, assertive } });

    for (const region of [polite, assertive]) {
      expect(region.hasAttribute("role")).toBe(false);
      expect(region.hasAttribute("aria-busy")).toBe(false);
      expect(region.hasAttribute("hidden")).toBe(false);
      expect(region.hasAttribute("aria-hidden")).toBe(false);
      expect(region.hasAttribute("inert")).toBe(false);
      expect(region.inert).toBe(false);
      expect(region.style.display).toBe("");
      expect(region.style.visibility).toBe("");
      expect(region.style.contentVisibility).toBe("");
    }
  });

  it.each([
    ["the same element", "same", "must be distinct elements"],
    [
      "the polite region contains the assertive region",
      "polite-contains",
      "must not contain one another",
    ],
    [
      "the assertive region contains the polite region",
      "assertive-contains",
      "must not contain one another",
    ],
    [
      "the owner documents differ",
      "different-documents",
      "must belong to the same document",
    ],
    [
      "the supplied document differs",
      "different-option-document",
      "must belong to the provided document",
    ],
  ] as const)(
    "rejects supplied regions when %s before mutation",
    (_label, relationship, expectedMessage) => {
      const firstDOM = new JSDOM("<!doctype html><html><body></body></html>");
      const secondDOM = new JSDOM("<!doctype html><html><body></body></html>");
      const polite = firstDOM.window.document.createElement("div");
      let assertive = firstDOM.window.document.createElement("div");
      let suppliedDocument: Document | undefined;

      if (relationship === "same") {
        assertive = polite;
        firstDOM.window.document.body.append(polite);
      } else if (relationship === "polite-contains") {
        polite.append(assertive);
        firstDOM.window.document.body.append(polite);
      } else if (relationship === "assertive-contains") {
        assertive.append(polite);
        firstDOM.window.document.body.append(assertive);
      } else if (relationship === "different-documents") {
        assertive = secondDOM.window.document.createElement("div");
        firstDOM.window.document.body.append(polite);
        secondDOM.window.document.body.append(assertive);
      } else {
        firstDOM.window.document.body.append(polite, assertive);
        suppliedDocument = secondDOM.window.document;
      }
      polite.setAttribute("data-original", "polite");
      assertive.setAttribute("data-original", "assertive");
      const originals = [...new Set([polite, assertive])].map((region) => ({
        region,
        markup: region.outerHTML,
        parent: region.parentNode,
      }));

      expect(() =>
        createDOMAnnouncer({
          ...(suppliedDocument === undefined
            ? {}
            : { document: suppliedDocument }),
          regions: { polite, assertive },
        }),
      ).toThrow(expectedMessage);
      for (const original of originals) {
        expect(original.region.outerHTML).toBe(original.markup);
        expect(original.region.parentNode).toBe(original.parent);
      }
    },
  );

  it("treats markup-shaped announcement text as literal text", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const announcer = createDOMAnnouncer({
      document: dom.window.document,
      mode: "live-region",
    });
    const region = announcer.getRegions()?.polite;

    announcer.announce(intent("<img src=x onerror=alert(1)>"));

    expect(region?.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(region?.childNodes).toHaveLength(1);
    expect(region?.firstChild).toBeInstanceOf(dom.window.Text);
    expect(region?.querySelector("img")).toBeNull();
  });

  it("falls back when ariaNotify is absent in progressive-enhancement modes", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");

    for (const mode of ["auto", "aria-notify"] as const) {
      const announcer = createDOMAnnouncer({
        document: dom.window.document,
        mode,
      });
      expect(announcer.announce(intent(mode))).toEqual({
        status: "mutated",
        method: "live-region",
        channel: "polite",
      });
      expect(announcer.getRegions()?.polite.textContent).toBe(mode);
    }
  });

  it("mounts under documentElement when body is unavailable", () => {
    const dom = new JSDOM(
      "<!doctype html><html><head></head><body></body></html>",
    );
    dom.window.document.body.remove();

    const announcer = createDOMAnnouncer({ document: dom.window.document });

    expect(announcer.getRegions()?.polite.parentElement).toBe(
      dom.window.document.documentElement,
    );
    expect(announcer.getRegions()?.assertive.parentElement).toBe(
      dom.window.document.documentElement,
    );
  });

  it("keeps multiple drivers in one document isolated", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const first = createDOMAnnouncer({
      document: dom.window.document,
      mode: "live-region",
    });
    const second = createDOMAnnouncer({
      document: dom.window.document,
      mode: "live-region",
    });

    first.announce(intent("First"));
    second.announce(intent("Second"));

    expect(dom.window.document.body.children).toHaveLength(4);
    expect(first.getRegions()?.polite.textContent).toBe("First");
    expect(second.getRegions()?.polite.textContent).toBe("Second");
    expect(first.getRegions()?.polite).not.toBe(second.getRegions()?.polite);
  });
});

describe("connectRuntimeToDOM", () => {
  it("removes owned regions when subscribing to a disposed runtime fails", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const runtime = createGenerativeA11y({
      onAnnouncement: () => undefined,
    });
    runtime.dispose();

    expect(() =>
      connectRuntimeToDOM(runtime, { document: dom.window.document }),
    ).toThrow("Cannot subscribe to a disposed generative-a11y runtime");
    expect(dom.window.document.body.children).toHaveLength(0);
  });

  it("removes owned regions when unsubscribe throws and remains idempotent", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const baseRuntime = createGenerativeA11y({
      onAnnouncement: () => undefined,
    });
    const unsubscribeFailure = vi.fn(() => {
      throw new Error("unsubscribe failed");
    });
    const runtime = {
      ...baseRuntime,
      subscribeAnnouncements(
        listener: Parameters<typeof baseRuntime.subscribeAnnouncements>[0],
      ) {
        const unsubscribe = baseRuntime.subscribeAnnouncements(listener);
        return () => {
          unsubscribe();
          unsubscribeFailure();
        };
      },
    };
    const binding = connectRuntimeToDOM(runtime, {
      document: dom.window.document,
    });

    expect(dom.window.document.body.children).toHaveLength(2);
    expect(() => binding.dispose()).toThrow("unsubscribe failed");
    expect(dom.window.document.body.children).toHaveLength(0);
    expect(unsubscribeFailure).toHaveBeenCalledOnce();

    expect(() => binding.dispose()).not.toThrow();
    expect(unsubscribeFailure).toHaveBeenCalledOnce();
  });

  it("forwards once, unsubscribes deterministically, and never disposes the runtime", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const clock = new ManualClock();
    const originalListener = vi.fn();
    const onDiagnostic = vi.fn();
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: originalListener,
    });
    const runtimeDispose = vi.spyOn(runtime, "dispose");
    const binding = connectRuntimeToDOM(runtime, {
      document: dom.window.document,
      mode: "live-region",
      onDiagnostic,
    });
    const polite = binding.announcer.getRegions()?.polite;

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(polite?.textContent).toBe("Response stopped.");
    expect(onDiagnostic).toHaveBeenCalledOnce();
    expect(originalListener).toHaveBeenCalledOnce();
    const deliveredNode = polite?.firstChild;

    binding.dispose();
    binding.dispose();
    runtime.dispatch({ type: "response.started", responseId: "r2" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r2" });
    clock.runUntilIdle();

    expect(polite?.firstChild).toBe(deliveredNode);
    expect(onDiagnostic).toHaveBeenCalledOnce();
    expect(originalListener).toHaveBeenCalledTimes(2);
    expect(runtimeDispose).not.toHaveBeenCalled();
  });

  it("keeps bindings for separate runtimes isolated", () => {
    const firstDOM = new JSDOM("<!doctype html><html><body></body></html>");
    const secondDOM = new JSDOM("<!doctype html><html><body></body></html>");
    const firstClock = new ManualClock();
    const secondClock = new ManualClock();
    const firstRuntime = createGenerativeA11y({
      clock: firstClock,
      onAnnouncement: () => undefined,
    });
    const secondRuntime = createGenerativeA11y({
      clock: secondClock,
      onAnnouncement: () => undefined,
    });
    const first = connectRuntimeToDOM(firstRuntime, {
      document: firstDOM.window.document,
      mode: "live-region",
    });
    const second = connectRuntimeToDOM(secondRuntime, {
      document: secondDOM.window.document,
      mode: "live-region",
    });

    firstRuntime.dispatch({ type: "connection.lost" });
    firstClock.runUntilIdle();

    expect(first.announcer.getRegions()?.polite.textContent).toBe(
      "Connection lost. Reconnecting.",
    );
    expect(second.announcer.getRegions()?.polite.textContent).toBe("");

    secondRuntime.dispatch({ type: "connection.restored" });
    secondClock.runUntilIdle();
    expect(second.announcer.getRegions()?.polite.textContent).toBe(
      "Connection restored.",
    );
  });

  it("rejects a listener snapshot that becomes stale during delivery", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const clock = new ManualClock();
    let binding: ReturnType<typeof connectRuntimeToDOM> | undefined;
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: () => binding?.dispose(),
    });
    binding = connectRuntimeToDOM(runtime, {
      document: dom.window.document,
      mode: "live-region",
    });
    const polite = binding.announcer.getRegions()?.polite;

    runtime.dispatch({ type: "response.started", responseId: "r1" });
    runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
    clock.runUntilIdle();

    expect(polite?.textContent).toBe("");
    expect(polite?.isConnected).toBe(false);
  });
});
