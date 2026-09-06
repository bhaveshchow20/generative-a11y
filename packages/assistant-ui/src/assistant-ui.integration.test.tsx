// @vitest-environment jsdom

import type { RuntimeEvent } from "@generative-a11y/core";
import { useLocalRuntime } from "@assistant-ui/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { bindThread } from "./index.js";

describe("assistant-ui public runtime integration", () => {
  it("binds and unbinds the installed public useLocalRuntime thread", () => {
    const { result, unmount } = renderHook(() =>
      useLocalRuntime({
        async run() {
          return { content: [], status: { type: "complete", reason: "stop" } };
        },
      }),
    );
    const events: RuntimeEvent[] = [];
    const binding = bindThread({
      runtime: {
        dispatch(event) {
          events.push(event);
          return true;
        },
      },
      scopeId: "real-runtime",
      thread: result.current.thread,
    });
    expect(result.current.thread.getState().messages).toEqual([]);
    binding.dispose();
    unmount();
    expect(events).toEqual([]);
  });
});
