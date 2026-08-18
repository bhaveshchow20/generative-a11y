# Framework integration research

Research updated: 2026-08-17. Adapters must re-verify compatibility before
publication. The current compatibility matrix and selection guide live in
[framework adapters](framework-adapters.md).

## Feasibility

| Integration   | Public surface                                               | v0.1 decision              | Main limitation                                                   |
| ------------- | ------------------------------------------------------------ | -------------------------- | ----------------------------------------------------------------- |
| AI SDK        | `useChat` state, `UIMessage.parts`, initialization callbacks | In progress                | Exact abort/disconnect requires `onFinish` at chat initialization |
| assistant-ui  | `ThreadRuntime.subscribe()`/`getState()` or `useAuiState`    | In progress                | No stable retry/connectivity events                               |
| AG-UI         | `agent.subscribe(AgentSubscriber)`                           | In progress                | Several optional lifecycle events are absent from the protocol    |
| CopilotKit v2 | `useAgent()` exposes an AG-UI `AbstractAgent`                | AG-UI integration guidance | Generic tool-based HITL needs configuration                       |
| CopilotKit v1 | Derived hooks                                                | Do not target              | Incomplete lifecycle surface                                      |

## AI SDK

Observe `messages`, `status` and `error`; diff accumulated text parts; inspect
documented tool, approval and source part states. Compose `onFinish`, `onError`
and optional `onToolCall` callbacks during chat creation. Never inspect
`AbstractChat` private fields.

| Normalized event        | Mapping                                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Start/delta             | `submitted`/new assistant ID, then text-part diffs while streaming                                |
| Complete/interrupt/fail | Exact `onFinish` flags and `onError`; state-only mode cannot classify abort/disconnect exactly    |
| Retry                   | Explicit wrapper around `regenerate()`; never infer replacement                                   |
| Tool                    | `input-streaming`/`input-available` → start; `output-available` → complete; `output-error` → fail |
| Approval                | `approval-requested`, `approval-responded`, `output-denied`                                       |
| Connection              | `isDisconnect`; restoration only after a later successful request if loss was recorded            |
| Citation                | New `source-url`/`source-document` part deduplicated by source ID                                 |

Sources: [useChat](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat),
[chat lifecycle](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot),
[tool usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage),
[stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol),
[UIMessage source](https://github.com/vercel/ai/blob/main/packages/ai/src/ui/ui-messages.ts).

## assistant-ui

Subscribe to `runtime.main`, baseline hydrated messages at mount, and track
assistant messages by ID and part index instead of assuming the final item is
active.

| Normalized event        | Mapping                                                                        |
| ----------------------- | ------------------------------------------------------------------------------ |
| Start/delta             | Assistant status `running`; diff text content by message/part identity         |
| Complete/interrupt/fail | `complete`; or `incomplete` reason `cancelled`/`error`                         |
| Retry/connection        | Unavailable without owning actions or runtime-specific evidence                |
| Tool                    | Part `running`, `complete`, or `incomplete`; only use documented progress data |
| Interaction             | `requires-action` with unresolved approval/interrupt data                      |
| Citation                | Newly added source content parts                                               |

Do not depend on `unstable_on`, `unstable_state`, `unstable_annotations` or
`unstable_data`.

Sources:
[state hooks](https://www.assistant-ui.com/docs/api-reference/hooks/state),
[AssistantRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/assistant-runtime),
[ThreadRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-runtime),
[MessageRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/message-runtime),
[tool UI](https://www.assistant-ui.com/docs/tools/tool-ui).

## AG-UI

AG-UI most closely matches the normalized model through `agent.subscribe()`.

| Normalized event          | Mapping                                                                                    |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Start/delta/complete      | `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT.delta`, `TEXT_MESSAGE_END`                     |
| Interrupt                 | Wrap public `abortRun()`; protocol has no exact abort event                                |
| Fail                      | `RUN_ERROR`/`onRunFailed`                                                                  |
| Tool start/complete       | `TOOL_CALL_START`, then `TOOL_CALL_RESULT`                                                 |
| Tool progress/failure     | No generic protocol event; require explicit configured conventions                         |
| Interaction               | `RUN_FINISHED.outcome.type === "interrupt"`; correlate next-run `resume[]` by interrupt ID |
| Retry/connection/citation | No standard event; use explicit adapter actions or configured custom conventions           |

`TOOL_CALL_END` only means arguments finished streaming and must never map to
successful execution.

Sources: [event types](https://docs.ag-ui.com/sdk/js/core/events),
[AgentSubscriber](https://docs.ag-ui.com/sdk/js/client/subscriber),
[AbstractAgent](https://docs.ag-ui.com/sdk/js/client/abstract-agent),
[interrupts](https://docs.ag-ui.com/concepts/interrupts).

## CopilotKit v2

`useAgent()` exposes a public AG-UI agent, so protocol mappings should reuse
`@generative-a11y/ag-ui`. Standard interrupts are detectable.
`useHumanInTheLoop` is implemented as a client tool, and a generic subscriber
cannot always distinguish it from ordinary tools; exact behavior needs
configured interactive tool names or a companion hook.

Do not use `useCopilotChatInternal`, private message contexts, enterprise-only
`_c` hooks or deprecated v1 internals.

Sources:
[CopilotKit AG-UI access](https://docs.copilotkit.ai/claude-sdk-python/backend/ag-ui),
[`useHumanInTheLoop`](https://docs.copilotkit.ai/reference/v2/hooks/useHumanInTheLoop),
[HITL patterns](https://docs.copilotkit.ai/agent-spec/human-in-the-loop),
[official repository](https://github.com/CopilotKit/CopilotKit).
