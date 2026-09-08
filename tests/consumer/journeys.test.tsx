// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createUIMessageStreamResponse } from "ai";
import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

const examples = [
  [
    "observer.ts",
    ["packages/ai-sdk/README.md", "apps/docs/content/api/ai-sdk.mdx"],
  ],
  ["vanilla.ts", ["README.md", "apps/docs/content/docs/getting-started.mdx"]],
  [
    "chat.tsx",
    [
      "packages/ai-sdk/README.md",
      "apps/docs/content/api/ai-sdk/use-chat-accessibility.mdx",
    ],
  ],
  ["devtools.ts", ["packages/devtools/README.md"]],
] as const;

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("first-time developer journeys", () => {
  it("keeps the short React guide excerpts aligned with the complete example", () => {
    const source = readFileSync("examples/consumer-journeys/chat.tsx", "utf8");
    const guide = readFileSync(
      "apps/docs/content/docs/integrations/ai-sdk.mdx",
      "utf8",
    );
    const section =
      guide
        .split("## React integration")[1]
        ?.split("### Existing callbacks")[0] ?? "";
    const blocks = [...section.matchAll(/```tsx[^\n]*\n([\s\S]*?)\n```/g)];
    expect(blocks).toHaveLength(3);
    const normalizedSource = source
      .split("\n")
      .map((line) => line.trim())
      .join("\n");
    for (const block of blocks) {
      expect(normalizedSource).toContain(
        block[1]
          ?.split("\n")
          .map((line) => line.trim())
          .join("\n"),
      );
    }
  });

  it("keeps the optional callback recipe aligned with its consumer harness", () => {
    const harness = readFileSync(
      "tests/consumer/chat-with-options.tsx",
      "utf8",
    );
    const normalize = (value: string) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .join("\n");
    for (const file of [
      "packages/ai-sdk/README.md",
      "apps/docs/content/docs/integrations/ai-sdk.mdx",
      "apps/docs/content/api/ai-sdk/use-chat-accessibility.mdx",
    ]) {
      const section = readFileSync(file, "utf8").split(
        "### Existing callbacks",
      )[1];
      const block = section?.match(/```tsx[^\n]*\n([\s\S]*?)\n```/)?.[1];
      expect(block, file).toBeDefined();
      expect(normalize(harness)).toContain(normalize(block!));
    }
  });

  it.each(examples)(
    "publishes the typechecked %s example without missing context",
    (file, pages) => {
      const source = readFileSync(
        `examples/consumer-journeys/${file}`,
        "utf8",
      ).trim();
      for (const page of pages) {
        const blocks = [
          ...readFileSync(page, "utf8").matchAll(
            /```(?:ts|tsx|typescript)[^\n]*\n([\s\S]*?)\n```/g,
          ),
        ];
        expect(
          blocks.some((block) => block[1]?.trim() === source),
          page,
        ).toBe(true);
      }
    },
  );

  it("runs the standalone observer example from public SDK snapshots and callbacks", async () => {
    const { announcements } =
      await import("../../examples/consumer-journeys/observer.js");
    expect(announcements.map((intent) => intent.text)).toEqual([
      "Your answer is ready.",
      "Response complete.",
    ]);
  });

  it("lets the vanilla quickstart deliver before explicit teardown", async () => {
    vi.useFakeTimers();
    const { disposeChat } =
      await import("../../examples/consumer-journeys/vanilla.js");
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1000);
    expect(document.body.textContent).toContain("Response complete.");
    disposeChat();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("mounts the complete AI SDK example with one provider-owned delivery path", async () => {
    const { App } = await import("../../examples/consumer-journeys/chat.js");
    const view = render(<App />);
    expect(screen.getByRole("textbox", { name: "Message" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Send" })).toBeDefined();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(2);
    await act(async () => {
      view.unmount();
    });
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
  });

  it("delivers a response through the canonical example's default transport", async () => {
    const { App } = await import("../../examples/consumer-journeys/chat.js");
    const fetch = vi.fn(async () =>
      createUIMessageStreamResponse({
        stream: new ReadableStream<UIMessageChunk>({
          start(controller) {
            controller.enqueue({ type: "start", messageId: "simple-response" });
            controller.enqueue({ type: "text-start", id: "text-1" });
            controller.enqueue({
              type: "text-delta",
              id: "text-1",
              delta: "A simple answer.",
            });
            controller.enqueue({ type: "text-end", id: "text-1" });
            controller.enqueue({ type: "finish", finishReason: "stop" });
            controller.close();
          },
        }),
      }),
    );
    vi.stubGlobal("fetch", fetch);
    const view = render(<App />);
    const input = screen.getByRole("textbox", { name: "Message" });
    input.focus();
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Send" }).closest("form")!,
    );
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(fetch).toHaveBeenCalledWith(
      "/api/chat",
      expect.objectContaining({ method: "POST" }),
    );
    await waitFor(() =>
      expect(screen.getByText("A simple answer.")).toBeDefined(),
    );
    await waitFor(
      () =>
        expect(
          document.querySelector('[aria-live="polite"]')?.textContent,
        ).toContain("Response complete."),
      { timeout: 4000 },
    );
    expect(document.activeElement).toBe(input);
    await act(async () => view.unmount());
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
  });

  it.each(["finish", "error"] as const)(
    "preserves host transport and callbacks through a real SDK %s request",
    async (outcome) => {
      const { App } = await import("./chat-with-options.js");
      let controller!: ReadableStreamDefaultController<UIMessageChunk>;
      const sendMessages = vi.fn<ChatTransport<UIMessage>["sendMessages"]>(() =>
        Promise.resolve(
          new ReadableStream<UIMessageChunk>({
            start(value) {
              controller = value;
            },
          }),
        ),
      );
      const transport: ChatTransport<UIMessage> = {
        sendMessages,
        reconnectToStream: async () => null,
      };
      const onFinish = vi.fn();
      const onError = vi.fn();
      const onData = vi.fn();
      const view = render(
        <App
          options={{ id: "host-chat", transport, onFinish, onError, onData }}
        />,
      );
      const input = screen.getByRole("textbox", { name: "Message" });
      input.focus();
      fireEvent.change(input, { target: { value: "Hello" } });
      fireEvent.submit(
        screen.getByRole("button", { name: "Send" }).closest("form")!,
      );
      await waitFor(() => expect(sendMessages).toHaveBeenCalledTimes(1));
      expect(sendMessages.mock.calls[0]?.[0].chatId).toBe("host-chat");
      await act(async () => {
        controller.enqueue({ type: "start", messageId: "response-1" });
        controller.enqueue({ type: "text-start", id: "text-1" });
        controller.enqueue({
          type: "text-delta",
          id: "text-1",
          delta: "A streamed answer.",
        });
        controller.enqueue({
          type: "data-notice",
          data: "host-data",
          transient: true,
        });
      });
      await waitFor(() =>
        expect(screen.getByText("A streamed answer.")).toBeDefined(),
      );
      expect(onData).toHaveBeenCalledTimes(1);
      await act(async () => {
        if (outcome === "finish") {
          controller.enqueue({ type: "text-end", id: "text-1" });
          controller.enqueue({ type: "finish", finishReason: "stop" });
          controller.close();
        } else {
          controller.error(new Error("private backend details"));
        }
      });
      await waitFor(() =>
        expect(outcome === "finish" ? onFinish : onError).toHaveBeenCalledTimes(
          1,
        ),
      );
      await waitFor(
        () => {
          const delivered = [...document.querySelectorAll("[aria-live]")]
            .map((region) => region.textContent)
            .join(" ");
          expect(delivered).toContain(
            outcome === "finish" ? "Response complete." : "failed",
          );
          expect(delivered).not.toContain("private backend details");
        },
        { timeout: 4000 },
      );
      expect(document.activeElement).toBe(input);
      await act(async () => view.unmount());
      expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
    },
  );

  it("records delivery from the active binding in the devtools example", async () => {
    vi.useFakeTimers();
    const { runtime, store, disposeChat } =
      await import("../../examples/consumer-journeys/devtools.js");
    runtime.dispatch({ type: "response.started", responseId: "r" });
    runtime.dispatch({ type: "response.completed", responseId: "r" });
    await vi.advanceTimersByTimeAsync(1000);
    expect(
      store
        .getSnapshot()
        .records.some((record) => record.kind === "dom-delivery"),
    ).toBe(true);
    disposeChat();
    expect(document.querySelectorAll("[aria-live]")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
