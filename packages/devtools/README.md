# `@generative-a11y/devtools`

Opt-in, development-only diagnostics for generative-a11y runtimes. The default
headless store is framework-neutral, side-effect-free on import, and retains a
bounded redacted trace: it stores categories, timing, outcomes, stable runtime
IDs, queue/entity snapshots, and browser delivery metadata. It never retains
assistant text, labels, error messages, tool data, stacks, or DOM content.

```sh
npm install --save-dev @generative-a11y/devtools
```

```ts
import { createDevtoolsStore } from "@generative-a11y/devtools";
import { THREAD_ADAPTER_METADATA } from "@generative-a11y/assistant-ui";

const store = createDevtoolsStore({ maxEntries: 250 });
const detach = store.attachRuntime({
  id: "support",
  runtime,
  source: {
    adapter: THREAD_ADAPTER_METADATA.name,
    fidelity: THREAD_ADAPTER_METADATA.fidelity,
    evidence: THREAD_ADAPTER_METADATA.observedRuntimeMethods,
  },
});
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
  idempotent detach function. Attaching the same ID replaces its subscription
  only after the replacement subscribes successfully.
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

## Declared adapter evidence

Pass `source` when attaching a runtime driven by an adapter. This is an
explicit, serializable declaration from the integration, not framework detection
by devtools. It lets an inspector show the adapter name, documented public
evidence and declared fidelity without filling gaps in the lifecycle trace.
`interruption` and `retries` accept `exact`, `action-wrapper`, or `unavailable`.
`connection` accepts those values plus `inferred`, because some integrations can
only derive connection state from another documented public signal. The store
freezes a copy of this metadata and includes it in its redacted export. Each
captured record references an opaque `runtimeSourceId`. Source revisions remain
immutable and exportable for as long as a retained record references them, even
after a runtime detaches or the same runtime ID is reattached with different
metadata. Unreferenced revisions are removed with ring-buffer eviction so
repeated attachment cannot create unbounded source history.

Use an adapter package's exported metadata where it fits the integration. For
custom adapters, provide only public signals that justify normalized events. Do
not put user content, internal URLs, or private framework state in `evidence`.
The store accepts at most 12 public evidence strings, each at most 120
characters, and rejects unsupported fidelity or optional-event values before it
subscribes to a runtime.

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
It creates one open Shadow DOM host only when called and starts collapsed. The
mounted workbench is built from package-local shadcn/Radix components, with its
styles contained inside that Shadow DOM. It provides one searchable, filterable
Accessibility Trace Explorer with a keyboard-managed trace list, selected causal
evidence, plain-language policy and delivery context, collapsed raw metadata,
capture pause/resume/clear/refresh actions, and explicit trace copy. These
actions affect only devtools capture, never runtime policy, queueing, focus, or
host UI.

Opening the overlay moves focus into the workbench; closing it restores the
element focused before the launcher was activated. Streaming records never move
focus. The overlay does not trap focus, create a live region, modify host
layout, or install global shortcuts.

```ts
import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const overlay = mountDevtoolsOverlay({ store });
overlay.dispose();
```

## Documentation

- [Devtools guide](https://generativea11y.com/docs/devtools)
- [API reference](https://generativea11y.com/api/devtools)
- [Repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  exposes the versioned diagnostic stream and content-free snapshots.
- [`@generative-a11y/dom`](https://www.npmjs.com/package/@generative-a11y/dom)
  exposes browser delivery results for safe correlation.
- [`@generative-a11y/core/testing`](https://generativea11y.com/api/core/testing)
  provides deterministic replay and semantic test assertions without another
  package installation.
