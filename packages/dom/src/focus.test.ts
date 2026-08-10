import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import { captureFocus, focusElement, restoreFocus } from "./focus.js";
import * as publicAPI from "./index.js";

describe("focus helpers", () => {
  it("exports helpers, captures the exact target, and focuses with preventScroll by default", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='first'>First</button><button id='second'>Second</button></body></html>",
    );
    const document = dom.window.document;
    const first = document.querySelector<HTMLButtonElement>("#first")!;
    const second = document.querySelector<HTMLButtonElement>("#second")!;
    first.focus();
    const capture = captureFocus(document);
    const nativeFocus = second.focus.bind(second);
    const focus = vi.spyOn(second, "focus").mockImplementation((options) => {
      nativeFocus(options);
    });

    expect(publicAPI.captureFocus).toBe(captureFocus);
    expect(publicAPI.focusElement).toBe(focusElement);
    expect(publicAPI.restoreFocus).toBe(restoreFocus);
    expect(capture).toEqual({ document, target: first });
    expect(Object.isFrozen(capture)).toBe(true);
    expect(focusElement(second)).toEqual({ status: "focused", target: second });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(document.activeElement).toBe(second);
  });

  it("captures unavailable and body focus conservatively", () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const document = dom.window.document;

    expect(captureFocus()).toEqual({ document: null, target: null });
    expect(captureFocus(document)).toEqual({ document, target: null });
    expect(restoreFocus(captureFocus(document))).toEqual({
      status: "skipped",
      reason: "unavailable",
      target: null,
    });
  });

  it("restores the same capture repeatedly and forwards preventScroll false", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='target'>Target</button><button id='other'>Other</button></body></html>",
    );
    const document = dom.window.document;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    const other = document.querySelector<HTMLButtonElement>("#other")!;
    target.focus();
    const capture = captureFocus(document);
    const nativeFocus = target.focus.bind(target);
    const focus = vi.spyOn(target, "focus").mockImplementation((options) => {
      nativeFocus(options);
    });

    other.focus();
    expect(restoreFocus(capture, { preventScroll: false }).status).toBe(
      "focused",
    );
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: false });
    other.focus();
    expect(restoreFocus(capture).status).toBe("focused");
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  });

  it.each([
    ["hidden", "hidden"],
    ["aria-hidden='TRUE'", "aria-hidden"],
    ["inert", "inert"],
  ] as const)(
    "rejects a target below a %s ancestor without moving focus",
    (attribute, reason) => {
      const dom = new JSDOM(`<!doctype html><html><body>
        <button id="current">Current</button>
        <section ${attribute}><button id="target">Target</button></section>
      </body></html>`);
      const document = dom.window.document;
      const current = document.querySelector<HTMLButtonElement>("#current")!;
      const target = document.querySelector<HTMLButtonElement>("#target")!;
      current.focus();
      const focus = vi.spyOn(target, "focus");

      expect(focusElement(target)).toEqual({
        status: "skipped",
        reason,
        target,
      });
      expect(focus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(current);
    },
  );

  it("rejects disconnected and disabled targets without moving focus", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='disabled' disabled>Disabled</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const disabled = document.querySelector<HTMLButtonElement>("#disabled")!;
    const disconnected = document.createElement("button");
    current.focus();

    expect(focusElement(disconnected)).toMatchObject({
      status: "skipped",
      reason: "disconnected",
    });
    expect(focusElement(disabled)).toMatchObject({
      status: "skipped",
      reason: "disabled",
    });
    expect(document.activeElement).toBe(current);
  });

  it.each([
    ["missing-focus", undefined],
    [
      "focus-error",
      (): void => {
        throw new Error("focus failed");
      },
    ],
    ["focus-not-applied", (): void => undefined],
  ] as const)("reports %s without leaking an error", (reason, focusValue) => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    current.focus();
    Object.defineProperty(target, "focus", { value: focusValue });

    expect(focusElement(target)).toMatchObject({ status: "skipped", reason });
    expect(document.activeElement).toBe(current);
  });

  it("restores only while focus remains within the requested guard", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="target">Target</button>
      <section id="guard"><button id="inside">Inside</button></section>
      <button id="outside">Outside</button>
    </body></html>`);
    const document = dom.window.document;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    const guard = document.querySelector("#guard")!;
    const inside = document.querySelector<HTMLButtonElement>("#inside")!;
    const outside = document.querySelector<HTMLButtonElement>("#outside")!;
    target.focus();
    const capture = captureFocus(document);

    inside.focus();
    expect(restoreFocus(capture, { onlyIfFocusWithin: guard }).status).toBe(
      "focused",
    );

    outside.focus();
    expect(restoreFocus(capture, { onlyIfFocusWithin: guard })).toEqual({
      status: "skipped",
      reason: "guard-mismatch",
      target,
    });
    expect(document.activeElement).toBe(outside);
  });

  it("skips restoration for null focus or a throwing guard boundary", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button>Target</button><section></section></body></html>",
    );
    const document = dom.window.document;
    const target = document.querySelector("button")!;
    const guard = document.querySelector("section")!;
    const capture = Object.freeze({ document, target });
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => null,
    });

    expect(restoreFocus(capture, { onlyIfFocusWithin: guard })).toMatchObject({
      status: "skipped",
      reason: "guard-mismatch",
    });
    Object.defineProperty(guard, "contains", {
      value: () => {
        throw new Error("contains failed");
      },
    });
    expect(() =>
      restoreFocus(capture, { onlyIfFocusWithin: guard }),
    ).not.toThrow();
  });

  it("rejects a capture whose target belongs to another document", () => {
    const firstDOM = new JSDOM(
      "<!doctype html><html><body><button>First</button></body></html>",
    );
    const secondDOM = new JSDOM(
      "<!doctype html><html><body><button>Second</button></body></html>",
    );
    const firstDocument = firstDOM.window.document;
    const secondTarget = secondDOM.window.document.querySelector("button")!;

    expect(
      restoreFocus({ document: firstDocument, target: secondTarget }),
    ).toEqual({
      status: "skipped",
      reason: "cross-document",
      target: secondTarget,
    });
  });

  it("contains hostile activeElement and element accessors", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button>Target</button></body></html>",
    );
    const document = dom.window.document;
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => {
        throw new Error("activeElement failed");
      },
    });
    expect(() => captureFocus(document)).not.toThrow();
    expect(captureFocus(document)).toEqual({ document, target: null });

    const hostile = Object.defineProperty({}, "ownerDocument", {
      get: () => {
        throw new Error("ownerDocument failed");
      },
    }) as unknown as Element;
    expect(() => focusElement(hostile)).not.toThrow();
    expect(focusElement(hostile)).toMatchObject({
      status: "skipped",
      reason: "unavailable",
    });
  });

  it("contains a verification accessor that throws after focus is attempted", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    current.focus();
    let activeReads = 0;
    Object.defineProperty(document, "activeElement", {
      configurable: true,
      get: () => {
        activeReads += 1;
        if (activeReads === 1) return current;
        throw new Error("verification failed");
      },
    });
    Object.defineProperty(target, "focus", { value: () => undefined });

    let result: ReturnType<typeof focusElement> | undefined;
    expect(() => {
      result = focusElement(target);
    }).not.toThrow();
    expect(result).toMatchObject({
      status: "skipped",
      reason: "focus-error",
    });
  });

  it("best-effort restores prior focus when a hostile focus call moves then throws", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button><button id='other'>Other</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    const other = document.querySelector<HTMLButtonElement>("#other")!;
    current.focus();
    Object.defineProperty(target, "focus", {
      value: () => {
        other.focus();
        throw new Error("focus failed after moving");
      },
    });

    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "focus-error",
    });
    expect(document.activeElement).toBe(current);
  });
});
