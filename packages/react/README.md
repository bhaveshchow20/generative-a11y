# `@generative-a11y/react`

React lifecycle integration for `@generative-a11y/core` and
`@generative-a11y/dom`. It adds announcement infrastructure and observable
browser signals around an existing interface. It does not replace or style the
host application's chat, messages, composer, controls, or preference UI.

The current test matrix uses React 19.2.8. The published peer range supports
React 18.2 and React 19.

## Install

```sh
npm install @generative-a11y/core @generative-a11y/dom @generative-a11y/react react react-dom
```

## Quick start

Wrap the existing application and dispatch normalized public core events from
the host's existing lifecycle. The provider's only rendered infrastructure is
one visually hidden polite region and one visually hidden assertive region.

```tsx
import {
  GenerativeA11yProvider,
  useGenerativeA11yBindings,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";

function ExistingChat() {
  const runtime = useGenerativeA11yRuntime();
  const bindings = useGenerativeA11yBindings();

  return (
    <div {...bindings.conversationProps}>
      {/* Existing messages remain unchanged. */}
      <div {...bindings.newestResponseProps}>Latest response</div>
      <textarea {...bindings.composerProps} />
      <button
        onClick={() =>
          runtime.dispatch({ type: "response.started", responseId: "r1" })
        }
      >
        Send
      </button>
    </div>
  );
}

export function App() {
  return (
    <GenerativeA11yProvider>
      <ExistingChat />
    </GenerativeA11yProvider>
  );
}
```

Dispatching or mutating a live region is deterministic and testable. It does not
prove that a screen reader spoke the text; browser and assistive-technology
verification remains necessary.

## Provider

`GenerativeA11yProvider` creates and owns a `GenerativeA11yRuntime` by default.
Pass `runtime` to borrow an existing runtime. A borrowed runtime is never
disposed by React. An owned runtime is disposed after a real unmount.

`GenerativeA11yProviderProps` extends the core `GenerativeA11yOptions`, so the
initial `preset`, `policy`, `clock`, `onAnnouncement`, `onDeliveryError`, and
`onDiagnostic` values are forwarded when the provider owns the runtime. It also
accepts:

- `children`: the unchanged host React tree.
- `runtime`: a borrowed runtime.
- `dom`: `false` to omit delivery infrastructure, or `GenerativeA11yDOMOptions`
  to set the DOM delivery mode and diagnostic callback. React owns the document
  and supplied regions, so those two DOM options are intentionally unavailable.
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

Every hook throws a clear error outside `GenerativeA11yProvider`.

- `useGenerativeA11y()` returns the stable `GenerativeA11yContextValue` with
  `runtime`, `attentionStore`, and `preferenceStore`.
- `useGenerativeA11yRuntime()` returns the current `GenerativeA11yRuntime`.
- `useGenerativeA11yAttention()` subscribes with `useSyncExternalStore` and
  returns the current `AttentionSnapshot` using the store's exact server
  snapshot during SSR and hydration.
- `useGenerativeA11yPreferences()` subscribes with `useSyncExternalStore` and
  returns a `GenerativeA11yPreferencesResult`: the frozen `preferences`
  snapshot, stable `setPreferences` callback, and underlying `store`.
- `useGenerativeA11yBindings()` returns stable, ref-only
  `GenerativeA11yBindings` for the host's existing elements.

## Bindings

`GenerativeA11yBindings` contains:

- `composerProps`, typed as `GenerativeA11yComposerProps`, for an existing
  textarea.
- `conversationProps`, typed as `GenerativeA11yConversationProps`, for the
  existing conversation container.
- `newestResponseProps`, typed as `GenerativeA11yNewestResponseProps`, for the
  newest response or sentinel.

These objects only contain stable callback refs. They register raw attention
observations and clean up when a ref is replaced, cleared, or unmounted. They do
not add roles, infer stop/retry/approval lifecycle events, focus elements, or
scroll the application.

```tsx
const bindings = useGenerativeA11yBindings();

<textarea {...bindings.composerProps} />;
<div {...bindings.conversationProps}>...</div>;
<div {...bindings.newestResponseProps} />;
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
`dom={false}`, no region exists from which to discover a realm. A provider
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

The package exports `GenerativeA11yProviderProps`, `GenerativeA11yDOMOptions`,
`GenerativeA11yContextValue`, `GenerativeA11yPreferencesResult`,
`GenerativeA11yBindings`, `GenerativeA11yComposerProps`,
`GenerativeA11yConversationProps`, and `GenerativeA11yNewestResponseProps` for
typed host integrations. Framework-independent runtime, DOM, attention, and
preference types continue to come from their owning packages.

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
