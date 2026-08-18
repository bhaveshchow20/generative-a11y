# `@generative-a11y/dom`

DOM announcement delivery for `@generative-a11y/core`. The package mounts or
adopts live regions without changing the host application's visible interface.
It reports DOM delivery actions; it does not claim that assistive technology
produced speech.

## Install

```sh
pnpm add @generative-a11y/core @generative-a11y/dom
```

## Connect a runtime

`connectRuntimeToDOM(runtime, options?)` creates a `DOMAnnouncer`, subscribes it
to a `GenerativeA11yRuntime`, and returns a `DOMRuntimeBinding`. Disposing the
binding unsubscribes and disposes the announcer, but never disposes the borrowed
runtime.

```ts
import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const binding = connectRuntimeToDOM(runtime);

// Later:
binding.dispose();
runtime.dispose();
```

`DOMRuntimeBinding` exposes the connected `announcer` and an idempotent
`dispose()` method. Once disposed, the binding cannot mutate its regions even if
the runtime was already delivering an event. If subscription fails, any regions
created for the attempted binding are removed before the error is rethrown.

## Create an announcer directly

`createDOMAnnouncer(options?)` returns a `DOMAnnouncer`. When a document is
available, it synchronously mounts one polite and one assertive region before
returning. Each announcer owns an isolated pair. Without an injected or global
document it remains inert, so the module and constructor are safe in server
environments.

```ts
import { createDOMAnnouncer } from "@generative-a11y/dom";

const announcer = createDOMAnnouncer({ mode: "auto" });
const result = announcer.announce(intent);
announcer.dispose();
```

`DOMAnnouncer` provides:

- `announce(intent)`, which returns a `DOMDeliveryResult`.
- `getRegions()`, which returns the `DOMLiveRegions` pair or `undefined` when
  the DOM is unavailable.
- An idempotent `dispose()`. It removes regions created by the announcer and
  leaves supplied regions mounted. Later announcements report `disposed`.

## Options and modes

`DOMAnnouncerOptions` accepts:

- `document`: an injected `Document`. If omitted, creation uses a supplied
  region's owner document and then the current global document, when available.
- `mode`: a `DOMAnnouncementMode` of `"auto"`, `"aria-notify"`, or
  `"live-region"`. Both progressive-enhancement modes try a callable
  `ariaNotify` on the selected region and fall back when it is absent.
  `"live-region"` always uses text mutation.
- `regions`: a pre-mounted `DOMLiveRegions` pair with `polite` and `assertive`
  elements. Supply dedicated, connected, empty elements in the same document;
  neither element may contain the other, and an explicitly supplied `document`
  must be their owner document. The driver normalizes direct hiding attributes
  and inline `display`, `visibility`, and `content-visibility`, then applies the
  required live-region attributes and visually hidden inline styles. The caller
  must ensure ancestors and external CSS keep both regions in the accessibility
  tree. Supplied elements remain owned by the caller.
- `onDiagnostic`: a callback invoked with the `DOMDeliveryResult` for each
  attempted announcement. Callback errors are isolated from delivery.

If `ariaNotify` throws, that notifier is disabled for the announcer. The same
intent is delivered once through live-region mutation, and later intents remain
on that fallback path.

## Delivery results

`DOMDeliveryResult` is serializable and contains:

- `status`: `"notified"`, `"mutated"`, `"unavailable"`, or `"disposed"`.
- `method`: `"aria-notify"`, `"live-region"`, or `"none"`.
- `channel`: the selected core announcement channel.
- `announcementId`, `sourceType`, `at`, and any source/entity IDs from the
  intent, so diagnostic consumers can correlate a DOM action with the runtime
  decision that requested it. `at` is the core intent timestamp, not a DOM
  delivery or speech timestamp.
- `error`, when notifier invocation failed, with serializable `name` and
  `message` strings.

`DOMLiveRegions` contains the stable outer `polite` and `assertive` elements.
Live-region delivery sets or clears `lang` from the intent locale and replaces
the region's text content on every delivery, including repeated identical text.
Announcement strings are inserted as literal text, never HTML. The result
records a browser/API action only; even a correlated successful `ariaNotify()`
call or live-region mutation does not establish that assistive technology spoke
the announcement.

## Observe attention signals

`createAttentionStore(options?)` returns an `AttentionStore`, an external-store
compatible source of conservative browser signals. It observes raw visibility,
window focus, DOM focus area, and whether the currently registered newest
response intersects the viewport. These signals do not reveal a screen-reader
virtual cursor or user intent.

```ts
import { createAttentionStore } from "@generative-a11y/dom";

const attention = createAttentionStore();
const unregisterComposer = attention.registerComposer(composerElement);
const unsubscribe = attention.subscribe(() => {
  const snapshot = attention.getSnapshot();
  console.log(snapshot.mode);
});

// Later:
unsubscribe();
unregisterComposer();
attention.dispose();
```

`ExternalStore<T>` exposes `subscribe(listener)`, `getSnapshot()`, and
`getServerSnapshot()`. `AttentionStore` implements
`ExternalStore<AttentionSnapshot>` and adds:

- `registerComposer(element)` and `registerConversation(element)`. Any
  registered element containing `document.activeElement` matches. Composer wins
  when registered areas overlap. Repeated registrations of the same element are
  reference-counted. Each returned unregister function is idempotent.
- `registerNewestResponse(element)`. Only one newest response is current; a
  later registration replaces the prior target. Unregistering an older target
  cannot remove its replacement. Each registration receives a fresh observer
  epoch, including when the same element is registered again, so queued records
  from an older registration are ignored. When one callback contains multiple
  records for the current target, the final record is the current transition.
- `dispose()`, which is idempotent and removes listeners, registrations,
  subscribers, and the intersection observer. Subscribing or registering after
  disposal throws. Stores created without a document are permanently inert; all
  their methods remain safe no-ops.

Subscribers present when a snapshot changes are invoked at most once for that
transition. Adding, removing, or re-subscribing listeners during notification
affects later transitions, not the stable listener snapshot already in flight.
Listener errors remain isolated.

`AttentionSnapshot` is frozen and cached by value, so `getSnapshot()` returns
the same reference until a raw or derived value changes. Its fields are:

- `visibility`: `"visible"`, `"hidden"`, or `"unknown"`.
- `windowFocus`: `"focused"`, `"blurred"`, or `"unknown"`.
- `focusArea`: `"composer"`, `"conversation"`, `"elsewhere"`, `"none"`, or
  `"unknown"`.
- `newestResponse`: `"visible"`, `"outside"`, `"unobserved"`, or `"unknown"`.
- `mode`: `"background"` when hidden; `"away"` when visible and blurred;
  `"reading-history"` when visible, focused, and the newest response is outside;
  `"foreground"` when visible, focused, and the newest response is visible;
  otherwise `"unknown"`.

Creation uses an injected document or the current browser document. Without
either, client and server snapshots are the same constant all-`"unknown"` value.
With a document but no registered newest response, `newestResponse` is
`"unobserved"`. Registering a newest response without IntersectionObserver
support produces `"unknown"`, never optimistic `"visible"`.

`AttentionStoreOptions` accepts an injected `document`, an optional
`createIntersectionObserver` (`AttentionIntersectionObserverFactory`), and an
optional `intersectionObserverInit`. The factory returns the minimal
`AttentionIntersectionObserver` interface (`observe`, `unobserve`, and
`disconnect`), allowing deterministic tests without browser globals. The store
does not use timers and never changes focus or scroll position. Observer
creation, observation, and cleanup failures are treated as unavailable
intersection evidence and deliberately suppressed; DOM listener and subscriber
cleanup still completes.

## Use conservative focus helpers

Focus helpers are never invoked automatically. They are explicit host actions
for workflows, such as restoring focus after an application-owned interaction.
Ordinary streaming, status changes, and announcements do not move focus.

```ts
import { captureFocus, restoreFocus } from "@generative-a11y/dom";

const capture = captureFocus();
// The host opens and later closes its interaction.
const result = restoreFocus(capture, { onlyIfFocusWithin: interactionElement });
```

`captureFocus(document?)` returns a frozen `FocusCapture` containing the exact
originating `Document` and deepest active `Element` references. It follows
`activeElement` through nested open shadow roots and uses the current browser
document when none is injected. Missing documents, throwing `activeElement`
accessors, and focus on `body` or `documentElement` produce a capture with no
restorable target. Closed shadow roots deliberately expose only their host, so
their internal focused element is unavailable to these helpers.

`focusElement(target, options?)` requests focus through the target's public
`focus()` method. `FocusElementOptions.preventScroll` defaults to `true` and can
be set to `false`. Success is verified with `ownerDocument.activeElement`.

`restoreFocus(capture, options?)` checks that the captured target still belongs
to its originating document, then delegates to `focusElement`. A capture can be
used repeatedly. `RestoreFocusOptions` adds `onlyIfFocusWithin`: restoration
proceeds only while the current active element is that guard or its descendant.
If focus has moved elsewhere or is unavailable, restoration is skipped so a
later user focus move is preserved. Guard containment follows the composed tree
through assigned slots and across open shadow-root hosts.

Both operations return a finite `FocusResult`: either
`{ status: "focused", target }` or `{ status: "skipped", reason, target }`.
`FocusSkippedReason` is one of `"unavailable"`, `"cross-document"`,
`"disconnected"`, `"disabled"`, `"hidden"`, `"aria-hidden"`, `"inert"`,
`"missing-focus"`, `"guard-mismatch"`, `"focus-error"`, or
`"focus-not-applied"`.

Eligibility is intentionally conservative. The target must be an element from
its owner document, remain connected, expose a callable public focus method, not
be effectively disabled, and have no self or composed ancestor with `hidden`,
`aria-hidden="true"`, or `inert`. Effective disabled checks use the browser's
`:disabled` matching, including disabled-fieldset and first-legend behavior,
with guarded direct-state fallback. Composed ancestry follows assigned slots
before light-DOM parents, then crosses open shadow roots through their hosts.
These checks do not claim perfect browser focusability: layout, computed CSS,
tab order, and device behavior require real browser and assistive-technology
testing.

Eligibility is checked both before and immediately after the focus call. If the
target becomes ineligible while remaining deeply active, the helper restores the
previous target only when that previous target is still conservatively eligible.
A synchronous third-party redirect is never overwritten: if focus ends on
another element, the helper reports `"focus-not-applied"` or `"focus-error"` and
preserves that destination. All rollback and verification remain best-effort at
hostile DOM boundaries without leaking errors.

`FocusElementOptions`, `RestoreFocusOptions`, `FocusCapture`, `FocusResult`, and
`FocusSkippedReason` are exported for typed integrations. The module is safe to
import during SSR, uses no timers, performs no scrolling itself, creates no
focus trap, queries no host DOM, and has no automatic lifecycle behavior.

## Store announcement preferences

`createPreferenceStore(options?)` creates a small external store for validated,
versioned announcement preferences. The default is the frozen v1 value
`{ version: 1, preset: "balanced", streaming: "preset", tools: "preset" }`. The
other granular presets are `"minimal"` and `"verbose"`; streaming can be
`"preset"`, `"off"`, `"completion"`, `"paragraph"`, or `"sentence"`, and tool
verbosity can be `"preset"`, `"off"`, `"failures"`, `"status"`, or `"progress"`.
The separate `"completion-only"` schema has no granular fields. Every accepted
`PreferenceSchemaV1` snapshot is frozen, and validation rejects missing, extra,
invalid, or unsupported-version fields. Runtime input fields must be own,
enumerable data properties; accessor-backed and symbol-keyed input is rejected
without invoking its getters.

```ts
import {
  createPreferenceStore,
  preferencesToCoreConfiguration,
} from "@generative-a11y/dom";

const preferences = createPreferenceStore({
  persistence: { key: "my-app:a11y-preferences" },
});
const unsubscribe = preferences.subscribe(() => {
  console.log(preferences.getSnapshot());
});

preferences.setPreferences({
  version: 1,
  preset: "balanced",
  streaming: "sentence",
  tools: "status",
});
```

`PreferenceStore` implements `ExternalStore<PreferenceSchemaV1>` and adds
`setPreferences(value)` and idempotent `dispose()`. Its server snapshot is the
configured default, while its client snapshot may contain a loaded preference.
This deliberate split supports SSR and hydration without accessing browser
globals during module evaluation. After disposal, snapshots remain readable; new
subscriptions and writes throw.

`normalizePreferences(value)` validates, canonicalizes, and freezes a v1
snapshot. `samePreferences(left, right)` compares canonical preference values.
These helpers are exported for thin integrations such as the React adapter to
reuse the DOM package's schema invariants.

Persistence is opt-in through `PreferencePersistence`. It accepts a `key`, an
optional `PreferenceStorage` (`getItem`/`setItem`), and an optional
`PreferenceStorageEventSource`. When persistence is requested without injected
storage, a safely available browser `localStorage` and native `storage` events
are used. Server and restricted-browser environments remain in-memory. Injected
event sources take precedence; custom storage without an event source has no
cross-tab synchronization. Native storage events synchronize other documents,
but browser storage events do not form a same-tab bus. Invalid, corrupt, and
forward-version values are preserved in storage and reported through the
isolated, serializable `PreferenceDiagnostic` callback.

`PreferenceStoreOptions` contains `defaultValue`, `persistence`, and
`onDiagnostic`. A `PreferenceStorageEvent` carries `key`, `newValue`, and an
optional `storageArea`; a `PreferenceStorageEventSource` supplies a subscribing
callback and cleanup function. `PreferenceDiagnostic` contains a
`PreferenceDiagnosticSource`, a `PreferenceDiagnosticCode`, and an optional
serialized `{ name, message }` error. Sources distinguish storage reads, writes,
external events, event subscription, and event unsubscription. Codes distinguish
operation failures, invalid JSON, invalid preferences, and unsupported versions.

`preferencesToCoreConfiguration(value)` validates a preference and translates it
to `{ preset, policy? }`. Use that result only when the host explicitly
constructs or replaces a core runtime. A preference store never mutates,
recreates, or disposes an active runtime. `"preset"` fields inherit the selected
core preset; granular values override only text strategy or tool-event flags,
leaving timing and progress thresholds inherited. The `"completion-only"`
preference returns that preset without granular policy overrides.
