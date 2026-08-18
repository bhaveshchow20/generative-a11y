# `@generative-a11y/devtools`

Opt-in, development-only diagnostics for generative-a11y runtimes. The default
headless store is framework-neutral, side-effect-free on import, and retains a
bounded redacted trace: it stores categories, timing, outcomes, stable runtime
IDs, queue/entity snapshots, and browser delivery metadata. It never retains
assistant text, labels, error messages, tool data, stacks, or DOM content.

```ts
import { createDevtoolsStore } from "@generative-a11y/devtools";

const store = createDevtoolsStore({ maxEntries: 250 });
const detach = store.attachRuntime({ id: "support", runtime });
const unsubscribe = store.subscribe(renderDiagnostics);

store.pauseCapture(); // Does not pause or alter the runtime.
store.resumeCapture();
store.refreshSnapshots();
store.clear();

const trace = store.exportTrace(); // schema-versioned and redacted

unsubscribe();
detach();
store.dispose();
```

The store only subscribes through `subscribeDiagnosticEvents()` and does not
monkey-patch dispatch, access browser globals, create UI, retain a core history,
or alter accessibility policy. A captured DOM/API delivery remains evidence of
an action, not proof that assistive technology spoke it.

## Browser delivery correlation

The store intentionally does not import `@generative-a11y/dom`. Connect the
announcer's public diagnostic callback yourself to capture a content-free
delivery record alongside runtime decisions:

```ts
const announcer = createDOMAnnouncer({
  onDiagnostic(result) {
    store.recordDelivery({ runtimeId: "support", result });
  },
});
```

This exposes the browser-level method and status (`aria-notify`, fallback live
region, unavailable, or disposed) and safe correlation IDs. It still cannot
establish what a screen reader announced.

## Explicit overlay

`@generative-a11y/devtools/overlay` is an optional browser-only mounting helper.
It creates one open Shadow DOM host only when called, starts collapsed, and uses
a non-modal neutral diagnostic panel. It does not auto-focus, trap focus, create
a live region, modify host layout, or install global shortcuts.

```ts
import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const overlay = mountDevtoolsOverlay({ store });
overlay.dispose();
```
