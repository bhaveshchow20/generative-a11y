# `@generative-a11y/react`

React lifecycle integration for `@generative-a11y/core` and
`@generative-a11y/dom`. It adds announcement infrastructure and observable
browser signals around an existing interface. It does not replace or style the
host application's chat, messages, composer, controls, or preference UI.

The current test matrix uses React 19.2.8. The published peer range supports
React 18.2 and React 19.

## Install

```sh
npm install @generative-a11y/react
```

This assumes an existing React app with Node.js 22+ and compatible `react` and
`react-dom` peers (`^18.2.0 || ^19.0.0`). Core and DOM are package dependencies;
install them directly only when your own code imports their APIs. For AI SDK
chats, also install `@generative-a11y/ai-sdk`.

## Quick start

Wrap the existing application and dispatch normalized public core events from
the host's existing lifecycle. The provider's only rendered infrastructure is
one visually hidden polite region and one visually hidden assertive region.

```tsx
"use client";

import type { ReactNode } from "react";
import { A11yProvider } from "@generative-a11y/react";

export function AccessibleChat({ children }: { children: ReactNode }) {
  return <A11yProvider>{children}</A11yProvider>;
}
```

Place the existing chat inside `AccessibleChat`. The provider supplies runtime
and delivery ownership; the host or an adapter still supplies lifecycle events.
For a complete example with an existing AI SDK chat, see the
[AI SDK integration](https://generativea11y.com/docs/integrations/ai-sdk) and
the [typechecked consumer example](../../examples/consumer-journeys/chat.tsx).

Dispatching or mutating a live region is deterministic and testable. It does not
prove that a screen reader spoke the text; browser and assistive-technology
verification remains necessary.

## Provider

`A11yProvider` creates and owns a `Runtime` by default. Pass `runtime` to borrow
an existing runtime. A borrowed runtime is never disposed by React. An owned
runtime is disposed after a real unmount.

`A11yProviderProps` extends the core `RuntimeOptions`, so the initial `preset`,
`policy`, `clock`, `onAnnouncement`, `onDeliveryError`, and `onDiagnostic`
values are forwarded when the provider owns the runtime. It also accepts:

- `children`: the unchanged host React tree.
- `runtime`: a borrowed runtime.
- `delivery`: `false` to omit delivery infrastructure, or `DeliveryOptions` to
  set the DOM delivery mode and diagnostic callback. React owns the document and
  supplied regions, so those two DOM options are intentionally unavailable.
- `attention`: `false` for a stable all-unknown inert store, or
  `AttentionStoreOptions` for the owned browser observer.
- `attentionStore`: a borrowed `AttentionStore`, useful for a host-managed
  observer or deterministic integration test.
- `preferences`: `PreferenceStoreOptions` for the owned preference store.
  Persistence remains opt-in through these options.
- `preferenceStore`: a borrowed `PreferenceStore`.

All construction and delivery options are initial-session configuration. A
rerender does not silently rebuild the runtime, reconnect delivery with new
options, or reload stores. Changing `runtime` identity without a keyed remount
throws. To start a new session with different construction options, key the
provider or replace it deliberately.

Nested providers are supported. Hooks use the nearest provider, and each
provider has isolated runtime, store, and live-region state.

### Runtime configuration precedence

For an owned runtime, an explicit `preset` or `policy` takes precedence. If
neither is supplied, the initial external preference-store snapshot or the owned
store's configured default is converted with `preferencesToCoreConfiguration`. A
server renderer reads `getServerSnapshot`; a client renderer reads `getSnapshot`
through `useSyncExternalStore`. Preference snapshots are not read for runtime
configuration when a runtime, preset, or policy already makes them irrelevant. A
persisted browser value loads after the client commit; it updates the preference
hook but never mutates, disposes, or recreates the active runtime. The host can
apply it to a future deliberate runtime replacement.

## Hooks

Every hook throws a clear error outside `A11yProvider`.

- `useA11y()` returns the stable `A11yContextValue` with `runtime`,
  `attentionStore`, and `preferenceStore`.
- `useRuntime()` returns the current `Runtime`.
- `useAttention()` subscribes with `useSyncExternalStore` and returns the
  current `AttentionSnapshot` using the store's exact server snapshot during SSR
  and hydration.
- `usePreferences()` subscribes with `useSyncExternalStore` and returns a
  `PreferencesResult`: the frozen `preferences` snapshot, stable
  `setPreferences` callback, and underlying `store`.
- `useAttentionRefs()` returns stable, ref-only `AttentionRefs` for the host's
  existing elements.

## AttentionRefs

`useAttentionRefs()` is optional. It registers browser attention observations;
it is not required for announcement delivery and adds no roles or labels. Each
field is a stable callback ref accepting an existing `HTMLElement`:

- `composerRef`: the textarea, input, or editable element used to compose a
  message.
- `conversationRef`: the existing conversation container.
- `newestResponseRef`: the newest response element or visibility sentinel.

The refs unregister when replaced, cleared, or unmounted. They never focus or
scroll an element. Keep host accessibility semantics and existing refs intact;
compose refs using your framework's existing utility when an element needs both.

```tsx
const { composerRef, conversationRef, newestResponseRef } = useAttentionRefs();

<textarea ref={composerRef} />;
<div ref={conversationRef}>...</div>;
<div ref={newestResponseRef} />;
```

## SSR and hydration

Importing the package reads no browser globals and performs no DOM work. Server
rendering emits the same stable, empty, visually hidden polite and assertive
region markup that React hydrates. Runtime connection happens through the
committed region refs before ordinary child layout effects; render and hydration
do not announce. Rerenders and Strict Mode ref probes leave at most one active
DOM binding.

Owned attention and preference stores start after a client commit. Before then,
their managed external stores expose stable server snapshots and retain binding
registrations and valid preference writes for replay. Store startup is
transactional: if a later owned resource fails, earlier listeners and observers
are removed and the owned runtime is terminally disposed. Storage failures are
isolated by the DOM preference store and do not break rendering.

By default, the committed live regions select the browser realm. Owned attention
observes their `ownerDocument`; opt-in default preference persistence uses that
document's `defaultView.localStorage` and `storage` events. Explicitly injected
attention documents, storage, and event sources still take precedence. When a
persistence configuration supplies only storage or only an event source, React
preserves it and derives just the missing counterpart from the committed realm.
Derived native events normalize their `storageArea` to the effective storage
adapter after rejecting events from a different native storage area. With
`delivery={false}`, no region exists from which to discover a realm. A provider
rendered into a non-global document in that mode must inject
`attention.document` and preference persistence adapters. This does not require
an extra visible or wrapper element.

## Strict Mode and React Activity

React Strict Mode can run setup/cleanup probes and callback-ref probes. The
provider uses stable instances and a microtask cancellation token so a probe
cleanup cannot terminally dispose the runtime reused by the next setup. A true
unmount disposes owned resources after that boundary. Tests flush this cleanup
boundary explicitly.

The provider may be placed inside React 19 `<Activity>` boundaries. When an
Activity hides the provider, effect cleanup stops owned observers and stores;
when it becomes visible again, those resources restart. A true provider unmount
disposes owned resources after the cleanup boundary.

## Public supporting types

The package exports `A11yProviderProps`, `DeliveryOptions`, `A11yContextValue`,
`PreferencesResult`, `AttentionControl`, and `AttentionRefs` for typed host
integrations. Framework-independent runtime, DOM, attention, and preference
types continue to come from their owning packages.

## Limitations

- The integration observes public browser focus, visibility, and intersection
  signals. It does not know a screen reader's virtual cursor or detailed user
  intent.
- It never steals focus or scrolls during ordinary streaming.
- Preference changes do not reconfigure an active runtime.
- Framework-specific adapters for AI SDKs and chat frameworks are not part of
  this package.

## Documentation

- [React API reference](https://generativea11y.com/api/react)
- [React integration guide](https://generativea11y.com/docs/getting-started)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  owns lifecycle policy and scheduling.
- [`@generative-a11y/ai-sdk`](https://www.npmjs.com/package/@generative-a11y/ai-sdk)
  translates Vercel AI SDK chat state.

### Attention-aware announcement controls

`A11yProvider` observes attention by default. Set `attentionPolicy` to opt into
forwarding those observations to its runtime, and configure
`policy={{ attention: { enabled: true } }}` to enable the core policy. These are
separate choices. With a borrowed `runtime`, configure that runtime directly;
provider policy props do not reconfigure borrowed resources. Like the other
provider resource options, `attentionPolicy` is captured on mount; use a keyed
remount to change it. Only one attention bridge can own a runtime at a time.

`useAttentionControl()` returns `AttentionControl`: `{ state, setOverride }`.
`state` contains `observed`, `override`, and `effective`;
`setOverride("auto" | "normal" | "quiet")` changes the explicit user preference.
Call it from an event handler or effect. An explicit override takes precedence
over observations. The hook requires a provider and follows the runtime even
when observation forwarding is disabled. When the runtime policy is disabled, it
returns a stable frozen
`{ observed: "unknown", override: "auto", effective: "normal" }` default. Server
rendering always uses that inert default, with current runtime state read after
hydration. The bridge dispatches only after commit and releases its subscription
before owned stores and runtime; borrowed resources are not disposed.

## Localized announcements

The provider accepts `messages` at construction. Supplied runtimes must already
have their catalog configured; provider options never reconfigure a borrowed
runtime. Replacement is explicit; no language hot-swapping or persistence is
added.

See the
[localization guide](https://generativea11y.com/docs/localized-announcements).
