// @vitest-environment jsdom
import { ManualClock, type AnnouncementIntent } from "@generative-a11y/core";
import { GenerativeA11yProvider } from "@generative-a11y/react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, expect, it } from "vitest";
import { HostChat, type HostOperations } from "./Chat.js";

afterEach(cleanup);

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function setup() {
  const reply = deferred();
  const tool = deferred();
  let delta!: (text: string) => void;
  let progress!: (value: number) => void;
  let signal!: AbortSignal;
  const operations: HostOperations = {
    reply: (_prompt, options) => {
      delta = options.onDelta;
      signal = options.signal;
      return reply.promise;
    },
    prepare: (options) => {
      progress = options.onProgress;
      return tool.promise;
    },
  };
  const clock = new ManualClock();
  const announcements: AnnouncementIntent[] = [];
  const view = render(
    <StrictMode>
      <GenerativeA11yProvider
        clock={clock}
        dom={{ mode: "live-region" }}
        attention={false}
        preset="verbose"
        policy={{
          minimumGapMs: 0,
          tools: { announceStartAfterMs: 10, announceProgress: true },
        }}
        onAnnouncement={(notice) => announcements.push(notice)}
      >
        <HostChat operations={operations} />
      </GenerativeA11yProvider>
    </StrictMode>,
  );
  fireEvent.change(screen.getByRole("textbox", { name: "Message" }), {
    target: { value: "Plan a trip" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  return {
    ...view,
    clock,
    announcements,
    reply,
    tool,
    delta: (text: string) => delta(text),
    progress: (value: number) => progress(value),
    signal: () => signal,
  };
}

it("delivers a complete response, long-running tool and urgent decision without moving focus", async () => {
  const fixture = setup();
  const composer = screen.getByRole("textbox", { name: "Message" });
  composer.focus();
  expect(fixture.announcements).toHaveLength(0);
  expect(fixture.container.querySelector("[aria-live]")).toBeNull();
  act(() => fixture.clock.advanceBy(0));
  expect(
    document.body.querySelector('[aria-live="polite"]')?.textContent,
  ).not.toBe("");
  act(() => fixture.delta("Your itinerary is ready."));
  await act(async () => fixture.reply.resolve());
  act(() => fixture.clock.advanceBy(20));
  act(() => fixture.progress(0.5));
  act(() => fixture.clock.advanceBy(0));
  await act(async () => fixture.tool.resolve());
  act(() => fixture.clock.runUntilIdle());
  expect(document.activeElement).toBe(composer);
  expect(
    document.body.querySelector('[aria-live="assertive"]')?.textContent,
  ).toContain("Use this draft?");
  fireEvent.click(screen.getByRole("button", { name: "Use draft" }));
  act(() => fixture.clock.runUntilIdle());
  const text = fixture.announcements.map((notice) => notice.text).join("\n");
  expect(text).toContain("Your itinerary is ready.");
  expect(text).toContain("Prepare draft complete.");
  expect(fixture.announcements).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        sourceType: "tool.started",
        text: "Prepare draft.",
      }),
      expect.objectContaining({
        sourceType: "tool.progress",
        text: "Prepare draft 50 percent.",
      }),
      expect.objectContaining({ sourceType: "response.completed" }),
    ]),
  );
  expect(text).toContain("confirmation approved.");
  expect(screen.getByText("Draft selected.")).toBeTruthy();
});

it.each(["response", "tool"])(
  "reports safe %s failure and permits a new request",
  async (stage) => {
    const fixture = setup();
    if (stage === "tool") await act(async () => fixture.reply.resolve());
    await act(async () =>
      (stage === "tool" ? fixture.tool : fixture.reply).reject(
        new Error("private backend URL"),
      ),
    );
    act(() => fixture.clock.runUntilIdle());
    expect(
      screen.getByText("Could not prepare the draft. Try again."),
    ).toBeTruthy();
    expect(
      fixture.announcements.map((notice) => notice.text).join(" "),
    ).not.toContain("private backend");
    expect(fixture.announcements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceType: stage === "tool" ? "tool.failed" : "response.failed",
        }),
      ]),
    );
    expect(
      (screen.getByRole("button", { name: "Send" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  },
);

it("rejects the explicit interaction and ignores late text after response completion", async () => {
  const fixture = setup();
  await act(async () => fixture.reply.resolve());
  act(() => fixture.delta("Late private text"));
  await act(async () => fixture.tool.resolve());
  fireEvent.click(screen.getByRole("button", { name: "Discard draft" }));
  act(() => fixture.clock.runUntilIdle());
  expect(screen.getByText("Draft discarded.")).toBeTruthy();
  expect(
    fixture.announcements.map((notice) => notice.text).join(" "),
  ).toContain("confirmation rejected.");
  expect(document.body.textContent).not.toContain("Late private text");
});

it.each(["response", "tool"])(
  "aborts during %s on unmount, ignores late callbacks and clears owned delivery",
  async (stage) => {
    const fixture = setup();
    if (stage === "tool") await act(async () => fixture.reply.resolve());
    fixture.unmount();
    expect(fixture.signal().aborted).toBe(true);
    await act(async () => {
      fixture.delta("Late text");
      if (stage === "tool") fixture.progress(1);
      fixture.reply.resolve();
      fixture.tool.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(fixture.clock.pendingCount()).toBe(0);
    expect(document.body.querySelector("[aria-live]")).toBeNull();
    expect(fixture.announcements).toHaveLength(0);
  },
);

it("uses fresh identities on a second request and ignores completed tool callbacks", async () => {
  const fixture = setup();
  await act(async () => fixture.reply.resolve());
  await act(async () => fixture.tool.resolve());
  act(() => fixture.clock.runUntilIdle());
  const first = fixture.announcements.find(
    (notice) => notice.sourceType === "response.completed",
  );
  const firstTool = fixture.announcements.find(
    (notice) => notice.sourceType === "tool.completed",
  );
  expect(first).toBeDefined();
  expect(firstTool).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Use draft" }));
  act(() => fixture.progress(1));
  expect(screen.getByText("Draft selected.")).toBeTruthy();
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Send" })),
  );
  act(() => fixture.clock.runUntilIdle());
  const responses = fixture.announcements.filter(
    (notice) => notice.sourceType === "response.completed",
  );
  const tools = fixture.announcements.filter(
    (notice) => notice.sourceType === "tool.completed",
  );
  expect(responses).toHaveLength(2);
  expect(tools).toHaveLength(2);
  expect(new Set(responses.map((notice) => notice.responseId)).size).toBe(2);
  expect(new Set(tools.map((notice) => notice.toolId)).size).toBe(2);
});
