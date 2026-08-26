import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
  Clock,
  GenerativeA11yEvent,
  GenerativeA11yRuntime,
  ManualClock,
} from "@generative-a11y/core";

export interface RecordedEvent {
  readonly at: number;
  readonly event: GenerativeA11yEvent;
}

export interface ReplayFixtureV1 {
  readonly format: "generative-a11y/replay";
  readonly version: 1;
  readonly startAt: number;
  readonly events: readonly RecordedEvent[];
}

export interface RuntimeRecording {
  readonly runtime: Pick<GenerativeA11yRuntime, "dispatch">;
  events(): readonly RecordedEvent[];
  fixture(): ReplayFixtureV1;
  clear(): void;
}

export interface RecordRuntimeOptions {
  readonly runtime: Pick<GenerativeA11yRuntime, "dispatch">;
  readonly clock: Pick<Clock, "now">;
}

export interface ReplayFixtureOptions {
  readonly startAt?: number;
}

export type AnnouncementExpectation = Partial<AnnouncementIntent>;

export type DiagnosticExpectation = Partial<AnnouncementDiagnostic>;

export interface TranscriptRecorder {
  transcript(): readonly AnnouncementIntent[];
  diagnosticTranscript(): readonly AnnouncementDiagnostic[];
}

const EVENT_TYPES = new Set<GenerativeA11yEvent["type"]>([
  "response.started",
  "response.text.delta",
  "response.completed",
  "response.interrupted",
  "response.failed",
  "response.retrying",
  "tool.started",
  "tool.progress",
  "tool.completed",
  "tool.failed",
  "interaction.requested",
  "interaction.resolved",
  "approval.requested",
  "approval.resolved",
  "connection.lost",
  "connection.restored",
  "citation.available",
]);

function copyEvent(event: GenerativeA11yEvent): GenerativeA11yEvent {
  return Object.freeze({ ...event }) as GenerativeA11yEvent;
}

function copyRecordedEvent(entry: RecordedEvent): RecordedEvent {
  return Object.freeze({ at: entry.at, event: copyEvent(entry.event) });
}

function validateEvent(event: unknown): asserts event is GenerativeA11yEvent {
  if (!event || typeof event !== "object")
    throw new TypeError("Replay fixture event must be an object");
  const candidate = event as {
    type?: unknown;
    responseId?: unknown;
    toolId?: unknown;
  };
  if (
    typeof candidate.type !== "string" ||
    !EVENT_TYPES.has(candidate.type as GenerativeA11yEvent["type"])
  )
    throw new TypeError("Replay fixture event has an unsupported type");
  if (
    candidate.type.startsWith("response.") &&
    typeof candidate.responseId !== "string"
  )
    throw new TypeError("Replay fixture response event requires responseId");
  if (
    candidate.type.startsWith("tool.") &&
    typeof candidate.toolId !== "string"
  )
    throw new TypeError("Replay fixture tool event requires toolId");
}

function validateFixture(fixture: ReplayFixtureV1): void {
  if (fixture.format !== "generative-a11y/replay")
    throw new TypeError("Replay fixture has an unsupported format");
  if (fixture.version !== 1)
    throw new TypeError("Replay fixture has an unsupported version");
  if (!Number.isFinite(fixture.startAt))
    throw new TypeError("Replay fixture startAt must be finite");
  let previousAt = -1;
  for (const entry of fixture.events) {
    if (!Number.isFinite(entry.at) || entry.at < 0)
      throw new TypeError(
        "Replay fixture event at must be finite and non-negative",
      );
    if (entry.at < previousAt)
      throw new TypeError("Replay fixture event times must be non-decreasing");
    validateEvent(entry.event);
    previousAt = entry.at;
  }
}

export function recordRuntime(options: RecordRuntimeOptions): RuntimeRecording {
  const startAt = options.clock.now();
  const recorded: RecordedEvent[] = [];
  return {
    runtime: {
      dispatch(event) {
        const accepted = options.runtime.dispatch(event);
        if (!accepted) return false;
        recorded.push(
          Object.freeze({
            at: options.clock.now() - startAt,
            event: copyEvent(event),
          }),
        );
        return true;
      },
    },
    events: () => Object.freeze(recorded.map(copyRecordedEvent)),
    fixture: () => createReplayFixture(recorded, { startAt }),
    clear() {
      recorded.length = 0;
    },
  };
}

export function createReplayFixture(
  events: readonly RecordedEvent[],
  options: ReplayFixtureOptions = {},
): ReplayFixtureV1 {
  const fixture: ReplayFixtureV1 = Object.freeze({
    format: "generative-a11y/replay",
    version: 1,
    startAt: options.startAt ?? 0,
    events: Object.freeze(events.map(copyRecordedEvent)),
  });
  validateFixture(fixture);
  return fixture;
}

export function replayEvents(
  runtime: Pick<GenerativeA11yRuntime, "dispatch">,
  clock: ManualClock,
  fixture: ReplayFixtureV1,
): void {
  validateFixture(fixture);
  for (const [index, entry] of fixture.events.entries()) {
    clock.advanceTo(fixture.startAt + entry.at);
    if (!runtime.dispatch(copyEvent(entry.event))) {
      throw new Error(`Replay fixture entry ${index} was rejected`);
    }
  }
}

export function matchesPartial(actual: object, expected: object): boolean {
  return Object.entries(expected).every(([key, value]) =>
    Object.is((actual as Record<string, unknown>)[key], value),
  );
}
