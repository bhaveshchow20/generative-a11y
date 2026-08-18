# Architecture

## Dependency direction

```text
framework adapter -> react -> dom -> core
                            \------> core
custom JavaScript ----------------> core
```

In package terms, the Phase 2 stack is `core <- dom <- react`. React depends
directly on both `core` and `dom`: it needs the runtime's public types and
ownership APIs as well as the DOM stores and delivery binding. Core never
imports DOM or React code, DOM never imports React, and no package may create a
dependency circle.

## Package responsibilities

| Package                  | Responsibility                                                                 |
| ------------------------ | ------------------------------------------------------------------------------ |
| `@generative-a11y/core`  | Events, policies, scheduling, segmentation, runtime state, and diagnostics     |
| `@generative-a11y/dom`   | Announcement delivery, browser-signal stores, focus helpers, and preferences   |
| `@generative-a11y/react` | Provider and hooks that bind React lifecycles to borrowed core and DOM objects |

The DOM package has four bounded jobs:

1. Deliver a prepared `AnnouncementIntent` through `ariaNotify()` when callable
   or through stable polite/assertive live regions.
2. Expose conservative attention observations from document visibility, window
   focus, DOM focus, and intersection state.
3. Provide explicit, host-requested focus capture, focus, and restoration
   helpers. Streaming and status updates never invoke them automatically.
4. Validate and optionally persist versioned announcement preferences.

See [DOM integration decisions](dom-integration-decisions.md), the
[attention model](attention-model.md), and
[preference storage](preference-storage.md).

## Delivery is not policy

Core decides _whether_, _when_, and _what_ to announce. It owns lifecycle
validation, segmentation, coalescing, prioritization, cancellation, and timing.
DOM receives an already prepared intent and attempts delivery; it does not
reschedule, rewrite, deduplicate, or infer events. A `DOMDeliveryResult` records
a DOM/API action, not confirmed speech.

Attention snapshots and stored preferences are inputs a host or future React
binding may use when constructing core policy. They do not mutate an active
runtime by themselves.

## SSR and module evaluation

Public modules must be safe to import where `window`, `document`, storage, and
browser constructors do not exist. Browser globals are resolved only inside an
explicit constructor or helper call. An injected `Document`, storage object, or
observer factory takes precedence where the API accepts one.

Server snapshots are stable, conservative values: attention is all `"unknown"`,
and preferences use the configured default. This shape is designed for React's
server/external-store contract without pretending that server rendering has
browser evidence.

## Lifecycle ownership

- A `DOMRuntimeBinding` borrows its core runtime. Disposing the binding removes
  its subscription and disposes its announcer; it never disposes the runtime.
- A `DOMAnnouncer` removes regions it created. Supplied regions remain owned by
  the host and stay mounted after disposal.
- Attention and preference stores own their listeners and observers. Their
  creator must dispose them; cleanup is idempotent and stale callbacks cannot
  resume delivery or state updates.
- React providers will own only objects they create. Externally supplied
  runtimes remain externally owned, including across unmount and Strict Mode
  remounts.
- `@generative-a11y/react` uses `useSyncExternalStore` for attention and
  preference snapshots. The provider connects stable callback refs to the DOM
  announcer before child layout effects, then starts owned browser stores after
  commit. Server rendering stays inert and hydration receives the same region
  structure without announcing during render.
- Nested providers are isolated and use the nearest context. The provider is
  intentionally outside React 19 `<Activity>` boundaries because Activity can
  disconnect effects without representing a terminal runtime unmount.

## Adapter fidelity

Adapters declare whether interruption, retries, and connectivity are `exact`,
require an `action-wrapper`, are `inferred`, or are `unavailable`. A missing
protocol feature stays missing; it is not guessed from text or private state.
See [framework integration research](framework-integrations.md).

## Tooling and publication

The repository uses pnpm workspaces, strict TypeScript, tsup for ESM/CommonJS
bundles and declarations, Vitest for deterministic tests, React Testing Library
for component contracts, and Playwright for the browser layer. Public packages
use explicit exports and do not import another package's source files. Browser
and assistive-technology support is published only from dated test results; see
[browser support](browser-support.md) and the
[manual AT test plan](manual-at-test-plan.md).
