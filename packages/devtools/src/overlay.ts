import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import { DevtoolsInspector } from "./inspector.js";
import type { DevtoolsStore } from "./index.js";

export interface MountDevtoolsOverlayOptions {
  readonly store: DevtoolsStore;
  readonly document?: Document;
  readonly copyText?: (value: string) => void | Promise<void>;
}

export interface MountedDevtoolsOverlay {
  readonly host: HTMLElement;
  dispose(): void;
}

const styles = `
:host { all: initial; color: #e7e5e4; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
*, *::before, *::after { box-sizing: border-box; }
button, input { font: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, [role="separator"]:focus-visible { outline: 1px solid #d6d3d1; outline-offset: 2px; }
.ga-launcher { position: fixed; z-index: 2147483646; left: 50%; bottom: 0; min-width: 184px; min-height: 34px; padding: 0 16px; color: #d6d3d1; background: #18181b; border: 1px solid #3f3f46; border-bottom: 0; border-radius: 8px 8px 0 0; box-shadow: 0 -8px 28px #0004; font-size: 12px; font-weight: 560; letter-spacing: -.005em; transform: translateX(-50%); }
.ga-launcher:hover { color: #fafaf9; background: #27272a; }
.ga-bottom-dock { position: fixed; z-index: 2147483647; right: 0; bottom: 0; left: 0; width: 100%; height: min(570px, 62vh); min-height: 340px; overflow: hidden; color: #e7e5e4; background: #18181b; border-top: 1px solid #3f3f46; border-radius: 12px 12px 0 0; box-shadow: 0 -20px 60px #0008; }
.ga-inspector { position: relative; display: flex; height: 100%; min-height: 0; flex-direction: column; background: #171717; }
.ga-inspector-header { display: flex; min-height: 48px; align-items: center; justify-content: space-between; gap: 16px; padding: 9px 18px; border-bottom: 1px solid #3f3f46; background: #18181b; }
[data-slot="button"] { display: inline-flex; min-height: 30px; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; color: #d6d3d1; background: transparent; border: 1px solid transparent; border-radius: 7px; font-size: 12px; font-weight: 600; }
[data-slot="button"][data-variant="outline"] { border-color: #52525b; background: #27272a; }
[data-slot="button"][data-variant="outline"]:hover, [data-slot="button"][data-variant="ghost"]:hover { color: #fafaf9; background: #3f3f46; }
[data-slot="button"][data-variant="secondary"] { color: #1c1917; background: #e7e5e4; }
[data-slot="button"][data-variant="secondary"]:hover { background: #fafaf9; }
[data-slot="button"][data-size="icon-sm"] { width: 30px; padding: 0; }
.ga-workspace-feedback { position: absolute; z-index: 5; top: 58px; right: 16px; padding: 8px 10px; color: #fafaf9; background: #27272a; border: 1px solid #52525b; border-radius: 7px; box-shadow: 0 10px 30px #0007; font-size: 12px; }
.ga-inspector-search { display: flex; width: min(360px, 50%); align-items: center; gap: 8px; padding: 0 9px; color: #a8a29e; background: #20201f; border: 1px solid #3f3f46; border-radius: 7px; }
[data-slot="input"] { width: 100%; height: 31px; padding: 0; color: #e7e5e4; background: transparent; border: 0; outline: 0; font-size: 12px; }
[data-slot="input"]::placeholder { color: #a8a29e; }
[data-slot="resizable-panel"] { min-width: 0; min-height: 0; }
[data-slot="resizable-handle"] { position: relative; width: 1px; background: #3f3f46; }
[data-slot="resizable-handle"] > div { position: absolute; top: calc(50% - 14px); left: -2px; width: 5px; height: 28px; background: #71717a; border-radius: 999px; }
[data-slot="scroll-area"], [data-slot="scroll-area-viewport"] { height: 100%; }
@media (prefers-reduced-motion: no-preference) { .ga-bottom-dock { animation: ga-inspector-enter 180ms cubic-bezier(.2,.8,.2,1); } @keyframes ga-inspector-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } } }
:host { color: #171717; font-family: Manrope, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
button:focus-visible, input:focus-visible, [role="listbox"]:focus-visible, [role="separator"]:focus-visible { outline: 2px solid #111; outline-offset: 2px; }
.ga-launcher { color: #f7f7f7; background: #111; border-color: #111; border-radius: 4px 4px 0 0; box-shadow: none; }
.ga-launcher:hover { color: #fff; background: #333; }
.ga-bottom-dock { height: min(620px, 68vh); color: #171717; background: #f7f7f7; border-color: #111; border-radius: 0; box-shadow: 0 -12px 34px #0003; }
.ga-inspector { background: #f7f7f7; }
.ga-inspector-header { min-height: 58px; padding: 12px 24px; color: #111; background: #f7f7f7; border-color: #d0d0d0; }
.ga-inspector-header p, .ga-inspector-header h2 { margin: 0; }
.ga-inspector-header p, .ga-section-heading p, .ga-detail-intro > p { color: #5f5f5f; font: 600 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .08em; text-transform: uppercase; }
.ga-inspector-header h2 { margin-top: 3px; color: #111; font-size: 16px; font-weight: 650; letter-spacing: -.03em; }
.ga-header-actions { display: flex; align-items: center; gap: 4px; }
[data-slot="button"] { color: #171717; border-radius: 3px; font-weight: 600; }
[data-slot="button"][data-variant="secondary"] { color: #f7f7f7; background: #111; }
[data-slot="button"][data-variant="outline"] { color: #171717; border-color: #bdbdbd; background: transparent; }
[data-slot="button"][data-variant="ghost"]:hover { color: #111; background: #e8e8e8; }
.ga-session-toolbar { display: flex; min-height: 50px; align-items: center; gap: 8px; padding: 8px 24px; border-bottom: 1px solid #d0d0d0; }
.ga-inspector-search { width: min(330px, 35%); color: #5f5f5f; background: #fff; border-color: #d0d0d0; border-radius: 3px; }
[data-slot="input"] { color: #171717; }
.ga-filter-group { display: inline-flex; gap: 2px; }
.ga-filter-group [aria-pressed="true"] { color: #f7f7f7; background: #111; }
.ga-session-count { margin-left: auto; color: #5f5f5f; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-explorer-layout { min-height: 0; flex: 1; }
.ga-inspector > [data-slot="resizable-panel-group"], .ga-explorer-layout { display: flex; min-height: 0; flex: 1; }
[data-slot="resizable-handle"] { background: #d0d0d0; }
.ga-trace-scroll, .ga-trace-detail { height: 100%; }
.ga-trace-list { min-height: 100%; padding: 8px 0; outline: none; }
.ga-trace-row { display: grid; grid-template-columns: 76px 110px minmax(130px, 1fr) auto; gap: 9px; align-items: center; min-height: 44px; padding: 8px 24px; cursor: pointer; border-bottom: 1px solid #e0e0e0; }
.ga-trace-row:hover, .ga-trace-row[aria-selected="true"] { background: #e8e8e8; }
.ga-trace-row time, .ga-trace-row span, .ga-trace-row code, .ga-causal-chain code, .ga-key-values dt, .ga-key-values dd { font: 600 10px/1.35 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-trace-row time, .ga-trace-row span, .ga-trace-row code { color: #5f5f5f; }
.ga-trace-row strong { overflow: hidden; color: #171717; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ga-empty-list { padding: 24px; color: #5f5f5f; font-size: 12px; }
.ga-trace-detail { overflow: auto; padding: 22px 24px; background: #fff; }
.ga-detail-intro h3, .ga-empty-state h3, .ga-section-heading h3 { margin: 4px 0 8px; color: #111; font-size: 16px; font-weight: 650; letter-spacing: -.03em; }
.ga-detail-intro > span, .ga-empty-state span, .ga-detail-section p { color: #5f5f5f; font-size: 12px; line-height: 1.55; }
.ga-detail-section { padding: 16px 0; border-top: 1px solid #d0d0d0; }
.ga-detail-section h4 { margin: 0 0 8px; color: #111; font-size: 12px; font-weight: 650; }
.ga-detail-section p { margin: 0 0 6px; }
.ga-boundary { padding-left: 10px; border-left: 2px solid #111; }
.ga-causal-chain { margin: 20px 0; padding: 16px 0; border-top: 1px solid #111; border-bottom: 1px solid #111; }
.ga-section-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.ga-section-heading > span { color: #5f5f5f; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-causal-chain ol { margin: 14px 0 0; padding: 0; list-style: none; }
.ga-causal-chain li { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; gap: 8px; align-items: center; min-height: 38px; border-top: 1px solid #e0e0e0; }
.ga-causal-chain li > span, .ga-causal-chain li b, .ga-causal-chain time { color: #5f5f5f; font: 600 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-causal-chain li code { display: block; margin-top: 3px; color: #111; }
.ga-key-values { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; margin: 0; background: #d0d0d0; border: 1px solid #d0d0d0; }
.ga-key-values > div { min-width: 0; padding: 8px; background: #f7f7f7; }
.ga-key-values-wide { grid-column: 1 / -1; }
.ga-key-values dt { color: #5f5f5f; text-transform: uppercase; }
.ga-key-values dd { overflow: hidden; margin: 4px 0 0; color: #111; text-overflow: ellipsis; white-space: nowrap; }
.ga-raw-record { margin-top: 16px; color: #171717; font-size: 12px; }
.ga-raw-record summary { cursor: pointer; font-weight: 650; }
.ga-raw-record pre { overflow: auto; margin: 10px 0 0; padding: 10px; color: #f7f7f7; background: #111; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-workspace-feedback { top: 68px; color: #f7f7f7; background: #111; border-color: #111; border-radius: 3px; box-shadow: none; }
@media (max-width: 760px) { .ga-bottom-dock { height: min(720px, 80vh); } .ga-inspector-header, .ga-session-toolbar { padding-right: 12px; padding-left: 12px; } .ga-session-toolbar { flex-wrap: wrap; } .ga-inspector-search { width: 100%; } .ga-session-count { margin-left: 0; } .ga-explorer-layout { flex-direction: column; } [data-slot="resizable-handle"] { width: 100%; height: 1px; } .ga-trace-row { grid-template-columns: 70px 1fr; padding: 8px 12px; } .ga-trace-row span, .ga-trace-row code { grid-column: 2; } .ga-trace-detail { padding: 18px 12px; } .ga-key-values { grid-template-columns: 1fr; } .ga-key-values-wide { grid-column: auto; } }
`;

export function mountDevtoolsOverlay(
  options: MountDevtoolsOverlayOptions,
): MountedDevtoolsOverlay {
  const selectedDocument =
    options.document ??
    (typeof document === "undefined" ? undefined : document);
  if (!selectedDocument?.body)
    throw new Error("A mountable document is required");
  const host = selectedDocument.createElement("generative-a11y-devtools");
  const shadow = host.attachShadow({ mode: "open" });
  const style = selectedDocument.createElement("style");
  style.textContent = styles;
  const launcher = selectedDocument.createElement("button");
  launcher.className = "ga-launcher";
  launcher.type = "button";
  launcher.textContent = "Open workspace";
  launcher.setAttribute("aria-expanded", "false");
  const panel = selectedDocument.createElement("aside");
  panel.className = "ga-bottom-dock";
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute(
    "aria-label",
    "Generative accessibility runtime inspector",
  );
  const reactContainer = selectedDocument.createElement("div");
  reactContainer.style.height = "100%";
  panel.append(reactContainer);
  shadow.append(style, launcher, panel);
  let root: Root | undefined;
  let open = false;
  let disposed = false;
  let previousFocus: HTMLElement | null = null;
  let focusBeforePointer: HTMLElement | null = null;
  const asHTMLElement = (element: Element | null): HTMLElement | null => {
    const HTMLElementConstructor = selectedDocument.defaultView?.HTMLElement;
    return HTMLElementConstructor && element instanceof HTMLElementConstructor
      ? element
      : null;
  };
  const close = () => {
    open = false;
    panel.hidden = true;
    panel.setAttribute("data-state", "collapsed");
    launcher.setAttribute("aria-expanded", "false");
    root?.unmount();
    root = undefined;
    (previousFocus ?? launcher).focus();
  };
  const openPanel = () => {
    open = true;
    panel.hidden = false;
    panel.setAttribute("data-state", "expanded");
    launcher.setAttribute("aria-expanded", "true");
    if (!root) root = createRoot(reactContainer);
    const copyText =
      options.copyText ??
      ((value: string) => {
        const clipboard = selectedDocument.defaultView?.navigator.clipboard;
        if (!clipboard) throw new Error("Clipboard access is unavailable");
        return clipboard.writeText(value);
      });
    root.render(
      createElement(DevtoolsInspector, {
        onClose: close,
        onCopy: copyText,
        store: options.store,
      }),
    );
    panel.focus();
  };
  launcher.addEventListener("pointerdown", () => {
    const active = asHTMLElement(selectedDocument.activeElement);
    focusBeforePointer = active === host ? null : active;
  });
  launcher.addEventListener("click", () => {
    if (open) close();
    else {
      const documentFocus = asHTMLElement(selectedDocument.activeElement);
      previousFocus =
        focusBeforePointer ??
        asHTMLElement(shadow.activeElement) ??
        (documentFocus === selectedDocument.body ? null : documentFocus);
      focusBeforePointer = null;
      openPanel();
    }
  });
  shadow.addEventListener("keydown", (event) => {
    if (open && (event as KeyboardEvent).key === "Escape") close();
  });
  selectedDocument.body.append(host);
  return {
    host,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (open) close();
      else root?.unmount();
      root = undefined;
      host.remove();
    },
  };
}
