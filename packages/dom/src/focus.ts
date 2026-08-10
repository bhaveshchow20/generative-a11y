export interface FocusCapture {
  readonly document: Document | null;
  readonly target: Element | null;
}

export interface FocusElementOptions {
  preventScroll?: boolean;
}

export interface RestoreFocusOptions extends FocusElementOptions {
  onlyIfFocusWithin?: Element;
}

export type FocusSkippedReason =
  | "unavailable"
  | "cross-document"
  | "disconnected"
  | "disabled"
  | "hidden"
  | "aria-hidden"
  | "inert"
  | "missing-focus"
  | "guard-mismatch"
  | "focus-error"
  | "focus-not-applied";

export type FocusResult =
  | { readonly status: "focused"; readonly target: Element }
  | {
      readonly status: "skipped";
      readonly reason: FocusSkippedReason;
      readonly target: Element | null;
    };

export function captureFocus(selectedDocument?: Document): FocusCapture {
  const document =
    selectedDocument ??
    (typeof globalThis.document === "undefined"
      ? undefined
      : globalThis.document);
  if (!document) return Object.freeze({ document: null, target: null });
  let target: Element | null = null;
  try {
    const active = deepActiveElement(document);
    if (
      active !== null &&
      active !== document.body &&
      active !== document.documentElement &&
      active.ownerDocument === document
    ) {
      target = active;
    }
  } catch {
    // A hostile document is captured without a restorable target.
  }
  return Object.freeze({ document, target });
}

export function focusElement(
  target: Element,
  options: FocusElementOptions = {},
): FocusResult {
  const eligibility = focusEligibility(target);
  if (eligibility) {
    return { status: "skipped", reason: eligibility, target };
  }
  let focus: ((options?: FocusOptions) => void) | undefined;
  let document: Document;
  let previous: Element | null;
  try {
    document = target.ownerDocument;
    previous = deepActiveElement(document);
    focus = (target as Element & { focus?: (options?: FocusOptions) => void })
      .focus;
  } catch {
    return { status: "skipped", reason: "unavailable", target };
  }
  if (typeof focus !== "function") {
    return { status: "skipped", reason: "missing-focus", target };
  }
  let focusThrew = false;
  try {
    focus.call(target, { preventScroll: options.preventScroll ?? true });
  } catch {
    focusThrew = true;
  }
  if (focusThrew) {
    restorePreviousFocus(previous, target, document);
    return { status: "skipped", reason: "focus-error", target };
  }
  const postFocusEligibility = focusEligibility(target);
  let active: Element | null;
  try {
    active = deepActiveElement(document);
  } catch {
    return { status: "skipped", reason: "focus-error", target };
  }
  if (postFocusEligibility) {
    if (active === target) restorePreviousFocus(previous, target, document);
    return { status: "skipped", reason: postFocusEligibility, target };
  }
  if (active !== target) {
    return { status: "skipped", reason: "focus-not-applied", target };
  }
  return { status: "focused", target };
}

export function restoreFocus(
  capture: FocusCapture,
  options: RestoreFocusOptions = {},
): FocusResult {
  let document: Document | null;
  let target: Element | null;
  try {
    document = capture.document;
    target = capture.target;
  } catch {
    return { status: "skipped", reason: "unavailable", target: null };
  }
  if (!document || !target) {
    return { status: "skipped", reason: "unavailable", target: null };
  }
  try {
    if (target.ownerDocument !== document) {
      return { status: "skipped", reason: "cross-document", target };
    }
    const guard = options.onlyIfFocusWithin;
    if (guard !== undefined) {
      const active = deepActiveElement(document);
      if (
        guard.ownerDocument !== document ||
        active === null ||
        !composedContains(guard, active)
      ) {
        return { status: "skipped", reason: "guard-mismatch", target };
      }
    }
  } catch {
    return { status: "skipped", reason: "guard-mismatch", target };
  }
  return focusElement(target, options);
}

function focusEligibility(target: Element): FocusSkippedReason | undefined {
  let ownerDocument: Document;
  try {
    ownerDocument = target.ownerDocument;
    const ElementConstructor = ownerDocument.defaultView?.Element;
    if (
      !ownerDocument ||
      (ElementConstructor && !(target instanceof ElementConstructor))
    ) {
      return "unavailable";
    }
    if (target.isConnected !== true) return "disconnected";
    if (
      target.getAttribute("disabled") !== null ||
      (target as Element & { disabled?: unknown }).disabled === true
    ) {
      return "disabled";
    }
  } catch {
    return "unavailable";
  }
  try {
    const matches = target.matches;
    if (typeof matches === "function" && matches.call(target, ":disabled")) {
      return "disabled";
    }
  } catch {
    // Fall back to the direct disabled checks above.
  }

  try {
    let current: Element | null = target;
    const visited = new Set<Element>();
    while (current) {
      if (visited.has(current)) return "unavailable";
      visited.add(current);
      if (current.hasAttribute("hidden")) return "hidden";
      if (current.getAttribute("aria-hidden")?.trim().toLowerCase() === "true")
        return "aria-hidden";
      if (
        current.hasAttribute("inert") ||
        (current as Element & { inert?: unknown }).inert === true
      ) {
        return "inert";
      }
      current = composedParent(current);
    }
  } catch {
    return "unavailable";
  }

  try {
    const focus = (
      target as Element & {
        focus?: (options?: FocusOptions) => void;
      }
    ).focus;
    if (typeof focus !== "function") return "missing-focus";
  } catch {
    return "unavailable";
  }
  return undefined;
}

function restorePreviousFocus(
  previous: Element | null,
  attempted: Element,
  document: Document,
): void {
  try {
    if (
      !previous ||
      deepActiveElement(document) !== attempted ||
      focusEligibility(previous) !== undefined
    ) {
      return;
    }
    const focus = (
      previous as Element & {
        focus?: (options?: FocusOptions) => void;
      }
    ).focus;
    if (typeof focus === "function")
      focus.call(previous, { preventScroll: true });
  } catch {
    // Focus rollback is best-effort at hostile DOM boundaries.
  }
}

function deepActiveElement(document: Document): Element | null {
  let active = document.activeElement;
  const visited = new Set<Element>();
  while (active) {
    if (visited.has(active)) throw new Error("Cyclic active element");
    visited.add(active);
    const shadow = (active as Element & { shadowRoot?: ShadowRoot | null })
      .shadowRoot;
    const nested = shadow?.activeElement;
    if (!nested) return active;
    active = nested;
  }
  return null;
}

function composedContains(ancestor: Element, target: Element): boolean {
  let current: Element | null = target;
  const visited = new Set<Element>();
  while (current) {
    if (current === ancestor) return true;
    if (visited.has(current)) throw new Error("Cyclic composed tree");
    visited.add(current);
    current = composedParent(current);
  }
  return false;
}

function composedParent(element: Element): Element | null {
  const assignedSlot = (
    element as Element & { assignedSlot?: HTMLSlotElement | null }
  ).assignedSlot;
  if (assignedSlot) return assignedSlot;
  if (element.parentElement) return element.parentElement;
  const root = element.getRootNode();
  if (root && "host" in root) {
    const host = (root as ShadowRoot).host;
    if (host.ownerDocument === element.ownerDocument) return host;
  }
  return null;
}
