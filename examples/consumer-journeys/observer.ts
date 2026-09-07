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
