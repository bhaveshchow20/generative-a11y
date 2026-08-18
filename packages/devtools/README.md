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
const trace = store.exportTrace(); // schema-versioned and redacted
store.clear();

unsubscribe();
detach();
store.dispose();
```

## Store API

- `createDevtoolsStore({ maxEntries })` creates an isolated store. `maxEntries`
  defaults to `250`, must be a positive safe integer, and bounds the retained
  ring buffer. `droppedCount` reports records evicted since the last `clear()`.
- `attachRuntime({ id, runtime })` validates a non-empty ID, subscribes only to
  public diagnostics, captures an initial safe snapshot, and returns an
  idempotent detach function. Attaching the same ID replaces its subscription.
- `subscribe(listener)` observes store snapshot changes and returns an
  idempotent unsubscribe function. Listener failures do not alter capture.
- `getSnapshot()` returns a cached, immutable, content-free view until captured
  state changes. `refreshSnapshots()` explicitly requests fresh runtime
  snapshots without changing the observed runtimes.
- `pauseCapture()` and `resumeCapture()` change devtools capture only. They do
  not pause scheduling, delivery, or any host runtime behavior.
- `recordDelivery(input)` adds validated, content-free DOM delivery evidence. It
  records nothing while capture is paused or after disposal, but malformed IDs
  and timestamps still throw so integration defects remain visible.
- `exportTrace()` refreshes runtime snapshots and returns an immutable,
  schema-versioned, redacted trace. `clear()` removes retained records and
  resets `droppedCount` without detaching runtimes.
- `dispose()` is idempotent. It detaches all runtimes, clears captured state,
  publishes one final empty snapshot to current subscribers, and then removes
  those subscribers. Later attachment or subscription attempts throw; other
  control methods are no-ops.

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
a non-modal neutral diagnostic panel. Opening it moves focus into the panel;
closing it restores the element focused before the launcher was activated.
Streaming records never move focus. The overlay does not trap focus, create a
live region, modify host layout, or install global shortcuts.

```ts
import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const overlay = mountDevtoolsOverlay({ store });
overlay.dispose();
```
