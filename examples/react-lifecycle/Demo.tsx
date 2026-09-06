"use client";

import { App, type HostOperations } from "./Chat.js";

// Example host service only. Replace with your existing API calls.
function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("Cancelled"));
      return;
    }
    const cancel = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      reject(new Error("Cancelled"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, milliseconds);
    signal.addEventListener("abort", cancel, { once: true });
  });
}

const operations: HostOperations = {
  async reply(_prompt, { signal, onDelta }) {
    await wait(300, signal);
    onDelta("Here is a draft for your review. ");
    await wait(400, signal);
    onDelta("You can choose whether to use it.");
  },
  async prepare({ signal, onProgress }) {
    await wait(1800, signal);
    onProgress(0.5);
    await wait(700, signal);
  },
};

export function ReactLifecycleDemo() {
  return <App operations={operations} />;
}
