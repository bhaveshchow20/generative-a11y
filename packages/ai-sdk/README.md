# @generative-a11y/ai-sdk

Thin accessibility lifecycle translation for `ai@7.0.x` and
`@ai-sdk/react@4.0.x`. It observes host-owned public state and dispatches to a
borrowed `@generative-a11y/core` runtime; it does not render UI, read the DOM,
own a chat, invoke `regenerate()`, or inspect private chat state.

The root entry is SSR-safe. The React integration is available only from
`@generative-a11y/ai-sdk/react`.

## React quick start

Create the accessibility integration before `useChat()` so its composed
callbacks are present when AI SDK creates the chat. Then observe the documented
public snapshot returned from `useChat()`.

```tsx
import { useChat } from "@ai-sdk/react";
import {
  useChatAccessibility,
  useObserveChatAccessibility,
} from "@generative-a11y/ai-sdk/react";

function Chat({
  runtime,
}: {
  runtime: Pick<GenerativeA11yRuntime, "dispatch">;
}) {
  const accessibility = useChatAccessibility({
    runtime,
    scopeId: "support-thread",
    onFinish: hostOnFinish,
    onError: hostOnError,
  });
  const chat = useChat({
    id: "support-thread",
    ...accessibility.chatCallbacks,
  });
  useObserveChatAccessibility({ integration: accessibility, snapshot: chat });

  // Render the existing host interface unchanged.
}
```

`useChatAccessibility()` owns an observer and its delayed, cancellation-safe
unmount cleanup; that avoids disposing it during React Strict Mode’s effect
probe. `useObserveChatAccessibility()` only observes snapshots and never
disposes the borrowed integration. Keep only observer-owning `runtime`,
`scopeId`, and `maxTrackedEntities` stable for one mounted chat. `onFinish`,
`onError`, and the optional label mapper may change identity across renders; the
integration always uses their latest values.

For a non-React integration, use `createObserver()` and `composeChatCallbacks()`
from the root entry before initializing the public AI SDK chat. `runtime` is a
borrowed `Pick<GenerativeA11yRuntime, "dispatch">`; disposing an observer never
disposes it.

## Event mapping and limits

| Public AI SDK evidence                                                          | Core event                                                              |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| New assistant `UIMessage.id`                                                    | `response.started`                                                      |
| Append-only `text` part content, by message ID and part index                   | `response.text.delta` suffix only                                       |
| `input-streaming` or `input-available` tool part                                | `tool.started`                                                          |
| `output-available` tool part                                                    | `tool.completed`                                                        |
| `output-error` tool part                                                        | `tool.failed` without backend error copy                                |
| `approval-requested` / `approval-responded` / `output-denied`, by `approval.id` | `approval.requested` / `approval.resolved`                              |
| New `source-url` or `source-document`, by `sourceId`                            | `citation.available` with tracked source count                          |
| Composed `onFinish`                                                             | exact completion, abort, or error; disconnect is `connection.lost` only |
| Composed `onError`                                                              | failure for the observed active response, without backend error copy    |

The first valid snapshot silently baselines assistant text, tool, approval, and
source identities. A repeated historical snapshot produces no events. Later text
is emitted only when it is an append-only suffix. A non-prefix rewrite or
reorder permanently suppresses that message-part until its message ID changes.
Historical approvals are not resolved because this package did not observe a
prior request event.

`status: "ready"`, `status: "error"`, and a call to `regenerate()` are not
terminal or retry evidence. Retry fidelity is therefore `unavailable` in frozen
`CHAT_ADAPTER_METADATA`; this package exports no retry wrapper. Disconnect
recovery is reported only after a later successful `onFinish`, so connection
fidelity is `inferred`.

`maxTrackedEntities` is a positive safe integer (default: 1000) that caps each
response, that response's text-part indices, tool, approval, and source identity
collection. Active response, pending approval, active tool, terminal, and
historical records are never evicted. When any collection cannot admit another
identity, the observer enters the saturation mode below instead of treating a
stale event as new.

If initial history or a later live snapshot exceeds any identity cap, the
observer enters metadata-declared `suppress-after-baseline-capacity` mode. It
emits no later snapshot or callback lifecycle events for that observer instance.
This bounded fail-closed behavior avoids replaying untracked historical IDs as
new output; create a new observer with a suitable cap when the host switches
chat history.

Automated tests validate normalized event translation, package import safety,
and a real public `useChat()` hook harness. They do not demonstrate real
assistive-technology speech.
