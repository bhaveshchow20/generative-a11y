# Architecture

## Dependency direction

```text
framework adapter -> react (when needed) -> dom -> core
custom JavaScript ------------------------------> core
test/devtools ----------------------------------> core
```

Dependencies only point toward `core`. Core has no browser, DOM, React or
AI-framework dependency.

## Planned packages

| Package                         | Responsibility                                               | v0.1 publication decision                        |
| ------------------------------- | ------------------------------------------------------------ | ------------------------------------------------ |
| `@generative-a11y/core`         | Events, policies, scheduler, segmentation, runtime, recorder | Publish                                          |
| `@generative-a11y/dom`          | Delivery drivers and optional semantic bindings              | Publish after AT verification                    |
| `@generative-a11y/react`        | Provider, hooks, attention inputs and preferences            | Publish                                          |
| `@generative-a11y/ai-sdk`       | AI SDK state/callback translation                            | Publish with full and reduced-fidelity modes     |
| `@generative-a11y/assistant-ui` | Stable runtime subscription translation                      | Publish                                          |
| `@generative-a11y/ag-ui`        | Protocol subscriber translation                              | Publish                                          |
| CopilotKit integration          | Thin wrapper over AG-UI                                      | Start as a guide; split only if code warrants it |
| `@generative-a11y/test`         | Replay, fixtures and matchers                                | Publish                                          |
| `@generative-a11y/devtools`     | Development-only decision inspector                          | Publish after core reason codes stabilize        |

## Core flow

1. An adapter or custom application dispatches a normalized event.
2. The runtime validates lifecycle state and records per-response epochs and
   buffers.
3. The segmenter extracts completed sentences or paragraphs.
4. Policy maps semantic activity to announcement candidates.
5. The scheduler coalesces, deduplicates, prioritizes, rate-limits and cancels
   candidates.
6. An output driver receives serializable announcement intents.
7. Diagnostic observers receive stable decisions such as queued, merged,
   suppressed, cancelled and announced.

## Adapter fidelity

Adapters declare whether interruption, retries and connectivity are `exact`,
require an `action-wrapper`, are `inferred`, or are `unavailable`. A missing
protocol feature stays missing; it is not guessed from text or private state.

Current research indicates:

- AI SDK needs its documented `onFinish` callback composed at initialization for
  exact abort/disconnect classification. Hook-state-only mode is reduced
  fidelity.
- assistant-ui supports stable `subscribe()`/`getState()` mapping, but not
  reliable retry or connectivity events.
- AG-UI most closely matches the normalized protocol. `TOOL_CALL_END` means
  argument streaming ended, not tool execution completed; completion maps from
  `TOOL_CALL_RESULT`.
- CopilotKit v2 exposes AG-UI through `useAgent()`. Generic tool-based
  human-in-the-loop flows require configuration to distinguish them from
  ordinary client tools.

See the full [framework integration research](framework-integrations.md) for
event mappings and source links.

## Tooling

- pnpm workspaces, without a task orchestrator until build scale warrants one.
- TypeScript 5.9 in strict workspace package mode.
- tsup for ESM/CJS bundles and declarations.
- Vitest for deterministic unit and later browser-adjacent tests.
- ESLint and Prettier for static checks.
- Changesets for independent package versioning and changelogs.
- Node support starts at 22; browser support will be defined only after Phase 2
  compatibility testing.

Releases start at `0.x`. Breaking changes may occur in minor releases before 1.0
and must be documented. Public packages should use explicit exports and avoid
cross-package source imports.
