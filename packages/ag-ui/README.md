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

| Public AG-UI evidence                                         | Normalized event                                          |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| Assistant `TEXT_MESSAGE_START` / content / end                | Response start / delta / completion                       |
| `RUN_ERROR`                                                   | Failure of observed active responses, without error text  |
| `RUN_FINISHED` interrupt, then a later `input.resume[]` entry | Interrupted response, requested then resolved interaction |
| `TOOL_CALL_START`, then `TOOL_CALL_RESULT`                    | Tool start, then completion; `TOOL_CALL_END` is ignored   |

The root entry is SSR-safe. Replay/reconnection and retry fidelity are
unavailable without a mandatory protocol cursor or host-owned action evidence.
All identities are bounded; capacity exhaustion suppresses later events rather
than replaying untracked protocol history as new output.

## Documentation

- [AG-UI accessibility guide](https://generativea11y.com/docs/integrations/ag-ui)
- [AG-UI API reference](https://generativea11y.com/api/ag-ui)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  receives the normalized agent events.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides browser delivery for React applications.
