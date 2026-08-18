// @vitest-environment node

import { describe, expect, it } from "vitest";

describe("AI SDK root export", () => {
  it("imports during SSR without browser globals", async () => {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    Reflect.deleteProperty(globalThis, "window");
    Reflect.deleteProperty(globalThis, "document");
    try {
      await expect(import("./index.js")).resolves.toMatchObject({
        CHAT_ADAPTER_METADATA: expect.any(Object),
      });
      await expect(import("./react.js")).resolves.toMatchObject({
        useChatAccessibility: expect.any(Function),
      });
    } finally {
      Object.assign(globalThis, {
        window: previousWindow,
        document: previousDocument,
      });
    }
  });
});
