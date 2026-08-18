import type { DevtoolsStore } from "./index.js";

export interface MountDevtoolsOverlayOptions {
  readonly store: DevtoolsStore;
  readonly document?: Document;
}

export interface MountedDevtoolsOverlay {
  readonly host: HTMLElement;
  dispose(): void;
}

const styles = `
:host { all: initial; color: #202124; font: 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
button { font: inherit; color: inherit; background: #fafafa; border: 1px solid #b9bec5; border-radius: 4px; padding: 6px 8px; cursor: pointer; }
button:focus-visible { outline: 2px solid #52697a; outline-offset: 2px; }
aside { position: fixed; right: 12px; bottom: 12px; width: min(420px, calc(100vw - 24px)); max-height: min(70vh, 560px); overflow: auto; box-sizing: border-box; background: #fafafa; border: 1px solid #9da3aa; border-radius: 6px; box-shadow: 0 8px 24px #0002; }
header, .row { display: flex; justify-content: space-between; gap: 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid #d9dde1; }
h2 { margin: 0; font: 600 13px/1.3 ui-sans-serif, system-ui, sans-serif; } ol { margin: 0; padding: 8px 24px; } li { padding: 2px 0; }
@media (prefers-reduced-motion: no-preference) { aside { transition: opacity 120ms ease; } }
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
  launcher.type = "button";
  launcher.textContent = "Diagnostics";
  launcher.setAttribute("aria-expanded", "false");
  const panel = selectedDocument.createElement("aside");
  panel.hidden = true;
  panel.tabIndex = -1;
  panel.setAttribute("aria-label", "Generative accessibility diagnostics");
  panel.innerHTML =
    '<header><h2>Diagnostics</h2><button type="button" data-close>Close</button></header><div class=row><button type="button" data-capture>Pause capture</button><button type="button" data-clear>Clear</button></div><ol></ol>';
  shadow.append(style, launcher, panel);
  const list = panel.querySelector("ol");
  const close = panel.querySelector<HTMLButtonElement>("[data-close]");
  const capture = panel.querySelector<HTMLButtonElement>("[data-capture]");
  const clear = panel.querySelector<HTMLButtonElement>("[data-clear]");
  let open = false;
  let disposed = false;
  let previousFocus: Element | null = null;
  const render = () => {
    const snapshot = options.store.getSnapshot();
    if (list)
      list.replaceChildren(
        ...snapshot.records.map((record) => {
          const item = selectedDocument.createElement("li");
          item.textContent = `${record.at} ${record.kind} ${record.reason ?? record.sourceType ?? ""}`;
          return item;
        }),
      );
    if (capture)
      capture.textContent = snapshot.paused
        ? "Resume capture"
        : "Pause capture";
  };
  const setOpen = (next: boolean) => {
    open = next;
    panel.hidden = !next;
    launcher.setAttribute("aria-expanded", String(next));
    if (!next && previousFocus instanceof HTMLElement) previousFocus.focus();
  };
  launcher.addEventListener("click", () => {
    previousFocus = selectedDocument.activeElement;
    setOpen(!open);
  });
  close?.addEventListener("click", () => setOpen(false));
  capture?.addEventListener("click", () => {
    if (options.store.getSnapshot().paused) options.store.resumeCapture();
    else options.store.pauseCapture();
  });
  clear?.addEventListener("click", () => options.store.clear());
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
  const unsubscribe = options.store.subscribe(render);
  render();
  selectedDocument.body.append(host);
  return {
    host,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      host.remove();
    },
  };
}
