// @vitest-environment jsdom

import type { GenerativeA11yEvent } from "@generative-a11y/core";
import { useLocalRuntime } from "@assistant-ui/react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { bindThreadRuntime } from "./index.js";

describe("assistant-ui public runtime integration", () => {
  it("binds and unbinds the installed public useLocalRuntime thread", () => {
    const { result, unmount } = renderHook(() =>
      useLocalRuntime({
        async run() {
          return { content: [], status: { type: "complete", reason: "stop" } };
        },
      }),
    );
    const events: GenerativeA11yEvent[] = [];
    const binding = bindThreadRuntime({
      runtime: { dispatch: (event) => events.push(event) },
      scopeId: "real-runtime",
      thread: result.current.thread,
    });
    expect(result.current.thread.getState().messages).toEqual([]);
    binding.dispose();
    unmount();
    expect(events).toEqual([]);
  });
});
