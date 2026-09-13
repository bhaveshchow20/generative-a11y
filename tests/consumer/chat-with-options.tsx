// Test harness for applications that forward arbitrary host options.
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
  const existingOptions = options;
  const onFinish = options.onFinish ?? (() => {});
  const onError = options.onError ?? (() => {});
  const accessibility = useChatAccessibility({
    runtime,
    scopeId: "support",
    onFinish,
    onError,
  });
  const chat = useChat({ ...existingOptions, ...accessibility.chatCallbacks });
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
