// @vitest-environment jsdom
import { ManualClock, createRuntime } from "@generative-a11y/core";
import { en } from "@generative-a11y/core/messages";
import { act, render, cleanup } from "@testing-library/react";
import { StrictMode, useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { A11yProvider, useRuntime } from "./index.js";

afterEach(cleanup);
it("forwards construction catalogs through StrictMode without dispatch during SSR", async () => {
  const clock = new ManualClock();
  const delivered: string[] = [];
  const catalog = {
    id: "react-fr",
    locale: "fr",
    messages: {
      ...en.messages,
      "response.completed": "Réponse terminée.",
    },
  };
  function Child() {
    const runtime = useRuntime();
    useLayoutEffect(() => {
      runtime.dispatch({
        type: "response.started",
        responseId: "r",
        locale: "en",
      });
      runtime.dispatch({ type: "response.completed", responseId: "r" });
    }, [runtime]);
    return <input aria-label="Composer" />;
  }
  const tree = (
    <StrictMode>
      <A11yProvider
        clock={clock}
        messages={catalog}
        onAnnouncement={(a) => delivered.push(a.text)}
        policy={{ minimumGapMs: 0 }}
      >
        <Child />
      </A11yProvider>
    </StrictMode>
  );
  expect(renderToString(tree)).not.toContain("Réponse terminée.");
  expect(delivered).toEqual([]);
  const view = render(tree);
  const input = view.getByRole("textbox");
  input.focus();
  await act(() => clock.advanceBy(1000));
  expect(delivered).toEqual(["Réponse terminée."]);
  expect(
    document.querySelector('[aria-live="polite"]')?.getAttribute("lang"),
  ).toBe("fr");
  expect(document.activeElement).toBe(input);
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(clock.pendingCount()).toBe(0);
});

it("preserves a borrowed runtime catalog across keyed provider replacement", async () => {
  const clock = new ManualClock();
  const delivered: string[] = [];
  const runtime = createRuntime({
    clock,
    onAnnouncement: (a) => delivered.push(a.text),
    messages: {
      id: "borrowed-en",
      locale: "en",
      messages: {
        ...en.messages,
        "response.completed": "Borrowed catalog.",
      },
    },
  });
  const ignored = {
    id: "provider-en",
    locale: "en",
    messages: {
      ...en.messages,
      "response.completed": "Provider catalog.",
    },
  };
  const view = render(
    <A11yProvider key="one" runtime={runtime} messages={ignored}>
      <span>First</span>
    </A11yProvider>,
  );
  view.rerender(
    <A11yProvider key="two" runtime={runtime} messages={ignored}>
      <span>Second</span>
    </A11yProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await act(() => {
    runtime.dispatch({ type: "response.started", responseId: "one" });
    runtime.dispatch({ type: "response.completed", responseId: "one" });
    clock.runUntilIdle();
  });
  expect(delivered).toEqual(["Borrowed catalog."]);
  expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
    "Borrowed catalog.",
  );
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    runtime.dispatch({ type: "response.started", responseId: "still-owned" }),
  ).toBe(true);
  runtime.dispose();
  expect(clock.pendingCount()).toBe(0);
});
it("uses a new catalog only when an owned provider is explicitly replaced", async () => {
  const clock = new ManualClock();
  const delivered: string[] = [];
  const first = {
    id: "first-en",
    locale: "en",
    messages: {
      ...en.messages,
      "response.completed": "First catalog.",
    },
  };
  const second = {
    id: "second-en",
    locale: "en",
    messages: {
      ...en.messages,
      "response.completed": "Second catalog.",
    },
  };
  function Complete() {
    const runtime = useRuntime();
    useLayoutEffect(() => {
      runtime.dispatch({ type: "response.started", responseId: "r" });
      runtime.dispatch({ type: "response.completed", responseId: "r" });
    }, [runtime]);
    return null;
  }
  const props = {
    clock,
    onAnnouncement: (a: { text: string }) => delivered.push(a.text),
  };
  const view = render(
    <A11yProvider key="one" {...props} messages={first}>
      <Complete />
    </A11yProvider>,
  );
  await act(() => clock.runUntilIdle());
  view.rerender(
    <A11yProvider key="one" {...props} messages={second}>
      <Complete />
    </A11yProvider>,
  );
  await act(() => clock.runUntilIdle());
  expect(delivered).toEqual(["First catalog."]);
  view.rerender(
    <A11yProvider key="two" {...props} messages={second}>
      <Complete />
    </A11yProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  await act(() => clock.runUntilIdle());
  expect(delivered).toEqual(["First catalog.", "Second catalog."]);
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(clock.pendingCount()).toBe(0);
});
