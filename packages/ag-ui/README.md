# @generative-a11y/ag-ui

`bindAgent()` observes an `AbstractAgent` only through its documented
`agent.subscribe(AgentSubscriber)` callbacks. It does not subscribe to the
protocol observable, mutate agent state, render UI, or invoke agent actions.

## Install

```sh
npm install @generative-a11y/core @generative-a11y/ag-ui @ag-ui/client
```

## Bind an agent

The host owns both the core `runtime` and AG-UI `agent`; this binding only
translates the agent's public subscription events.

```ts
import { bindAgent } from "@generative-a11y/ag-ui";

const binding = bindAgent({ runtime, scopeId: "support", agent });
// Later: binding.dispose(); // unsubscribes only
```

| Public AG-UI evidence                                         | Normalized event                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------ |
| `RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR`                  | Run start / completion, interruption, or safe failure        |
| `SUBAGENT_STARTED` / finished / error                         | Child run lifecycle with documented parent IDs               |
| `STEP_STARTED` / `STEP_FINISHED`                              | Partial step lifecycle; `stepName` remains a label, not ID   |
| Assistant `TEXT_MESSAGE_START` / content / end                | Response lifecycle attributed to its run when exposed        |
| `RUN_FINISHED` interrupt, then a later `input.resume[]` entry | Requested then resolved interaction, attributed when exposed |
| `TOOL_CALL_START`, then `TOOL_CALL_RESULT`                    | Tool lifecycle attributed to its run; end alone is ignored   |

AG-UI 0.0.59 exposes stable run and subagent-run IDs. Step events expose only
`stepName`, so the adapter deliberately omits `stepId`; names never become
identity and concurrent same-name steps cannot be correlated exactly. Core
records these callbacks as partial-identity diagnostic evidence, but does not
create step snapshots or announcements from them. The protocol's top-level
`parentRunId` describes run lineage and is not treated as delegation hierarchy.
Custom events and arbitrary state deltas are ignored.

The root entry is SSR-safe. In-memory entity tracking suppresses duplicate
callbacks while a binding remains active, but replay and reconnection fidelity
remain partial because AG-UI subscriptions provide no mandatory persistent
cursor. Retry fidelity remains unavailable without host-owned action evidence.
All identities are bounded; capacity exhaustion suppresses later events.

## Documentation

- [AG-UI accessibility guide](https://generativea11y.com/docs/integrations/ag-ui)
- [AG-UI API reference](https://generativea11y.com/api/ag-ui)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  receives the normalized agent events.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides browser delivery for React applications.
