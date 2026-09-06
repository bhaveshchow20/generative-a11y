// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, render, screen } from "@testing-library/react";
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
      guide.split("## React integration")[1]?.split("### Walkthrough")[0] ?? "";
    const blocks = [...section.matchAll(/```tsx\n([\s\S]*?)\n```/g)];
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
            /```(?:ts|tsx|typescript)\n([\s\S]*?)\n```/g,
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
