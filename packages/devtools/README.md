# `@generative-a11y/devtools`

Opt-in, development-only diagnostics for generative-a11y runtimes. The default
headless store is framework-neutral, side-effect-free on import, and retains a
bounded redacted timeline: it stores categories, timing, outcomes, and stable
runtime IDs, not assistant text, labels, errors, tool data, or DOM content.

```ts
import { createDevtoolsStore } from "@generative-a11y/devtools";

const store = createDevtoolsStore({ maxEntries: 250 });
const detach = store.attachRuntime({ id: "support", runtime });
const unsubscribe = store.subscribe(renderDiagnostics);

store.pauseCapture(); // Does not pause or alter the runtime.
store.resumeCapture();
store.clear();

unsubscribe();
detach();
store.dispose();
```

The store only subscribes through `subscribeDiagnosticEvents()` and does not
monkey-patch dispatch, access browser globals, create UI, retain a core history,
or alter accessibility policy. A captured DOM/API delivery remains evidence of
an action, not proof that assistive technology spoke it.
