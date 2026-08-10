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
    expect(document.activeElement).toBe(other);
  });

  it("captures and verifies the deepest active element in open shadow roots", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><div id='host'></div></body></html>",
    );
    const document = dom.window.document;
    const host = document.querySelector<HTMLElement>("#host")!;
    const shadow = host.attachShadow({ mode: "open" });
    const target = document.createElement("button");
    shadow.append(target);

    target.focus();

    expect(document.activeElement).toBe(host);
    expect(shadow.activeElement).toBe(target);
    expect(captureFocus(document)).toEqual({ document, target });
    expect(focusElement(target)).toEqual({ status: "focused", target });
  });

  it("treats open shadow hosts as composed guard and eligibility ancestors", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="restore">Restore</button><div id="host"></div>
    </body></html>`);
    const document = dom.window.document;
    const restore = document.querySelector<HTMLButtonElement>("#restore")!;
    const host = document.querySelector<HTMLElement>("#host")!;
    const shadow = host.attachShadow({ mode: "open" });
    const guard = document.createElement("section");
    const inside = document.createElement("button");
    guard.append(inside);
    shadow.append(guard);
    restore.focus();
    const capture = captureFocus(document);

    inside.focus();
    expect(restoreFocus(capture, { onlyIfFocusWithin: guard }).status).toBe(
      "focused",
    );
  });

  it.each([
    ["hidden", "hidden"],
    ["aria-hidden", "aria-hidden"],
    ["inert", "inert"],
  ] as const)("rejects a %s composed shadow host", (attribute, reason) => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><div id='host'></div></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const host = document.querySelector<HTMLElement>("#host")!;
    if (attribute === "aria-hidden") host.setAttribute(attribute, "true");
    else host.setAttribute(attribute, "");
    const target = document.createElement("button");
    host.attachShadow({ mode: "open" }).append(target);
    current.focus();

    expect(focusElement(target)).toMatchObject({ status: "skipped", reason });
    expect(document.activeElement).toBe(current);
  });

  it("uses native effective disabled state for disabled fieldsets", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <fieldset disabled>
        <legend><button id="legend">Legend action</button></legend>
        <button id="blocked">Blocked</button>
      </fieldset>
    </body></html>`);
    const document = dom.window.document;
    const legend = document.querySelector<HTMLButtonElement>("#legend")!;
    const blocked = document.querySelector<HTMLButtonElement>("#blocked")!;

    expect(focusElement(blocked)).toMatchObject({
      status: "skipped",
      reason: "disabled",
    });
    expect(focusElement(legend).status).toBe("focused");
  });

  it.each([
    [
      "disabled",
      (target: HTMLButtonElement): void => {
        target.disabled = true;
      },
    ],
    [
      "hidden",
      (_target: HTMLButtonElement, parent: HTMLElement): void => {
        parent.hidden = true;
      },
    ],
    [
      "aria-hidden",
      (_target: HTMLButtonElement, parent: HTMLElement): void => {
        parent.setAttribute("aria-hidden", "true");
      },
    ],
    [
      "inert",
      (_target: HTMLButtonElement, parent: HTMLElement): void => {
        parent.setAttribute("inert", "");
      },
    ],
  ] as const)(
    "rejects a target that becomes %s synchronously and restores eligible prior focus",
    (reason, mutate) => {
      const dom = new JSDOM(`<!doctype html><html><body>
        <button id="current">Current</button><section><button id="target">Target</button></section>
      </body></html>`);
      const document = dom.window.document;
      const current = document.querySelector<HTMLButtonElement>("#current")!;
      const target = document.querySelector<HTMLButtonElement>("#target")!;
      const parent = target.parentElement!;
      current.focus();
      const nativeFocus = target.focus.bind(target);
      vi.spyOn(target, "focus").mockImplementation((options) => {
        nativeFocus(options);
        mutate(target, parent);
      });

      expect(focusElement(target)).toMatchObject({ status: "skipped", reason });
      expect(document.activeElement).toBe(current);
    },
  );

  it("reports synchronous disconnection before focus verification", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    current.focus();
    const nativeFocus = target.focus.bind(target);
    vi.spyOn(target, "focus").mockImplementation((options) => {
      nativeFocus(options);
      target.remove();
    });

    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "disconnected",
    });
    expect(document.activeElement).not.toBe(target);
  });

  it("does not restore a prior target that became ineligible", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    current.focus();
    const nativeFocus = target.focus.bind(target);
    vi.spyOn(target, "focus").mockImplementation((options) => {
      nativeFocus(options);
      current.hidden = true;
      target.hidden = true;
    });

    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "hidden",
    });
    expect(document.activeElement).toBe(target);
  });

  it("preserves a non-throwing synchronous focus redirect", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='current'>Current</button><button id='target'>Target</button><button id='redirect'>Redirect</button></body></html>",
    );
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    const redirect = document.querySelector<HTMLButtonElement>("#redirect")!;
    current.focus();
    Object.defineProperty(target, "focus", { value: () => redirect.focus() });

    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "focus-not-applied",
    });
    expect(document.activeElement).toBe(redirect);
  });

  it.each([
    ["hidden", "hidden"],
    ["aria-hidden", "aria-hidden"],
    ["inert", "inert"],
  ] as const)(
    "rejects a slotted target below a %s shadow ancestor",
    (attribute, reason) => {
      const dom = new JSDOM(
        "<!doctype html><html><body><button id='current'>Current</button><div id='host'><button id='target'>Target</button></div></body></html>",
      );
      const document = dom.window.document;
      const current = document.querySelector<HTMLButtonElement>("#current")!;
      const host = document.querySelector<HTMLElement>("#host")!;
      const target = document.querySelector<HTMLButtonElement>("#target")!;
      const shadow = host.attachShadow({ mode: "open" });
      const ancestor = document.createElement("section");
      if (attribute === "aria-hidden") ancestor.setAttribute(attribute, "true");
      else ancestor.setAttribute(attribute, "");
      ancestor.append(document.createElement("slot"));
      shadow.append(ancestor);
      current.focus();

      expect(target.assignedSlot).not.toBeNull();
      expect(focusElement(target)).toMatchObject({ status: "skipped", reason });
      expect(document.activeElement).toBe(current);
    },
  );

  it("recognizes a shadow-tree guard containing a focused slotted target", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button id='restore'>Restore</button><div id='host'><button id='slotted'>Slotted</button></div></body></html>",
    );
    const document = dom.window.document;
    const restore = document.querySelector<HTMLButtonElement>("#restore")!;
    const host = document.querySelector<HTMLElement>("#host")!;
    const slotted = document.querySelector<HTMLButtonElement>("#slotted")!;
    const shadow = host.attachShadow({ mode: "open" });
    const guard = document.createElement("section");
    guard.append(document.createElement("slot"));
    shadow.append(guard);
    restore.focus();
    const capture = captureFocus(document);
    slotted.focus();

    expect(restoreFocus(capture, { onlyIfFocusWithin: guard }).status).toBe(
      "focused",
    );
  });

  it("contains a throwing assignedSlot accessor", () => {
    const dom = new JSDOM(
      "<!doctype html><html><body><button>Target</button></body></html>",
    );
    const target = dom.window.document.querySelector("button")!;
    Object.defineProperty(target, "assignedSlot", {
      get: () => {
        throw new Error("assignedSlot failed");
      },
    });

    expect(() => focusElement(target)).not.toThrow();
    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "unavailable",
    });
  });

  it("follows nested slots across nested open shadow roots", () => {
    const dom = new JSDOM(`<!doctype html><html><body>
      <button id="current">Current</button>
      <div id="outer"><div id="inner"><button id="target">Target</button></div></div>
    </body></html>`);
    const document = dom.window.document;
    const current = document.querySelector<HTMLButtonElement>("#current")!;
    const outer = document.querySelector<HTMLElement>("#outer")!;
    const inner = document.querySelector<HTMLElement>("#inner")!;
    const target = document.querySelector<HTMLButtonElement>("#target")!;
    const outerAncestor = document.createElement("section");
    outerAncestor.hidden = true;
    outerAncestor.append(document.createElement("slot"));
    outer.attachShadow({ mode: "open" }).append(outerAncestor);
    inner.attachShadow({ mode: "open" }).append(document.createElement("slot"));
    current.focus();

    expect(target.assignedSlot).not.toBeNull();
    expect(inner.assignedSlot).not.toBeNull();
    expect(focusElement(target)).toMatchObject({
      status: "skipped",
      reason: "hidden",
    });
    expect(document.activeElement).toBe(current);
  });
});
