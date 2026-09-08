# @generative-a11y/ai-sdk

Thin accessibility lifecycle translation for `ai@7.0.x` and
`@ai-sdk/react@4.0.x`. It observes host-owned public state and dispatches to a
borrowed `@generative-a11y/core` runtime; it does not render UI, read the DOM,
own a chat, invoke `regenerate()`, or inspect private chat state.

The root entry is SSR-safe. The React integration is available only from
`@generative-a11y/ai-sdk/react`.

## Install for an existing React + AI SDK app

```sh
npm install @generative-a11y/react @generative-a11y/ai-sdk
```

Your existing AI SDK setup must also satisfy its `zod` peer
(`^3.25.76 || ^4.1.8` for the checked SDK version).

These are the two direct library dependencies used below. Core and DOM are
installed transitively; declare them directly only if your own code imports
them. Prerequisites: Node.js 22+, `ai@7.0.x`, `@ai-sdk/react@4.0.x`, and
compatible `react` / `react-dom` versions (`^18.2.0 || ^19.0.0`). Keep your
working backend, transport, and host UI. The test matrix uses ai 7.0.77,
@ai-sdk/react 4.0.80, and React / React DOM 19.2.8.

## React quick start

Create the accessibility integration before `useChat()` so its composed
callbacks are present when AI SDK creates the chat. Pass existing options,
including transport and callbacks, to `App`; the default uses `/api/chat`. Then
observe the documented public snapshot returned from `useChat()`.

```tsx
"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import { DefaultChatTransport } from "ai";
import { useChat, type UseChatOptions } from "@ai-sdk/react";
import { A11yProvider, useRuntime } from "@generative-a11y/react";
import {
  useChatAccessibility,
  useObserveChatAccessibility,
} from "@generative-a11y/ai-sdk/react";

// Keep your existing transport and options here (or pass them to App).
const defaultOptions = {
  id: "support",
  transport: new DefaultChatTransport({ api: "/api/chat" }),
};

// This recipe lets useChat construct the chat; an existing Chat needs callbacks
// composed at its own construction boundary instead.
type ChatOptions = Exclude<UseChatOptions<UIMessage>, { chat: unknown }>;

function Chat({ options }: { options: ChatOptions }) {
  const runtime = useRuntime();
  const accessibility = useChatAccessibility({
    runtime,
    scopeId: "support",
    onFinish: (event) => options.onFinish?.(event),
    onError: (error) => options.onError?.(error),
  });
  // Spread composed callbacks last so host options cannot overwrite them.
  const chat = useChat({ ...options, ...accessibility.chatCallbacks });
  useObserveChatAccessibility({ integration: accessibility, snapshot: chat });
  const [input, setInput] = useState("");

  // This is example host UI. Keep your existing message list and composer.
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!input.trim()) return;
        void chat.sendMessage({ text: input });
        setInput("");
      }}
    >
      {chat.messages.map((message) => (
        <p key={message.id}>
          {message.parts
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("")}
        </p>
      ))}
      <label>
        Message
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={chat.status === "streaming" || chat.status === "submitted"}
      >
        Send
      </button>
    </form>
  );
}

export function App({ options = defaultOptions }: { options?: ChatOptions }) {
  return (
    <A11yProvider>
      <Chat options={options} />
    </A11yProvider>
  );
}
```

`A11yProvider` owns one runtime and browser delivery for the mounted chat
surface and cleans them up on unmount. Keep it mounted across responses. Keep
`scopeId` stable; remount the chat deliberately when switching sessions. The
adapter supplies paced live-region updates without changing the visible UI or
moving focus for ordinary streaming. Your host still owns semantic structure,
keyboard controls, accessible message content, and any approval UI. DOM delivery
does not establish what a real screen reader speaks.

If you pass an already constructed `Chat` to `useChat`, its other initialization
options are ignored. Compose callbacks at that chat's construction boundary
using the [observer API](https://generativea11y.com/api/ai-sdk); do not add
`chatCallbacks` beside an existing `chat` and expect them to attach.

`useChatAccessibility()` owns an observer and its delayed, cancellation-safe
unmount cleanup; that avoids disposing it during React Strict Mode’s effect
probe. `useObserveChatAccessibility()` only observes snapshots and never
disposes the borrowed integration. Keep only observer-owning `runtime`,
`scopeId`, and `maxTrackedEntities` stable for one mounted chat. `onFinish`,
`onError`, and the optional label mapper may change identity across renders; the
integration always uses their latest values.

### Advanced: observer without React

```sh
npm install @generative-a11y/core @generative-a11y/ai-sdk "ai@~7.0.0"
```

This installs an observer and runtime, not browser delivery. For a browser
integration that imports `bindRuntime`, also install `@generative-a11y/dom`,
connect delivery once, and dispose delivery before the runtime on teardown.

For a non-React integration, use `createChatObserver()` and
`composeChatCallbacks()` from the root entry before initializing the public AI
SDK chat. `runtime` is a borrowed `Pick<Runtime, "dispatch">`; disposing an
observer never disposes it.

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
`adapterInfo`; this package exports no retry wrapper. Disconnect recovery is
reported only after a later successful `onFinish`, so connection fidelity is
`inferred`.

The public chat snapshot does not expose stable run, step, or hierarchy
lifecycles, so those fidelity fields remain `unavailable` rather than inferred.

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

## Documentation

- [Vercel AI SDK accessibility guide](https://generativea11y.com/docs/integrations/ai-sdk)
- [AI SDK API reference](https://generativea11y.com/api/ai-sdk)
- [GitHub repository](https://github.com/bhaveshchow20/generative-a11y)

## Related packages

- [`@generative-a11y/core`](https://www.npmjs.com/package/@generative-a11y/core)
  receives the normalized lifecycle events.
- [`@generative-a11y/react`](https://www.npmjs.com/package/@generative-a11y/react)
  provides browser delivery for React applications.

## Host-owned localized copy

The binding/observer accepts optional `copy: AdapterCopy` from
`@generative-a11y/core/messages`. Supply a complete object with `locale`,
`toolLabel`, `approvalRequested`, `approvalResolved`
(approved/rejected/cancelled), `inputRequested`, and `inputResolved`
(submitted/cancelled). It is validated and copied at construction; each adapter
uses only copy for events it already observes. Copy-bearing events carry its
locale; response text is never assigned a language from this option. No
lifecycle fidelity changes.

Pair this with core's `messages` for generated notices. Reuse your existing i18n
system; no translation engine is added. Copy strings are nonempty and at most
4,096 UTF-16 code units; locale is a valid language tag of at most 128. Invalid
configuration throws before subscribing. Omitted copy preserves existing generic
English labels.

See the
[complete localization guide](https://generativea11y.com/docs/localized-announcements)
for every field, ownership, fallbacks, and an illustrative complete French
example.

`getToolLabel` takes precedence over `copy.toolLabel`; return text in the copy's
language. `useChatAccessibility` forwards `copy`, captured when its observer is
created. Change runtime/scope or remount intentionally to replace it; callbacks
remain current without recreating the observer on ordinary renders.

The example uses your existing AI SDK `/api/chat` endpoint. `A11yProvider` owns
the runtime and browser delivery; `useChatAccessibility` owns only its observer.
Both clean up on unmount. Keep your existing transport and UI. Add host
`onFinish`/`onError` callbacks to `useChatAccessibility` when needed; it
composes them with its own callbacks. Do not overwrite `chatCallbacks` after
spreading them into `useChat`.

## Non-React observer API

`createChatObserver(options)` returns a `ChatObserver` and never owns the core
runtime. `ChatObserverOptions` requires a non-empty `scopeId` and a runtime with
`dispatch`. Optional `copy` comes from `core/messages`; `getToolLabel` receives
`ToolLabelContext` (`toolCallId`, `toolName`, and optional-value `title`). Its
safe label overrides the generic copy. `maxTrackedEntities` defaults to 1,000
and must be a positive safe integer.

| Method                     | Contract                                                                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observe(snapshot)`        | Accepts `ChatSnapshot`: public `messages`, `status`, and `error`. The first valid snapshot establishes a silent baseline. Later append-only parts produce events; it does not subscribe to a framework for you.                               |
| `finish(message, outcome)` | Accepts an SDK assistant `UIMessage` and `ChatFinishOutcome` with `isAbort`, `isDisconnect`, and `isError`. Disconnect emits connection loss rather than completion; error precedes abort, and ordinary finish completes the active response. |
| `failActiveResponse()`     | Reports failure for the last observed active response. No active response means no output; raw error text is never copied.                                                                                                                    |
| `dispose()`                | Clears observer state and makes later observations/callbacks inert. It does not dispose the runtime.                                                                                                                                          |

`composeChatCallbacks({ observer, onFinish?, onError? })` accepts
`ComposeChatCallbacksOptions` and returns the SDK-compatible callbacks. It calls
the observer first, then the host callback in a `finally` block so host handling
still runs if observer dispatch throws. Install these callbacks before creating
the SDK chat; observe its public snapshots separately.

After identity capacity is exhausted, **all later snapshot and terminal-callback
lifecycle events are suppressed**, including known identities. Create a fresh
observer at an intentional session boundary. A non-prefix text rewrite is also
suppressed for that part until its message ID changes. These conservative limits
prevent guessed lifecycle events.

The following complete deterministic example exercises the public observer
contract without a React component or backend. In a live application, use the
SDK's real snapshots and callbacks, a browser delivery binding, and cleanup when
the surface is removed. Do not recreate the adapter's private scoped IDs.

```ts
import {
  createRuntime,
  ManualClock,
  type AnnouncementIntent,
} from "@generative-a11y/core";
import {
  createChatObserver,
  composeChatCallbacks,
} from "@generative-a11y/ai-sdk";
import type { UIMessage } from "ai";

// A deterministic demonstration of the non-React API, using public SDK data.
export const announcements: AnnouncementIntent[] = [];
const clock = new ManualClock();
const runtime = createRuntime({
  clock,
  onAnnouncement: (intent) => announcements.push(intent),
});
const observer = createChatObserver({ runtime, scopeId: "support" });
const callbacks = composeChatCallbacks({ observer });

// Supply the initial public snapshot first; historical content is not replayed.
observer.observe({ messages: [], status: "ready", error: undefined });
const message: UIMessage = {
  id: "assistant-1",
  role: "assistant",
  parts: [{ type: "text", text: "Your answer is ready." }],
};
observer.observe({
  messages: [message],
  status: "streaming",
  error: undefined,
});
// In an application, pass callbacks to the SDK when constructing its chat.
callbacks.onFinish({
  message,
  messages: [message],
  isAbort: false,
  isDisconnect: false,
  isError: false,
  finishReason: "stop",
});
clock.runUntilIdle();
observer.dispose();
runtime.dispose();
```
