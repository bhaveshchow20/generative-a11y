# @generative-a11y/assistant-ui

`bindThreadRuntime()` observes only the documented public `ThreadRuntime`
`getState()` and `subscribe()` methods from `@assistant-ui/core@0.3.x`. It
silently baselines existing history and translates later assistant text and
documented terminal statuses, tool result state, approvals, and sources into a
borrowed generative-a11y runtime. It does not render UI, access the DOM, or call
host runtime actions.

## Install

```sh
npm install @generative-a11y/core @generative-a11y/assistant-ui @assistant-ui/core
```

## Bind a thread runtime

The host owns both the core `runtime` and assistant-ui `thread`; this binding
only translates documented public thread state.

```ts
import { bindThreadRuntime } from "@generative-a11y/assistant-ui";

const binding = bindThreadRuntime({ runtime, scopeId: "support", thread });
// Later: binding.dispose(); // unsubscribes only
```

| Public evidence                                                   | Normalized event                                                |
| ----------------------------------------------------------------- | --------------------------------------------------------------- |
| New assistant message or append-only text part                    | `response.started` / `response.text.delta`                      |
| `status: complete`, `incomplete: cancelled`, `incomplete: error`  | `response.completed`, `response.interrupted`, `response.failed` |
| New `tool-call`, then a present `result`                          | `tool.started`, then `tool.completed` or `tool.failed`          |
| Observed unresolved `tool-call.approval`, then a boolean decision | `approval.requested`, then `approval.resolved`                  |
| New `source` ID                                                   | `citation.available` with the tracked count                     |

Text is emitted only for append-only changes. A rewrite, an unknown incomplete
reason, or an observer that reaches its bounded identity capacity fails closed;
it never invents a stop, error, retry, or connection event.

The documented thread snapshot does not expose stable run, step, or hierarchy
lifecycle evidence. Those fidelity fields remain `unavailable`; the adapter
continues to report only the response, tool, and citation evidence it observes.

Tool labels are intentionally generic (`"A tool"`), and backend tool results and
errors are never copied into announcements. An approval is resolved only after
this binding observed that approval requested. Source IDs are counted but never
spoken.

## Documentation

- [assistant-ui accessibility guide](https://generativea11y.com/docs/integrations/assistant-ui)
- [assistant-ui API reference](https://generativea11y.com/api/assistant-ui)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  receives the normalized lifecycle events.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides browser delivery for React applications.
