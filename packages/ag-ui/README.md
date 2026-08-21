# @generative-a11y/ag-ui

`bindAgent()` observes an `AbstractAgent` only through its documented
`agent.subscribe(AgentSubscriber)` callbacks. It does not subscribe to the
protocol observable, mutate agent state, render UI, or invoke agent actions.

## Install

```sh
pnpm add @generative-a11y/core @generative-a11y/ag-ui @ag-ui/client
```

## Bind an agent

```ts
import { bindAgent } from "@generative-a11y/ag-ui";
import { createGenerativeA11y } from "@generative-a11y/core";

const runtime = createGenerativeA11y({
  onAnnouncement: (announcement) => delivery.announce(announcement),
});
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
