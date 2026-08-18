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
.ga-inspector-title-group, .ga-inspector-header-actions, .ga-inspector-tabs-bar, .ga-inspector-primary-actions, .ga-inspector-inline-actions, .ga-inspector-card-heading { display: flex; align-items: center; }
.ga-inspector-title-group { gap: 11px; }
.ga-inspector-title-group p { margin: 0 0 1px; color: #a8a29e; font-size: 11px; line-height: 1.2; }
.ga-inspector-title-group h2 { margin: 0; color: #fafaf9; font-size: 15px; font-weight: 600; letter-spacing: -.015em; }
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
.ga-inspector-tabs-bar { justify-content: space-between; gap: 12px; padding: 8px 18px; border-bottom: 1px solid #3f3f46; background: #18181b; }
[data-slot="tabs-list"] { display: inline-flex; gap: 3px; padding: 3px; background: #27272a; border-radius: 8px; }
[data-slot="tabs-trigger"] { min-height: 27px; padding: 0 9px; color: #a8a29e; background: transparent; border: 0; border-radius: 5px; font-size: 12px; font-weight: 650; }
[data-slot="tabs-trigger"][data-state="active"] { color: #fafaf9; background: #404040; box-shadow: 0 1px 1px #0004; }
[data-slot="tabs-content"] { min-height: 0; flex: 1; overflow: auto; outline: none; }
.ga-inspector-primary-actions { gap: 4px; }
.ga-inspector-overview { padding: 22px 24px 24px; }
.ga-inspector-runtime-grid, .ga-inspector-traces { padding: 18px 24px; }
.ga-inspector-metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
[data-slot="card"] { overflow: hidden; color: #e7e5e4; background: #20201f; border: 1px solid #3f3f46; border-radius: 10px; }
[data-slot="card-header"] { padding: 13px 14px 0; }
[data-slot="card-content"] { padding: 12px 14px 14px; color: #a8a29e; font-size: 12px; line-height: 1.5; }
[data-slot="card-title"] { margin-top: 2px; color: #fafaf9; font-size: 16px; font-weight: 650; letter-spacing: -.015em; }
[data-slot="card-description"] { color: #a8a29e; font: 650 10px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: .04em; text-transform: uppercase; }
.ga-inspector-metric [data-slot="card-title"] { font-size: 19px; font-weight: 620; }
.ga-inspector-metric [data-slot="card-content"] { padding-top: 7px; color: #a8a29e; font-size: 11px; }
.ga-inspector-overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
.ga-inspector-overview-grid p, .ga-inspector-traces p { margin: 0; }
.ga-inspector-inline-actions { flex-wrap: wrap; gap: 7px; margin-top: 14px; }
.ga-inspector-status { margin-top: 9px !important; color: #d6d3d1; font-size: 11px; }
.ga-trace-map { min-height: 260px; overflow: hidden; padding: 22px 24px 16px; background: #1c1c1b; border: 1px solid #3f3f46; border-radius: 9px; }
.ga-trace-map-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.ga-trace-map-heading p { margin: 0 0 3px; color: #a8a29e; font-size: 11px; }
.ga-trace-map-heading h3 { margin: 0; color: #fafaf9; font-size: 13px; font-weight: 560; letter-spacing: -.01em; }
.ga-trace-map-heading > span { padding-top: 2px; color: #a8a29e; font-size: 11px; white-space: nowrap; }
.ga-trace-map-svg { display: block; width: 100%; height: 176px; margin-top: 12px; overflow: visible; }
.ga-trace-map-label { fill: #a8a29e; font: 11px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.ga-trace-map-lane { stroke: #3f3f46; stroke-width: 1; stroke-dasharray: 2 5; }
.ga-trace-map-path { fill: none; stroke: #52525b; stroke-width: 1.5; }
.ga-trace-map-event circle { stroke: #18181b; stroke-width: 3; }
.ga-trace-map-event { cursor: pointer; }
.ga-trace-map-event:focus { outline: none; }
.ga-trace-map-event:focus-visible circle { stroke: #fafaf9; stroke-width: 4; }
.ga-trace-map-event:hover circle { r: 8px; }
.ga-trace-map-event-observed circle, .ga-tone-observed { fill: #a8a29e; }
.ga-trace-map-event-decision circle, .ga-tone-decision { fill: #e7e5e4; }
.ga-trace-map-event-delivery circle, .ga-tone-delivery { fill: #86efac; }
.ga-trace-map-legend { display: flex; gap: 14px; color: #a8a29e; font-size: 11px; }
.ga-trace-map-legend span { display: inline-flex; align-items: center; gap: 5px; }
.ga-trace-map-legend i { display: block; width: 6px; height: 6px; border-radius: 50%; }
.ga-trace-map-selection { min-height: 26px; margin-top: 9px; padding-top: 9px; color: #a8a29e; border-top: 1px solid #3f3f46; font-size: 11px; line-height: 1.4; }
.ga-trace-map-selection strong { margin-right: 7px; color: #e7e5e4; font-weight: 600; }
.ga-workspace-feedback { position: absolute; z-index: 5; top: 58px; right: 16px; padding: 8px 10px; color: #fafaf9; background: #27272a; border: 1px solid #52525b; border-radius: 7px; box-shadow: 0 10px 30px #0007; font-size: 12px; }
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
@media (max-width: 680px) { .ga-bottom-dock { height: min(680px, 78vh); min-height: 380px; } .ga-launcher { min-width: 160px; } .ga-inspector-header { padding: 8px 12px; } .ga-inspector-tabs-bar { align-items: center; padding: 7px 12px; } .ga-inspector-tabs-bar [data-slot="tabs-trigger"] { padding: 0 7px; font-size: 11px; } .ga-inspector-primary-actions [data-slot="button"] { padding: 0 4px; } .ga-inspector-overview, .ga-inspector-runtime-grid, .ga-inspector-traces { padding: 10px 12px; } .ga-inspector-metrics { grid-template-columns: 1fr 1fr; } .ga-inspector-overview-grid, .ga-inspector-runtime-grid { grid-template-columns: 1fr; } .ga-inspector-timeline-toolbar { align-items: stretch; flex-direction: column; padding: 10px; } .ga-inspector-search { width: 100%; } .ga-inspector-timeline-split { flex-direction: column; } [data-slot="resizable-handle"] { width: 100%; height: 1px; } .ga-inspector-detail { max-height: 42%; } .ga-inspector-trace-row { grid-template-columns: 72px minmax(0, 1fr); } .ga-inspector-trace-summary { grid-column: 2; } .ga-inspector-queue-list li { grid-template-columns: auto minmax(0, 1fr); } .ga-inspector-queue-list time { grid-column: 2; } .ga-trace-map { padding: 12px; } .ga-trace-map-svg { width: 620px; max-width: none; } .ga-trace-map { overflow-x: auto; } }
@media (prefers-reduced-motion: no-preference) { .ga-bottom-dock { animation: ga-inspector-enter 180ms cubic-bezier(.2,.8,.2,1); } @keyframes ga-inspector-enter { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } } }
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
  let previousFocus: Element | null = null;
  const close = () => {
    open = false;
    panel.hidden = true;
    panel.setAttribute("data-state", "collapsed");
    launcher.setAttribute("aria-expanded", "false");
    if (previousFocus instanceof HTMLElement) previousFocus.focus();
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
