# Normalized events

Events describe semantics, not UI mutations. They are discriminated,
serializable TypeScript objects. `eventId` and `locale` are optional common
metadata; entity identifiers are required where correlation matters. Response
events may carry a `responseInstanceId` so late transport events from a replaced
attempt can be rejected even when the logical response ID is reused.

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
