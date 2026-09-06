import { createRuntime } from "@generative-a11y/core";
import { bindRuntime } from "@generative-a11y/dom";

const runtime = createRuntime();
const delivery = bindRuntime(runtime);

// Send these events from your existing response lifecycle callbacks.
runtime.dispatch({ type: "response.started", responseId: "response-1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "response-1",
  delta: "A complete sentence.",
});
runtime.dispatch({ type: "response.completed", responseId: "response-1" });

// Call this when the chat is removed, not when a response finishes.
export function disposeChat() {
  delivery.dispose();
  runtime.dispose();
}
