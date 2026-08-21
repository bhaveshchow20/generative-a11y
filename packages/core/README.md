# `@generative-a11y/core`

Browser-independent event orchestration for `generative-a11y`.

```ts
import { createGenerativeA11y } from "@generative-a11y/core";

const runtime = createGenerativeA11y({
  onAnnouncement(announcement) {
    deliveryDriver.announce(announcement);
  },
});

runtime.dispatch({ type: "response.started", responseId: "r1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "r1",
  delta: "A complete sentence.",
});
runtime.dispatch({ type: "response.completed", responseId: "r1" });
```

Core emits announcement intents; it does not touch the DOM or claim that
assistive technology spoke them. Applications normally consume this package
through a framework adapter and DOM driver.

`runtime.pendingCount()` includes queued announcement candidates and owned
response flush timers. Backend `error` fields are diagnostic-only; use an
event's `announcement` field for short, localized, user-safe spoken error copy.

## Runtime contract

`createGenerativeA11y(options)` accepts a preset, nested policy overrides, an
optional injected `Clock`, and optional delivery callbacks:

- `onAnnouncement(intent)` optionally installs an initial listener for prepared
  polite/assertive intents. If it throws, scheduling continues and
  `onDeliveryError(error, intent)` is called. A runtime intended for
  `subscribeAnnouncements()` or `connectRuntimeToDOM()` does not need a no-op
  construction listener. An announcement emitted while no listener is attached
  receives a `delivery-error` diagnostic.
- `onDiagnostic(decision)` observes best-effort queued, merged, suppressed,
  cancelled and announced decisions. Observer errors are isolated.
- `dispatch(event)` accepts normalized response, tool, interaction, connection
  and citation events.
- `getPolicy()` returns a deeply frozen policy snapshot.
- `pendingCount()` counts scheduler candidates and response flush timers.
- `subscribeAnnouncements(listener)` adds an isolated output listener and
  returns an idempotent unsubscribe function. This is the attachment point used
  by browser delivery integrations; the optional construction callback is an
  initial listener when supplied.
- `subscribeDiagnostics(listener)` observes subsequent diagnostic decisions and
  returns an idempotent unsubscribe function. Diagnostic listener failures are
  isolated.
- `dispose()` is idempotent, cancels owned timers/queues and makes later
  dispatch or subscription attempts throw.

Announcement listeners run from a stable snapshot. A throwing listener does not
prevent later listeners from receiving the same intent, and every listener
failure is reported through `onDeliveryError`. A delivery is diagnosed as failed
only when every current announcement listener throws.

Responses and tools should always receive a terminal event. `maxActiveEntities`
also prevents missing terminal events from growing active state without bound.
`responseInstanceId`/`nextResponseInstanceId` and `toolInstanceId` reject late
events when a logical ID is reused. Progress is normalized from 0 to 1; invalid
values are suppressed diagnostically.

## Policies and presets

`presets` contains deeply frozen `minimal`, `balanced`, `verbose` and
`completion-only` policies. `resolvePolicy(preset, overrides)` validates and
freezes a customized snapshot. Timing values must be finite and non-negative;
queue/entity ceilings must be positive integers.

## Scheduler

`createAnnouncementScheduler(options)` is the lower-level prioritized queue used
by the runtime. `schedule(candidate)` supports delay, scope cancellation,
coalescing, explicit dedupe keys, and an optional `priority` of `"status"` or
`"content"` for capacity retention. Candidates without a priority retain the
legacy content tier. `cancelScope(scope)` cancels queued candidates,
`pendingCount()` reports queue length, and `dispose()` permanently clears it.
The scheduler validates bounds, preserves assertive work under capacity
pressure, isolates callback failures and defaults deduplication to the
candidate's semantic entity.

Most applications should use the runtime rather than schedule announcement text
directly.

## Clocks and deterministic testing

`systemClock` is the production clock. `ManualClock` supplies deterministic
`advanceBy`, `advanceTo`, `runNext`, `runUntilIdle` and `pendingCount` methods;
equal-time callbacks retain insertion order. `runUntilIdle(maxTasks)` throws
before exceeding its safety limit.

`createAnnouncementRecorder()` returns a runtime wired to a `ManualClock`.
`transcript()` contains delivered intents; `diagnosticTranscript()` also exposes
stable dispositions and reason codes. These records prove runtime policy
behavior, not actual assistive-technology speech.

## Segmentation

`segmentText(text, "sentence" | "paragraph", locale?)` returns completed units
and an unfinished remainder. It uses `Intl.Segmenter` when available, falls back
safely, and tolerates malformed locales. `normalizeAnnouncementText()` collapses
whitespace only at the delivery boundary.

## Types

The package exports the normalized `GenerativeA11yEvent` union, announcement and
diagnostic records, policy types, adapter fidelity metadata, scheduler types,
and clock types. Events are serializable where practical; callbacks and clock
handles are intentionally runtime-only.
