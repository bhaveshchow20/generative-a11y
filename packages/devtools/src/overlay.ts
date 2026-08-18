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
:host { all: initial; color: #e7e5e4; font-family: ui-sans-serif, system-ui, sans-serif; }
*, *::before, *::after { box-sizing: border-box; }
button, input { font: inherit; }
button { cursor: pointer; }
button:focus-visible, input:focus-visible, [role="separator"]:focus-visible { outline: 2px solid #d6d3d1; outline-offset: 2px; }
.ga-launcher { position: fixed; z-index: 2147483646; right: 20px; bottom: 20px; display: inline-flex; align-items: center; gap: 9px; min-height: 40px; padding: 0 14px 0 11px; color: #fafaf9; background: #1c1917; border: 1px solid #44403c; border-radius: 999px; box-shadow: 0 10px 30px #0005; font-size: 13px; font-weight: 650; letter-spacing: .01em; }
.ga-launcher:hover { background: #292524; border-color: #78716c; }
.ga-launcher-mark { display: grid; width: 20px; height: 20px; place-items: center; color: #1c1917; background: #f5f5f4; border-radius: 6px; font: 750 9px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-overlay-panel { position: fixed; z-index: 2147483647; right: 20px; bottom: 20px; width: min(1080px, calc(100vw - 40px)); height: min(720px, calc(100vh - 40px)); min-height: 480px; overflow: hidden; color: #e7e5e4; background: #171717; border: 1px solid #3f3f46; border-radius: 16px; box-shadow: 0 28px 90px #0009; }
.ga-inspector { position: relative; display: flex; height: 100%; min-height: 0; flex-direction: column; background: #171717; }
.ga-inspector-header { display: flex; min-height: 68px; align-items: center; justify-content: space-between; gap: 16px; padding: 13px 16px 13px 18px; border-bottom: 1px solid #3f3f46; background: #1c1c1b; }
.ga-inspector-title-group, .ga-inspector-header-actions, .ga-inspector-tabs-bar, .ga-inspector-primary-actions, .ga-inspector-inline-actions, .ga-inspector-card-heading { display: flex; align-items: center; }
.ga-inspector-title-group { gap: 11px; }
.ga-inspector-title-group p { margin: 0 0 2px; color: #a8a29e; font: 700 9px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .11em; }
.ga-inspector-title-group h2 { margin: 0; color: #fafaf9; font-size: 15px; font-weight: 680; letter-spacing: -.01em; }
.ga-inspector-mark { display: grid; width: 30px; height: 30px; place-items: center; color: #18181b; background: #e7e5e4; border-radius: 8px; font: 800 11px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: -.08em; }
.ga-inspector-header-actions { gap: 7px; }
[data-slot="button"] { display: inline-flex; min-height: 30px; align-items: center; justify-content: center; gap: 6px; padding: 0 10px; color: #d6d3d1; background: transparent; border: 1px solid transparent; border-radius: 7px; font-size: 12px; font-weight: 600; }
[data-slot="button"][data-variant="outline"] { border-color: #52525b; background: #27272a; }
[data-slot="button"][data-variant="outline"]:hover, [data-slot="button"][data-variant="ghost"]:hover { color: #fafaf9; background: #3f3f46; }
[data-slot="button"][data-variant="secondary"] { color: #1c1917; background: #e7e5e4; }
[data-slot="button"][data-variant="secondary"]:hover { background: #fafaf9; }
[data-slot="button"][data-size="icon-sm"] { width: 30px; padding: 0; }
[data-slot="badge"] { display: inline-flex; align-items: center; min-height: 21px; padding: 0 8px; border: 1px solid #52525b; border-radius: 999px; color: #d6d3d1; background: #27272a; font: 650 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .02em; }
[data-slot="badge"][data-variant="secondary"] { color: #1c1917; border-color: #d6d3d1; background: #d6d3d1; }
[data-slot="badge"][data-variant="outline"] { color: #a8a29e; background: transparent; }
.ga-inspector-tabs { display: flex; min-height: 0; flex: 1; flex-direction: column; }
.ga-inspector-tabs-bar { justify-content: space-between; gap: 12px; padding: 10px 16px; border-bottom: 1px solid #3f3f46; background: #181818; }
[data-slot="tabs-list"] { display: inline-flex; gap: 3px; padding: 3px; background: #27272a; border-radius: 8px; }
[data-slot="tabs-trigger"] { min-height: 27px; padding: 0 9px; color: #a8a29e; background: transparent; border: 0; border-radius: 5px; font-size: 12px; font-weight: 650; }
[data-slot="tabs-trigger"][data-state="active"] { color: #fafaf9; background: #404040; box-shadow: 0 1px 1px #0004; }
[data-slot="tabs-content"] { min-height: 0; flex: 1; overflow: auto; outline: none; }
.ga-inspector-primary-actions { gap: 4px; }
.ga-inspector-overview, .ga-inspector-runtime-grid, .ga-inspector-traces { padding: 16px; }
.ga-inspector-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
[data-slot="card"] { overflow: hidden; color: #e7e5e4; background: #20201f; border: 1px solid #3f3f46; border-radius: 10px; }
[data-slot="card-header"] { padding: 13px 14px 0; }
[data-slot="card-content"] { padding: 12px 14px 14px; color: #a8a29e; font-size: 12px; line-height: 1.5; }
[data-slot="card-title"] { margin-top: 2px; color: #fafaf9; font-size: 16px; font-weight: 650; letter-spacing: -.015em; }
[data-slot="card-description"] { color: #a8a29e; font: 650 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; text-transform: uppercase; }
.ga-inspector-metric [data-slot="card-title"] { font-size: 25px; font-weight: 720; }
.ga-inspector-metric [data-slot="card-content"] { padding-top: 7px; color: #a8a29e; font-size: 11px; }
.ga-inspector-overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; }
.ga-inspector-overview-grid p, .ga-inspector-traces p { margin: 0; }
.ga-inspector-inline-actions { flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.ga-inspector-status { margin-top: 9px !important; color: #d6d3d1; font-size: 11px; }
.ga-inspector-timeline { display: flex; height: 100%; min-height: 0; flex-direction: column; }
.ga-inspector-timeline-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #3f3f46; }
.ga-inspector-search { display: flex; width: min(360px, 50%); align-items: center; gap: 8px; padding: 0 9px; color: #a8a29e; background: #20201f; border: 1px solid #3f3f46; border-radius: 7px; }
[data-slot="input"] { width: 100%; height: 31px; padding: 0; color: #e7e5e4; background: transparent; border: 0; outline: 0; font-size: 12px; }
[data-slot="input"]::placeholder { color: #a8a29e; }
.ga-inspector-filter-group { display: inline-flex; gap: 2px; }
.ga-inspector-filter-group [aria-pressed="true"] { color: #1c1917; background: #d6d3d1; }
.ga-inspector-timeline-split { display: flex; min-height: 0; flex: 1; }
[data-slot="resizable-panel"] { min-width: 0; min-height: 0; }
[data-slot="resizable-handle"] { position: relative; width: 1px; background: #3f3f46; }
[data-slot="resizable-handle"] > div { position: absolute; top: calc(50% - 14px); left: -2px; width: 5px; height: 28px; background: #71717a; border-radius: 999px; }
.ga-inspector-trace-scroll { height: 100%; }
[data-slot="scroll-area"], [data-slot="scroll-area-viewport"] { height: 100%; }
.ga-inspector-trace-list, .ga-inspector-queue-list { margin: 0; padding: 8px; list-style: none; }
.ga-inspector-trace-row { display: grid; width: 100%; grid-template-columns: 86px 72px minmax(120px, 1fr); gap: 8px; padding: 10px; text-align: left; color: #d6d3d1; background: transparent; border: 1px solid transparent; border-radius: 7px; }
.ga-inspector-trace-row:hover, .ga-inspector-trace-row[aria-current="true"] { background: #27272a; border-color: #3f3f46; }
.ga-inspector-trace-row time, .ga-inspector-trace-kind, .ga-inspector-trace-summary { color: #a8a29e; font: 600 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-inspector-trace-kind { color: #a8a29e; }
.ga-inspector-trace-title { color: #f5f5f4; font-size: 12px; font-weight: 650; }
.ga-inspector-trace-summary { grid-column: 3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ga-inspector-detail { height: 100%; overflow: auto; padding: 16px; background: #1c1c1b; }
.ga-inspector-detail-heading { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; color: #fafaf9; font-size: 13px; }
.ga-inspector-detail pre { overflow: auto; margin: 14px 0 0; padding: 10px; color: #d6d3d1; background: #171717; border: 1px solid #3f3f46; border-radius: 7px; font: 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-inspector-definition-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 0; }
.ga-inspector-definition-list > div { padding: 7px; background: #27272a; border-radius: 6px; }
.ga-inspector-definition-list dt { color: #a8a29e; font: 600 9px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
.ga-inspector-definition-list dd { overflow: hidden; margin: 3px 0 0; color: #e7e5e4; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.ga-inspector-runtime-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.ga-inspector-card-heading { justify-content: space-between; gap: 8px; }
.ga-inspector-runtime-card [data-slot="separator"] { height: 1px; margin: 13px 0; background: #3f3f46; }
.ga-inspector-subsection-title { color: #a8a29e; font: 650 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; }
.ga-inspector-queue-list { padding: 8px 0 0; }
.ga-inspector-queue-list li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 7px; padding: 6px 0; color: #d6d3d1; font-size: 11px; }
.ga-inspector-queue-list time { color: #a8a29e; font: 10px/1 ui-monospace, SFMono-Regular, Menlo, monospace; }
.ga-inspector-empty { padding: 16px; color: #a8a29e; font-size: 12px; line-height: 1.5; }
.ga-inspector-empty-card { grid-column: 1 / -1; }
.ga-inspector-traces { max-width: 680px; }
.ga-inspector-command { position: absolute; z-index: 2; top: 62px; right: 16px; width: min(340px, calc(100% - 32px)); padding: 6px; background: #27272a; border: 1px solid #52525b; border-radius: 10px; box-shadow: 0 16px 48px #0008; }
[data-slot="command"] { overflow: hidden; background: transparent; }
[data-slot="command-input-wrapper"] { padding: 5px; border-bottom: 1px solid #3f3f46; }
[data-slot="command-input"] { width: 100%; height: 29px; padding: 0 7px; color: #fafaf9; background: #171717; border: 1px solid #3f3f46; border-radius: 6px; outline: 0; }
[data-slot="command-list"] { max-height: 240px; overflow: auto; padding: 4px; }
[data-slot="command-item"] { display: flex; width: 100%; align-items: center; gap: 8px; padding: 8px; color: #d6d3d1; border-radius: 6px; font-size: 12px; }
[data-slot="command-item"][data-selected="true"] { color: #fafaf9; background: #3f3f46; }
@media (max-width: 680px) { .ga-overlay-panel { right: 8px; bottom: 8px; width: calc(100vw - 16px); height: calc(100vh - 16px); min-height: 0; border-radius: 12px; } .ga-launcher { right: 12px; bottom: 12px; } .ga-inspector-header { padding: 11px; } .ga-inspector-header-actions [data-slot="badge"], .ga-inspector-header-actions [data-slot="button"]:not([data-size="icon-sm"]) { display: none; } .ga-inspector-tabs-bar { align-items: flex-start; flex-direction: column; padding: 8px 10px; } .ga-inspector-metrics, .ga-inspector-overview-grid { grid-template-columns: 1fr 1fr; } .ga-inspector-runtime-grid { grid-template-columns: 1fr; } .ga-inspector-timeline-toolbar { align-items: stretch; flex-direction: column; padding: 10px; } .ga-inspector-search { width: 100%; } .ga-inspector-timeline-split { flex-direction: column; } [data-slot="resizable-handle"] { width: 100%; height: 1px; } .ga-inspector-detail { max-height: 42%; } .ga-inspector-trace-row { grid-template-columns: 72px minmax(0, 1fr); } .ga-inspector-trace-summary { grid-column: 2; } .ga-inspector-queue-list li { grid-template-columns: auto minmax(0, 1fr); } .ga-inspector-queue-list time { grid-column: 2; } }
@media (prefers-reduced-motion: no-preference) { .ga-overlay-panel { animation: ga-inspector-enter 140ms ease-out; } @keyframes ga-inspector-enter { from { opacity: 0; transform: translateY(8px) scale(.985); } to { opacity: 1; transform: none; } } }
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
  launcher.innerHTML =
    '<span class="ga-launcher-mark" aria-hidden="true">GA</span>Open inspector';
  launcher.setAttribute("aria-expanded", "false");
  const panel = selectedDocument.createElement("aside");
  panel.className = "ga-overlay-panel";
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
  let previousFocus: Element | null = null;
  const close = () => {
    open = false;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
  };
  const openPanel = () => {
    open = true;
    panel.hidden = false;
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
  };
  launcher.addEventListener("click", () => {
    if (open) close();
    else {
      previousFocus = selectedDocument.activeElement;
      openPanel();
    }
  });
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  selectedDocument.body.append(host);
  return {
    host,
    dispose() {
      if (disposed) return;
      disposed = true;
      root?.unmount();
      host.remove();
    },
  };
}
