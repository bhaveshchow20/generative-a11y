# `@generative-a11y/devtools`

Opt-in, development-only diagnostics for generative-a11y runtimes. The default
headless store is framework-neutral, side-effect-free on import, and retains a
bounded redacted trace: it stores categories, timing, outcomes, stable runtime
IDs, queue/entity snapshots, and browser delivery metadata. It never retains
assistant text, labels, error messages, tool data, stacks, or DOM content.

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

## Declared adapter evidence

Pass `source` when attaching a runtime driven by an adapter. This is an
explicit, serializable declaration from the integration, not framework detection
by devtools. It lets an inspector show the adapter name, documented public
evidence, and exact, inferred, action-wrapper, or unavailable fidelity without
filling gaps in the lifecycle trace. The store freezes a copy of this metadata
and includes it in its redacted export.

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

The overlay does not auto-focus, trap focus, create a live region, modify host
layout, or install global shortcuts. `Cmd/Ctrl+K` is handled only while the open
inspector itself has focus.

```ts
import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const overlay = mountDevtoolsOverlay({ store });
overlay.dispose();
```
