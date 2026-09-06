"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { A11yProvider, useRuntime } from "@generative-a11y/react";
import {
  useChatAccessibility,
  useObserveChatAccessibility,
} from "@generative-a11y/ai-sdk/react";

function Chat() {
  const runtime = useRuntime();
  const accessibility = useChatAccessibility({ runtime, scopeId: "support" });
  const chat = useChat({ id: "support", ...accessibility.chatCallbacks });
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

export function App() {
  return (
    <A11yProvider>
      <Chat />
    </A11yProvider>
  );
}
