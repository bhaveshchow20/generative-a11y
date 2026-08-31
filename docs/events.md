# Normalized events

Events describe semantics, not UI mutations. They are discriminated,
serializable TypeScript objects. `eventId` and `locale` are optional common
metadata; entity identifiers are required where correlation matters. Response
events may carry a `responseInstanceId` so late transport events from a replaced
attempt can be rejected even when the logical response ID is reused.

## Run and step hierarchy

| Event                               | Meaning                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `run.started`                       | Starts one stable run identity and optional attempt, with explicit parent lineage.   |
| `run.completed/interrupted/failed`  | Terminates only the addressed run attempt.                                           |
| `run.retrying`                      | Replaces one run attempt and cancels its queued descendants.                         |
| `step.started/progress`             | Starts or updates an identified step within a run.                                   |
| `step.completed/interrupted/failed` | Terminates only the addressed step; a child failure does not terminate sibling work. |
| `step.retrying`                     | Replaces one step attempt so late output from the earlier attempt can be rejected.   |

Run IDs and step IDs are stable logical identities. Optional `runInstanceId` and
`stepInstanceId` values identify attempts. `parentRunId` and `parentStepId`
express hierarchy; optional parent instance IDs disambiguate attempts. Existing
response, tool and interaction events can carry the same run/step context so
cancellation and diagnostics stay scoped.

`stepId` is intentionally optional on normalized step events. A source that
exposes a step boundary and label but no stable ID may preserve that partial
evidence. The runtime diagnoses it as `partial-identity`, does not retain it as
an entity, and does not use its label for correlation, cancellation, retry or
child attribution.

## Response lifecycle

| Event                  | Meaning                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `response.started`     | A new response epoch began. Reusing an ID replaces and cancels the previous epoch. |
| `response.text.delta`  | New text for one active response; deltas are append-only within an epoch.          |
| `response.completed`   | Successful terminal state; flushes the final incomplete text fragment.             |
| `response.interrupted` | User/system stop; cancels unannounced buffered text.                               |
| `response.failed`      | Terminal failure. `error` is diagnostic-only; `announcement` is safe spoken copy.  |
| `response.retrying`    | Explicit retry evidence; may rotate to `nextResponseInstanceId`.                   |

## Tools, interactions and system state

| Event                            | Meaning                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `tool.started`                   | Execution started; optional `toolInstanceId` guards reuse. Argument streaming is insufficient. |
| `tool.progress`                  | Explicit normalized progress from 0 to 1, not inferred argument deltas.                        |
| `tool.completed`                 | Execution completed successfully.                                                              |
| `tool.failed`                    | Execution failed with explicit evidence.                                                       |
| `interaction.requested/resolved` | General approval, confirmation or input-required lifecycle.                                    |
| `approval.requested/resolved`    | Compatibility-specialized approval lifecycle.                                                  |
| `connection.lost/restored`       | Connectivity state only when the adapter has protocol evidence.                                |
| `citation.available`             | Newly available, deduplicated source count.                                                    |

## Lifecycle rules

- An event for an unknown, terminal or stale response/tool is suppressed.
  Bounded terminal tombstones preserve replacement cancellation and diagnostics.
- Starting the same response ID increments its epoch and cancels its earlier
  queued work.
- Interrupt, failure and retry cancel unannounced response text. Completion
  flushes it.
- Multiple responses and tools may be active concurrently; scheduling and
  deduplication scopes are isolated by identifiers.
- Multiple runs and sibling steps may be active concurrently. A failed step
  preserves siblings. Successful parent completion is rejected while known
  identified children remain active.
- Retry events replace only their declared attempt. Events that still carry the
  earlier instance ID are suppressed as stale.
- Fast tools may complete before their delayed start announcement. In that case,
  the start is cancelled and completion is announced once.
- Approvals are a subset of interactions. Adapters should prefer the general
  interaction events for input-required protocols and use approval events only
  when approval semantics are known.
- Backend `error` fields are never spoken. Adapters provide `announcement` only
  when they have short, localized and user-safe copy.
- Adapters must emit terminal response/tool events. The runtime also enforces a
  configurable `maxActiveEntities` ceiling so malformed streams cannot grow
  tracked active state indefinitely.

Ordering follows dispatch order and replay fixture order. Core does not infer
ordering, parentage or lifecycle from display text, array positions, render
counts or timing. Integrations must omit unavailable fields and declare reduced
fidelity.

## Adapter capability metadata

```ts
interface AdapterFidelity {
  interruption: "exact" | "action-wrapper" | "unavailable";
  retries: "exact" | "action-wrapper" | "unavailable";
  connection: "exact" | "inferred" | "unavailable";
}
```

Optional capabilities such as tool progress, tool failure and citations must be
listed separately. Runtime consumers can expose reduced-fidelity warnings in
development without changing production behavior.
