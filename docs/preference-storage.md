# Preference storage

`createPreferenceStore()` provides a versioned, frozen preference snapshot and
optional persistence. Persistence is opt-in; a store without a `persistence`
option is memory-only.

## Version 1 schema

Version 1 accepts exactly one of these shapes:

```ts
type PreferenceSchemaV1 =
  | { version: 1; preset: "completion-only" }
  | {
      version: 1;
      preset: "minimal" | "balanced" | "verbose";
      streaming: "preset" | "off" | "completion" | "paragraph" | "sentence";
      tools: "preset" | "off" | "failures" | "status" | "progress";
    };
```

The default is:

```json
{ "version": 1, "preset": "balanced", "streaming": "preset", "tools": "preset" }
```

Validation rejects arrays, non-objects, missing or extra fields, accessors,
symbol-keyed fields, invalid enum values, and unsupported versions. Accepted
snapshots are normalized and frozen. A semantically unchanged set preserves the
snapshot identity and performs no notification or write.

## Core configuration mapping

`preferencesToCoreConfiguration()` validates a snapshot and returns
`{ preset, policy? }`.

| Streaming value | Core text override                                                    |
| --------------- | --------------------------------------------------------------------- |
| `preset`        | none; inherit the selected preset                                     |
| `off`           | `strategy: "silent"`                                                  |
| `completion`    | `strategy: "completion"`, `minimumCharacters: 0`, `maximumDelayMs: 0` |
| `paragraph`     | `strategy: "paragraph"`                                               |
| `sentence`      | `strategy: "sentence"`                                                |

| Tool value | Start   | Progress | Completion | Failure |
| ---------- | ------- | -------- | ---------- | ------- |
| `preset`   | inherit | inherit  | inherit    | inherit |
| `off`      | false   | false    | false      | false   |
| `failures` | false   | false    | false      | true    |
| `status`   | true    | false    | true       | true    |
| `progress` | true    | true     | true       | true    |

Timing and progress thresholds continue to come from the selected core preset.
`completion-only` returns `{ preset: "completion-only" }` with no granular
policy overrides.

## Persistence selection

`PreferencePersistence` requires a key and may inject:

- `PreferenceStorage`, with `getItem()` and `setItem()`;
- `PreferenceStorageEventSource`, with `subscribe()` and an unsubscribe result.

Injected storage is used as-is. Injected events take precedence. Custom storage
without an event source has no implicit synchronization.

When persistence is requested without injected storage, the constructor safely
tries the browser's `localStorage`. If available, it also subscribes to native
`storage` events. Browser globals are never read at module evaluation. An SSR,
restricted-storage, or otherwise unavailable environment remains memory-only
without throwing.

Native storage events are sent to other same-origin browsing contexts and not to
the window that performed the write. The store therefore supports native
cross-tab synchronization but intentionally provides no process-global or
same-tab event bus. Applications that need same-tab synchronization can inject
one explicit event source shared by their stores. See the platform
[`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event).

## Loading, writes, and external changes

On construction, valid v1 JSON becomes the current client snapshot. A missing
value uses the configured default. Read failures, invalid JSON, invalid schemas,
and unsupported versions also fall back to the default and emit an isolated,
serializable diagnostic. The store never deletes or overwrites corrupt or
forward-version data during recovery.

A local `setPreferences()` call validates and updates synchronously, then
notifies a stable subscriber snapshot once, then writes canonical JSON. A write
failure is diagnosed and does not roll back the in-memory snapshot. If a
subscriber performs a newer nested set, only the newest transition is persisted;
if it disposes the store, no write follows.

An external event is accepted only for the configured key and storage area. A
matching valid value replaces the snapshot without writing it back. An echo of
the current semantic value is a no-op. `newValue: null` or a clear event with
`key: null` resets to the configured default. Invalid external data preserves
the current snapshot and emits a diagnostic. Event epochs ensure a nested newer
event or disposal wins over a reentrant outer event.

## SSR and hydration

`getServerSnapshot()` always returns the exact configured default used by the
store. `getSnapshot()` may contain a synchronously loaded browser preference.
This is the intended external-store contract: a future React binding supplies
the server snapshot during server rendering and hydration, then observes the
client snapshot. Hosts should not read storage independently during render.

## Runtime boundary

Preferences do not mutate, recreate, or dispose an active core runtime.
`preferencesToCoreConfiguration()` is for explicit host construction or
replacement of a runtime. The host owns that replacement boundary and any
handoff of active application state.

## Diagnostics and disposal

Diagnostics identify storage reads, writes, external events, event subscription,
or event unsubscription, with codes for operation failure, invalid JSON, invalid
preferences, or unsupported versions. Error data is reduced to serializable
`name` and `message` strings; hostile thrown values fall back to fixed safe
text. Diagnostic callback failures are isolated.

`dispose()` is idempotent. It clears subscribers, removes the event
subscription, and invalidates stale callbacks. Snapshots remain readable; later
subscription or `setPreferences()` calls throw. Previously returned unsubscribe
functions remain safe to call.
