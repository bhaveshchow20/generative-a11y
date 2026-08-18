export function deepActiveElement(document: Document): Element | null {
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

export function composedContains(ancestor: Element, target: Element): boolean {
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

export function composedParent(element: Element): Element | null {
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
