# `@generative-a11y/core`

Browser-independent event orchestration for `generative-a11y`.

## Install

```sh
npm install @generative-a11y/core
```

## Quick start

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
- `dispatch(event)` returns `true` when a normalized response, tool,
  interaction, connection or citation event is accepted for immediate or nested
  processing. It returns `false` when the runtime is disposed or the current
  dispatch transaction has reached capacity. Dispatch attempts from an
  overflow-diagnostic observer also return `false`; their recursively redundant
  overflow diagnostics are suppressed so reporting always terminates.
- `getPolicy()` returns a deeply frozen policy snapshot.
- `pendingCount()` counts scheduler candidates and response flush timers.
- `subscribeAnnouncements(listener)` adds an isolated output listener and
  returns an idempotent unsubscribe function. This is the attachment point used
  by browser delivery integrations; the optional construction callback is an
  initial listener when supplied.
- `subscribeDiagnostics(listener)` observes subsequent diagnostic decisions and
  returns an idempotent unsubscribe function. Diagnostic listener failures are
  isolated.
- `subscribeDiagnosticEvents(listener)` observes a versioned, ordered stream of
  normalized source events and diagnostic decisions. It is explicitly opt-in;
  listener failures are isolated and it never changes scheduling.
- `getDiagnosticSnapshot()` returns an immutable, serializable snapshot of the
  active response/tool lifecycle plus pending announcement and flush timing. It
  intentionally excludes buffered response text, labels, errors, scopes,
  deduplication keys, and timer handles. Each pending announcement includes its
  stable ID, channel, source type, correlation IDs when present, scheduling
  time, due time, delay and queue sequence. Entries are ordered by due time and
  then queue sequence. The returned array and every entry are frozen.
- `dispose()` is idempotent, cancels owned timers/queues and makes later
  subscription attempts throw; later dispatches return `false`.

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
coalescing, explicit dedupe keys, and an optional `capacityPriority` of
`"status"` or `"content"` for capacity retention. Candidates without a capacity
priority retain the legacy content tier. `cancelScope(scope)` cancels queued
candidates, `pendingCount()` reports queue length, and `dispose()` permanently
clears it. The scheduler validates bounds, preserves assertive work under
capacity pressure, isolates callback failures and defaults deduplication to the
candidate's semantic entity.

`getDiagnosticSnapshot()` returns the scheduler's current pending work without
announcement text, deduplication keys, scopes, or timer handles. Each entry
contains stable delivery and correlation metadata plus scheduling, due-time,
delay, and queue-sequence values. Entries are ordered by due time and then queue
sequence. The returned array and each entry are frozen so diagnostic consumers
cannot mutate scheduler state.

Most applications should use the runtime rather than schedule announcement text
directly.

## Clocks and deterministic testing

`systemClock` is the production clock. `ManualClock` supplies deterministic
`advanceBy`, `advanceTo`, `runNext`, `runUntilIdle` and `pendingCount` methods;
equal-time callbacks retain insertion order. `runUntilIdle(maxTasks)` throws
before exceeding its safety limit.

`createAnnouncementRecorder()` returns a runtime wired to a `ManualClock`.
`transcript()` contains delivered intents; `diagnosticTranscript()` also exposes
stable dispositions and reason codes. A capacity diagnostic may include a
serializable `count` when it represents multiple suppressed decisions, including
dropped nested runtime events. These records prove runtime policy behavior, not
actual assistive-technology speech.

For development tooling, `RuntimeDiagnosticEventV1` has an explicit schema
version and monotonically increasing sequence. A source event is emitted before
the decisions caused by its dispatch. `RuntimeDiagnosticSnapshotV1` exposes only
safe lifecycle and queue timing metadata; core retains no diagnostic history.
Capture tools should bound their own history and redact conversation content by
default.

### Record and replay

The optional `@generative-a11y/core/testing` entry records accepted normalized
events, creates versioned replay fixtures, replays them with a `ManualClock`,
and installs semantic Vitest matchers. It is intended for test code and does not
add anything to the main core entry.

```ts
import { expect } from "vitest";
import { createAnnouncementRecorder } from "@generative-a11y/core";
import {
  installVitestMatchers,
  recordRuntime,
  replayEvents,
} from "@generative-a11y/core/testing";

const accessibilityExpect = installVitestMatchers(expect);

const recorder = createAnnouncementRecorder();
const recording = recordRuntime({
  runtime: recorder.runtime,
  clock: recorder.clock,
});

recording.runtime.dispatch({
  type: "response.started",
  responseId: "r1",
});
recording.runtime.dispatch({
  type: "response.interrupted",
  responseId: "r1",
});

const fixture = recording.fixture();
const replay = createAnnouncementRecorder({ startAt: fixture.startAt });
replayEvents(replay.runtime, replay.clock, fixture);
replay.clock.runUntilIdle();

accessibilityExpect(replay).toHaveAnnounced({
  sourceType: "response.interrupted",
});
```

Fixtures use a stable V1 JSON envelope, non-negative relative timestamps, and
array order for simultaneous events. Replay validates the complete fixture
before dispatch and does not run the clock until idle. Transcript assertions
confirm deterministic runtime behavior, not browser delivery or spoken output.

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

## Documentation

- [Core API reference](https://generativea11y.com/api/core)
- [Getting started](https://generativea11y.com/docs/getting-started)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/dom`](https://www.npmjs.com/package/@generative-a11y/dom)
  delivers announcement intents in the browser.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides React context, hooks, and DOM bindings.
