# Framework adapters

Phase 3 adapters translate documented framework lifecycle evidence into
`@generative-a11y/core` events. They preserve the existing host UI: they do not
render components, mutate the DOM, move focus, own a chat/runtime, invoke
framework actions, or implement announcement policy.

Automated adapter, DOM, and browser tests prove event/structural behavior; they
do not prove that assistive technology spoke an announcement. The Phase 2
browser and manual assistive-technology work remains separately planned in the
[implementation plan](implementation-plan.md).

## Choose an integration

| Application boundary     | Use                             | Why                                                                                  |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------ |
| AI SDK React `useChat()` | `@generative-a11y/ai-sdk/react` | Observes documented public snapshots and composed lifecycle callbacks.               |
| assistant-ui runtime     | `@generative-a11y/assistant-ui` | Binds the documented thread runtime state/subscription boundary.                     |
| AG-UI agent              | `@generative-a11y/ag-ui`        | Binds the documented protocol-agent subscription boundary.                           |
| CopilotKit v2            | `@generative-a11y/ag-ui`        | `useAgent()` exposes the same public AG-UI agent; no duplicate wrapper is published. |
| Other framework          | `@generative-a11y/core`         | Dispatch normalized public events from the framework's documented lifecycle.         |

Install an adapter alongside `@generative-a11y/core`; use `@generative-a11y/dom`
or `@generative-a11y/react` separately for delivery. Adapters never depend on
the DOM package.

## Contract

Every adapter receives a borrowed object with `dispatch(event)`, not ownership
of a core runtime. A required caller `scopeId` isolates framework IDs reused by
multiple mounted chats, threads, or agents. Source IDs are preserved. Any
necessary local observation key is deterministic and namespaced by adapter and
scope; displayed text, tool labels, and render count are never identity.

Snapshot integrations silently baseline hydrated history. Later stable-source
text is emitted only as an append-only suffix. Rewrites, missing IDs,
out-of-order terminal events, duplicate input, unknown additive fields, and
post-disposal callbacks are ignored safely and may emit a serializable adapter
diagnostic. Disposing a binding removes only subscriptions it created; it never
disposes the core target or a framework-owned runtime.

Framework error payloads, tool arguments, arbitrary tool results, and source
content are diagnostic data. They never become `announcement` text. Adapter
labels use a host-provided localized mapping or a conservative generic label.

## Compatibility matrix

Research access date: **2026-08-17**. Declared ranges are deliberately narrow
and must be tested at their endpoints before publication.

| Adapter      | Framework peer range                                | Exact versions under test           | React requirement                                             |
| ------------ | --------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------- |
| AI SDK       | `ai >=7.0.0 <7.1.0`, `@ai-sdk/react >=4.0.0 <4.1.0` | `ai@7.0.66`, `@ai-sdk/react@4.0.69` | React 18 or 19; React subpath only                            |
| assistant-ui | `@assistant-ui/core >=0.3.13 <0.4.0`                | `@assistant-ui/core@0.3.13`         | none for root; optional future helper supports React 18 or 19 |
| AG-UI        | `@ag-ui/core`, `@ag-ui/client >=0.0.57 <0.0.59`     | `0.0.57`, `0.0.58`                  | none                                                          |

Framework libraries remain peer dependencies plus development dependencies for
integration/type checks. They are not bundled. Module imports remain safe on the
server: browser globals are not read during evaluation.

## Fidelity and known limits

Adapters declare exact, partial, action-wrapper, and unavailable fidelity from
real evidence. They do not infer a missing lifecycle from UI text or private
state. The package READMEs contain the tested event-level mapping tables.

- AI SDK: assistant-message and tool IDs are public; exact terminal distinction
  requires composed `onFinish`/`onError` callbacks. Chat status alone does not
  identify a response terminal state. `regenerate()` is not a retry event
  without explicit host action evidence.
- assistant-ui: documented message and tool state supports streaming and
  terminal observation. Hydration/thread switching is baseline-only. Retry and
  connectivity have no stable generic public lifecycle evidence.
- AG-UI: text and tool protocol callbacks preserve source identity. Tool
  argument completion is not tool execution completion. Protocol replay and
  reconnect lack a mandatory generic cursor, so raw replay is not treated as
  deduplicated connectivity evidence.

## CopilotKit decision

No `@generative-a11y/copilotkit` package is planned. CopilotKit v2 documents
`useAgent()` as the AG-UI public boundary. Attach the AG-UI adapter only after
the hook reports `isReady`, and clean it up in the React effect:

```tsx
const { agent, isReady } = useAgent({ agentId });

useEffect(() => {
  if (!isReady) return;
  return observeAgUiAgent({ agent, runtime, scopeId: agentId }).dispose;
}, [agent, isReady, runtime, agentId]);
```

Generic CopilotKit human-in-the-loop tools cannot reliably be distinguished from
ordinary client tools by an external subscriber. Standard AG-UI interrupts
remain supported through the AG-UI mapping; product-specific client tools need
an explicit host integration instead of a name heuristic.

## Primary sources

- [AI SDK `useChat`](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat),
  [lifecycle](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), and
  [tools/approvals](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage)
- [assistant-ui thread runtime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-runtime)
  and [tool UI state](https://www.assistant-ui.com/docs/tools/tool-ui)
- [AG-UI subscribers](https://docs.ag-ui.com/sdk/js/client/subscriber),
  [events](https://docs.ag-ui.com/concepts/events), and
  [interrupts](https://docs.ag-ui.com/concepts/interrupts)
- [CopilotKit `useAgent`](https://docs.copilotkit.ai/reference/v2/hooks/useAgent)
  and
  [human-in-the-loop](https://docs.copilotkit.ai/reference/v2/hooks/useHumanInTheLoop)
