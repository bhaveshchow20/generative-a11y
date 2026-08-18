# `@generative-a11y/test`

Framework-neutral deterministic testing helpers for `@generative-a11y/core`.
This package records normalized events, replays local fixtures through a
`ManualClock`, and provides opt-in semantic Vitest matchers. It does not need a
browser and does not claim that a transcript proves assistive-technology speech.

## Record and replay

```ts
import { ManualClock, createAnnouncementRecorder } from "@generative-a11y/core";
import { recordRuntime, replayEvents } from "@generative-a11y/test";

const recorder = createAnnouncementRecorder();
const recording = recordRuntime({
  runtime: recorder.runtime,
  clock: recorder.clock,
});

recording.runtime.dispatch({ type: "response.started", responseId: "r1" });
const fixture = recording.fixture();

const replayClock = new ManualClock(fixture.startAt);
replayEvents(recorder.runtime, replayClock, fixture);
replayClock.runUntilIdle();
```

`recordRuntime()` records only calls forwarded through its returned dispatch
target. Fixtures use a stable V1 JSON envelope, relative non-negative times, and
array order for simultaneous events. `replayEvents()` does not settle the clock:
call `runUntilIdle()` only when the test intends to assert final output.
Malformed, backward-time, unknown-type, and unsupported-version fixtures throw
before dispatching an event.

## Vitest matchers

```ts
import { installVitestMatchers } from "@generative-a11y/test/vitest";

installVitestMatchers(expect);

expect(recorder).toHaveAnnouncementTranscript([
  { channel: "polite", text: "Response complete." },
]);
expect(recorder).toHaveAnnounced({ sourceType: "response.completed" });
expect(recorder).toHaveDiagnostic({ reason: "scope-cancelled" });
```

The root entry has no Vitest runtime import. The `/vitest` entry is explicit,
matches semantic partial fields, and prints expected/received transcript data on
failure. Jest integration is intentionally deferred until it can be tested as a
supported entry point.
