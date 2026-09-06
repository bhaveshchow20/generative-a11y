# `@generative-a11y/core`

Browser-independent event orchestration for `generative-a11y`.

## Install

```sh
npm install @generative-a11y/core
```

## Quick start

```ts
import { createRuntime } from "@generative-a11y/core";

const runtime = createRuntime({
  onAnnouncement(announcement) {
    console.log(announcement); // Attach browser delivery in your application.
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

### Hierarchical workflows

Core models `run.*` and `step.*` lifecycle directly rather than collapsing agent
work into responses or tools. Stable logical IDs can be paired with explicit
instance IDs for retries, parent run/step IDs for nesting, and optional run/step
context on responses, tools and interactions.

```ts
runtime.dispatch({
  type: "run.started",
  runId: "research",
  runInstanceId: "1",
});
runtime.dispatch({
  type: "step.started",
  runId: "research",
  runInstanceId: "1",
  stepId: "sources",
  stepInstanceId: "sources-1",
  label: "Collect sources",
});
runtime.dispatch({
  type: "step.completed",
  runId: "research",
  runInstanceId: "1",
  stepId: "sources",
  stepInstanceId: "sources-1",
  label: "Collect sources",
});
runtime.dispatch({
  type: "run.completed",
  runId: "research",
  runInstanceId: "1",
});
```

The balanced policy announces terminal run summaries and only identified,
long-running top-level steps. Nested steps and progress are quiet by default. A
generic empty run completion is silent when its completed response boundary was
already announced. A step event without `stepId` produces only an ephemeral
partial-identity diagnostic: it cannot create a step snapshot, announcement, or
run count. The runtime never uses display labels as identity. A failed child
preserves sibling work, while retry replacement cancels only the replaced
attempt and its descendants. Known active children block a successful parent
completion.

## Runtime contract

`createRuntime(options)` accepts a preset, nested policy overrides, an optional
injected `Clock`, and optional delivery callbacks:

- `onAnnouncement(intent)` optionally installs an initial listener for prepared
  polite/assertive intents. If it throws, scheduling continues and
  `onDeliveryError(error, intent)` is called. A runtime intended for
  `subscribeAnnouncements()` or `bindRuntime()` does not need a no-op
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
  active response/tool/run/step lifecycle plus pending announcement and flush
  timing. It intentionally excludes buffered response text, labels, errors,
  scopes, deduplication keys, and timer handles. Each pending announcement
  includes its stable ID, channel, source type, correlation IDs when present,
  scheduling time, due time, delay and queue sequence. Entries are ordered by
  due time and then queue sequence. The returned array and every entry are
  frozen.
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

`policy.workflows` controls run boundary verbosity, step verbosity, the
long-running step threshold, explicit progress, and nested-step announcements.
No policy setting manufactures hierarchy that a source cannot identify.

## Scheduler

`createScheduler(options)` is the lower-level prioritized queue used by the
runtime. `schedule(candidate)` supports delay, scope cancellation, coalescing,
explicit dedupe keys, and an optional `capacityPriority` of `"status"` or
`"content"` for capacity retention. Candidates without a capacity priority
retain the legacy content tier. `cancelScope(scope)` cancels queued candidates,
`pendingCount()` reports queue length, and `dispose()` permanently clears it.
The scheduler validates bounds, preserves assertive work under capacity
pressure, isolates callback failures and defaults deduplication to the
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

`createRecorder()` returns a runtime wired to a `ManualClock`. `transcript()`
contains delivered intents; `diagnosticTranscript()` also exposes stable
dispositions and reason codes. A capacity diagnostic may include a serializable
`count` when it represents multiple suppressed decisions, including dropped
nested runtime events. These records prove runtime policy behavior, not actual
assistive-technology speech.

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
import { createRecorder } from "@generative-a11y/core";
import {
  installVitestMatchers,
  recordRuntime,
  replayEvents,
} from "@generative-a11y/core/testing";

const accessibilityExpect = installVitestMatchers(expect);

const recorder = createRecorder();
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
const replay = createRecorder({ startAt: fixture.startAt });
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
Run and step fixtures use the same event union and preserve explicit parent and
attempt identity without inferring missing relationships.

## Segmentation

`segmentText(text, "sentence" | "paragraph", locale?)` returns completed units
and an unfinished remainder. It uses `Intl.Segmenter` when available, falls back
safely, and tolerates malformed locales. `normalizeAnnouncementText()` collapses
whitespace only at the delivery boundary.

## Types

The package exports the normalized `RuntimeEvent` union, announcement and
diagnostic records, policy types, adapter fidelity metadata, scheduler types,
and clock types. Events are serializable where practical; callbacks and clock
handles are intentionally runtime-only.

## Attention-aware announcements

Attention control is opt-in and keeps the current runtime and lifecycle state.
It changes announcement decisions, not generation, focus, or the host UI.

```ts
const runtime = createRuntime({
  preset: "balanced",
  policy: {
    attention: {
      enabled: true,
      quietWhen: ["background", "reading-history"],
    },
  },
});

runtime.dispatch({ type: "attention.changed", mode: "background" });
runtime.dispatch({ type: "attention.override", mode: "normal" });
// Return to observed evidence without replacing the runtime:
runtime.dispatch({ type: "attention.override", mode: "auto" });
runtime.dispose();
```

`AttentionPolicy` is optional in caller-authored policies. Resolved defaults are
`enabled: false` and `quietWhen: ["background"]`. The trigger list accepts
`background`, `reading-history`, and `away`; it is copied and frozen. Unknown or
foreground evidence always uses normal policy under automatic control.

`AttentionMode` adds `foreground` and `unknown` to those observation values.
`AttentionOverride` is `auto`, `normal`, or `quiet`; explicit normal/quiet
overrides win over later observations. Control events are runtime-wide: entity
IDs and attempt IDs are invalid. Disabled control events leave state unchanged
and produce `policy-silent` diagnostics. Browser evidence is supplied by
`@generative-a11y/dom` or the host; core never reads the browser.

Quiet mode drops response text and routine response/tool/run/step start and
progress announcements, including queued candidates and owned text flush timers.
Base-policy-enabled completion, interruption, failure, interaction, connection,
citation, and retry notices retain their channels. It never enables a notice
that the base preset disables and is **not a global mute switch**.

Suppressed text is not replayed when normal mode resumes. A bounded trailing
suffix (at most 256 UTF-16 code units) is retained only to discard a sentence or
paragraph crossing the quiet interval. A maximum-delay or terminal flush never
announces that orphaned suffix. Completion-strategy responses that lost text
during quiet mode do not later replay their full text for that attempt; retry
starts a fresh attempt. In `minimal` and `completion-only`, the completion
notice is disabled too, so such a response may produce no announcement. The
host's accessible conversation remains the place to review its content.

`getDiagnosticSnapshot().attention` is an optional cached, frozen
`AttentionState` with `observed`, `override`, and `effective` (`normal` or
`quiet`). It is present when enabled. `attention-updated` records an accepted
state change without announcing the control; `attention-quiet` explains dropped
output. Repeated identical controls preserve state identity. Observations do not
establish what a person or a screen-reader virtual cursor is reading.

Both controls work with `recordRuntime`, `createReplayFixture`, and
`replayEvents`. Existing V1 fixtures remain valid; older core readers reject the
new event types. Attention fixtures require core **0.4.0 or newer**; 0.3.x
readers cannot read them. Replay advances the clock **before** dispatching each
entry, including equal-timestamp entries: a timer already due can deliver first.
Record with the same clock ordering when comparing transcripts. The fixture
records inputs, not policy; replay with matching policy for matching decisions.

For direct scheduler users, `ScheduleAnnouncement.purpose` accepts
`AnnouncementPurpose`: `response-text`, `routine-status`, or `notice` (default).
`cancelPurposes(purposes, reason?)` cancels only queued candidates with matching
purpose; its default reason is `scope-cancelled`. Runtime attention transitions
use `attention-quiet`. Purpose is distinct from priority and source type: one
`response.completed` event may produce both full text and a short notice. These
APIs cannot retract output already delivered to assistive technology.

## Documentation

- [Core API reference](https://generativea11y.com/api/core)
- [Getting started](https://generativea11y.com/docs/getting-started)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/dom`](https://www.npmjs.com/package/@generative-a11y/dom)
  delivers announcement intents in the browser.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides React context, hooks, and DOM bindings.

## Localized announcements

Pass `messages` to `createRuntime` (or the recorder) to format library-generated
notices using your existing i18n framework. Core provides timing, accessibility
policy and language attribution; it does not provide translation services, ICU
parsing or language detection.

`Messages` contains a non-sensitive `id`, an explicit BCP 47 `locale`, and a
complete `MessageMap` map. Each value is a fixed string or a pure synchronous
callback receiving the frozen, typed parameters from `MessageParams`.
`MessageKey` is the union of its 25 keys. The exported `en` preserves existing
English wording. English customization may spread its messages; a translated
catalog must translate every entry rather than silently reuse English defaults.

```ts
import { createRuntime } from "@generative-a11y/core";
import { en, type Messages } from "@generative-a11y/core/messages";

const customEnglish: Messages = {
  ...en,
  id: "my-app.en.v1",
  messages: {
    ...en.messages,
    "response.completed": "Your answer is ready.",
    "citation.available": ({ count }) =>
      `${count} ${count === 1 ? "reference" : "references"} available.`,
  },
};
const runtime = createRuntime({ messages: customEnglish });
```

For a complete translated catalog, call the host's translation function inside
these callbacks. The host owns grammar, pluralization and translation quality;
no i18n dependency is required. Catalog replacement requires a new runtime.

| Keys                                                                                | Callback parameters                 |
| ----------------------------------------------------------------------------------- | ----------------------------------- |
| `response.started`, `response.completed`, `response.interrupted`, `response.failed` | None                                |
| `response.retrying`, `run.retrying`                                                 | Optional `attempt`                  |
| `tool.started`, `tool.completed`, `tool.failed`                                     | `label`                             |
| `tool.progress`, `step.progress`                                                    | `label`, optional integer `percent` |
| `run.started`                                                                       | Optional `label`                    |
| `run.completed`                                                                     | `completedSteps`, `failedSteps`     |
| `run.interrupted`, `run.failed`                                                     | None                                |
| `step.started`, `step.completed`, `step.interrupted`, `step.failed`                 | `label`                             |
| `step.retrying`                                                                     | `label`, optional `attempt`         |
| `interaction.resolved`                                                              | `kind`, `outcome`                   |
| `approval.resolved`                                                                 | `outcome`                           |
| `connection.lost`, `connection.restored`                                            | None                                |
| `citation.available`                                                                | `count`                             |

Generated notices use the catalog language, independently of response text. The
default catalog now explicitly tags generated English notices `en`, even when an
event/response carries another locale. Explicit host `announcement`, `summary`,
`message` or interaction labels retain existing precedence and host language
metadata. Labels interpolated into a whole generated sentence should be in the
catalog language; one intent cannot represent mixed-language spans. Response
text with changing language is delivered in separate chunks. In completion mode
those chunks wait until completion, with prior-language chunks bounded by
`maxQueueSize` (oldest overflow chunks are discarded with a `queue-capacity`
diagnostic).

Construction validates and copies/freezes the complete message map before
allocating runtime resources. IDs and language tags are limited to 128 UTF-16
code units; fixed and formatted messages to 4,096. Callbacks run only after
policy and attention eligibility checks. A callback throwing, returning a
Promise/non-string, empty text or overlong text produces the content-free
`catalog-format-error` diagnostic and the generic English fallback “Status
updated.” tagged `en`. Fallback never interpolates labels or backend errors.
Callbacks cannot change channels, timing, focus, or lifecycle behavior. Trusted
host callbacks must be synchronous and side-effect-free; core cannot bound their
execution cost or allocations.

`RuntimeDiagnosticSnapshotV1.messages` exposes only `{ catalogId, locale }`, not
catalog strings, callback arguments or errors. Replay V1 events remain
unchanged; exact reproduction requires the same catalog implementation/version,
adapter copy, policy and relevant Intl environment. Callbacks are not
serialized. Recordings may contain host content and are not content-free.
Automated transcripts and DOM tests do not establish real assistive-technology
speech behavior.

`AdapterCopy` is the shared serializable copy contract for existing adapter
bindings: `locale`, `toolLabel`, `approvalRequested`, `approvalResolved`
(`approved`, `rejected`, `cancelled`), `inputRequested`, and `inputResolved`
(`submitted`, `cancelled`). `normalizeAdapterCopy(copy)` validates all fields
with the same language/string limits, canonicalizes the language tag, and
returns a copied, frozen object including nested outcome records. Adapters apply
this copy only to events they already expose reliably; it does not add lifecycle
fidelity or tag generated response text.

`Recorder.clear()` clears recorded announcements and diagnostics only. It does
not reset the runtime, entity history, queued work, or clock time. Create a new
recorder for an independent test session and dispose the previous runtime.
