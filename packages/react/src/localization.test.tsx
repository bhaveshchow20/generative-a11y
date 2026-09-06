// @vitest-environment jsdom
import {
  ManualClock,
  englishAnnouncementCatalog,
  createGenerativeA11y,
} from "@generative-a11y/core";
import { act, render, cleanup } from "@testing-library/react";
import { StrictMode, useLayoutEffect } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it } from "vitest";
import { GenerativeA11yProvider, useGenerativeA11yRuntime } from "./index.js";

afterEach(cleanup);
it("forwards construction catalogs through StrictMode without dispatch during SSR", async () => {
  const clock = new ManualClock();
  const delivered: string[] = [];
  const catalog = {
    id: "react-fr",
    locale: "fr",
    messages: {
      ...englishAnnouncementCatalog.messages,
      "response.completed": "Réponse terminée.",
    },
  };
  function Child() {
    const runtime = useGenerativeA11yRuntime();
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
      <GenerativeA11yProvider
        clock={clock}
        announcementCatalog={catalog}
        onAnnouncement={(a) => delivered.push(a.text)}
        policy={{ minimumGapMs: 0 }}
      >
        <Child />
      </GenerativeA11yProvider>
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
  const runtime = createGenerativeA11y({
    clock,
    onAnnouncement: (a) => delivered.push(a.text),
    announcementCatalog: {
      id: "borrowed-en",
      locale: "en",
      messages: {
        ...englishAnnouncementCatalog.messages,
        "response.completed": "Borrowed catalog.",
      },
    },
  });
  const ignored = {
    id: "provider-en",
    locale: "en",
    messages: {
      ...englishAnnouncementCatalog.messages,
      "response.completed": "Provider catalog.",
    },
  };
  const view = render(
    <GenerativeA11yProvider
      key="one"
      runtime={runtime}
      announcementCatalog={ignored}
    >
      <span>First</span>
    </GenerativeA11yProvider>,
  );
  view.rerender(
    <GenerativeA11yProvider
      key="two"
      runtime={runtime}
      announcementCatalog={ignored}
    >
      <span>Second</span>
    </GenerativeA11yProvider>,
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
      ...englishAnnouncementCatalog.messages,
      "response.completed": "First catalog.",
    },
  };
  const second = {
    id: "second-en",
    locale: "en",
    messages: {
      ...englishAnnouncementCatalog.messages,
      "response.completed": "Second catalog.",
    },
  };
  function Complete() {
    const runtime = useGenerativeA11yRuntime();
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
    <GenerativeA11yProvider key="one" {...props} announcementCatalog={first}>
      <Complete />
    </GenerativeA11yProvider>,
  );
  await act(() => clock.runUntilIdle());
  view.rerender(
    <GenerativeA11yProvider key="one" {...props} announcementCatalog={second}>
      <Complete />
    </GenerativeA11yProvider>,
  );
  await act(() => clock.runUntilIdle());
  expect(delivered).toEqual(["First catalog."]);
  view.rerender(
    <GenerativeA11yProvider key="two" {...props} announcementCatalog={second}>
      <Complete />
    </GenerativeA11yProvider>,
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
