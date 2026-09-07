import { createRuntime } from "@generative-a11y/core";
import { bindRuntime } from "@generative-a11y/dom";
import { createStore } from "@generative-a11y/devtools";

export const runtime = createRuntime();
export const store = createStore();
const detach = store.attachRuntime({ id: "support", runtime });
const delivery = bindRuntime(runtime, {
  onDelivery(result) {
    store.recordDelivery({ runtimeId: "support", result });
  },
});

// Dispatch your host events through runtime. Keep this binding for the session.
export function disposeChat() {
  delivery.dispose();
  detach();
  store.dispose();
  runtime.dispose();
}
