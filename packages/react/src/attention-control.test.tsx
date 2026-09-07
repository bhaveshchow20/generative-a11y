// @vitest-environment jsdom
import { createRuntime } from "@generative-a11y/core";
import { createAttentionStore, bindAttention } from "@generative-a11y/dom";
import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import * as reactA11y from "./index.js";

const { A11yProvider } = reactA11y;
function Control() {
  const { state, setOverride } = reactA11y.useAttentionControl();
  return (
    <button onClick={() => setOverride("normal")}>
      {state.observed}/{state.override}/{state.effective}
    </button>
  );
}
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
afterEach(async () => {
  cleanup();
  await flush();
  vi.restoreAllMocks();
});

it("keeps providers observation-only by default and control snapshots stable", async () => {
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  const dispatch = vi.spyOn(runtime, "dispatch");
  render(
    <A11yProvider runtime={runtime} delivery={false}>
      <Control />
    </A11yProvider>,
  );
  expect(screen.getByRole("button").textContent).toBe("unknown/auto/normal");
  expect(dispatch).not.toHaveBeenCalled();
  runtime.dispose();
});
it("forwards native observations in StrictMode and preserves an explicit override on cleanup", async () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  const store = createAttentionStore({ document });
  const dispose = vi.spyOn(store, "dispose");
  const view = render(
    <StrictMode>
      <A11yProvider
        runtime={runtime}
        attentionStore={store}
        attentionPolicy
        delivery={false}
      >
        <Control />
      </A11yProvider>
    </StrictMode>,
  );
  expect(screen.getByRole("button").textContent).toBe("background/auto/quiet");
  act(() => screen.getByRole("button").click());
  expect(screen.getByRole("button").textContent).toBe(
    "background/normal/normal",
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  await act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(screen.getByRole("button").textContent).toContain("/normal/normal");
  view.unmount();
  await flush();
  expect(runtime.getDiagnosticSnapshot().attention).toEqual({
    observed: "unknown",
    override: "normal",
    effective: "normal",
  });
  expect(dispose).not.toHaveBeenCalled();
  store.dispose();
  runtime.dispose();
});
it("uses an inert SSR snapshot and hydrates to the borrowed runtime state without render dispatch", async () => {
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  runtime.dispatch({ type: "attention.override", mode: "quiet" });
  const dispatch = vi.spyOn(runtime, "dispatch");
  const app = (
    <A11yProvider runtime={runtime} delivery={false}>
      <Control />
    </A11yProvider>
  );
  const container = document.createElement("div");
  container.innerHTML = renderToString(app);
  document.body.append(container);
  expect(container.textContent).toBe("unknown/auto/normal");
  expect(dispatch).not.toHaveBeenCalled();
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, app, {
      onRecoverableError: (e) => errors.push(e),
    });
  });
  expect(container.textContent).toBe("unknown/quiet/quiet");
  expect(errors).toEqual([]);
  expect(dispatch).not.toHaveBeenCalled();
  act(() => root.unmount());
  await flush();
  runtime.dispose();
  container.remove();
});
it("rejects a provider bridge competing with a DOM binding and preserves borrowed ownership", async () => {
  const runtime = createRuntime({});
  const store = createAttentionStore({ document });
  const disposeRuntime = vi.spyOn(runtime, "dispose");
  const disposeStore = vi.spyOn(store, "dispose");
  const binding = bindAttention({ runtime, attentionStore: store });
  expect(() =>
    render(
      <A11yProvider
        runtime={runtime}
        attentionStore={store}
        attentionPolicy
        delivery={false}
      />,
    ),
  ).toThrow(/already/);
  await flush();
  expect(disposeRuntime).not.toHaveBeenCalled();
  expect(disposeStore).not.toHaveBeenCalled();
  binding.dispose();
  store.dispose();
  runtime.dispose();
});

it("returns a stable frozen default with disabled policy and owns the configured runtime", async () => {
  const states: Array<
    ReturnType<typeof reactA11y.useAttentionControl>["state"]
  > = [];
  function DefaultControl() {
    const { state } = reactA11y.useAttentionControl();
    useEffect(() => {
      states.push(state);
    });
    return <Control />;
  }
  const view = render(
    <A11yProvider delivery={false}>
      <DefaultControl />
    </A11yProvider>,
  );
  view.rerender(
    <A11yProvider delivery={false}>
      <DefaultControl />
    </A11yProvider>,
  );
  expect(states.length).toBeGreaterThanOrEqual(2);
  for (const state of states) {
    expect(state).toBe(states[0]);
    expect(Object.isFrozen(state)).toBe(true);
  }
  act(() => screen.getByRole("button").click());
  expect(screen.getByRole("button").textContent).toBe("unknown/auto/normal");
  view.unmount();
  await flush();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  const enabled = render(
    <A11yProvider
      delivery={false}
      attentionPolicy
      policy={{ attention: { enabled: true } }}
    >
      <Control />
    </A11yProvider>,
  );
  expect(screen.getByRole("button").textContent).toBe("background/auto/quiet");
  enabled.unmount();
  await flush();
});

it("rolls back a failed store subscription and leaves retained callbacks inert", async () => {
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  const store = createAttentionStore({ document });
  let retained = () => {};
  vi.spyOn(store, "subscribe").mockImplementation((listener) => {
    retained = listener;
    throw new Error("subscription failed");
  });
  const dispatch = vi.spyOn(runtime, "dispatch");
  const dispose = vi.spyOn(store, "dispose");
  expect(() =>
    render(
      <A11yProvider
        runtime={runtime}
        attentionStore={store}
        attentionPolicy
        delivery={false}
      />,
    ),
  ).toThrow("subscription failed");
  await flush();
  dispatch.mockClear();
  retained();
  expect(dispatch).not.toHaveBeenCalled();
  expect(dispose).not.toHaveBeenCalled();
  store.dispose();
  runtime.dispose();
});

it("releases the bridge during keyed replacement without stale cleanup resetting its successor", async () => {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "hidden",
  });
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  const store = createAttentionStore({ document });
  const disposeRuntime = vi.spyOn(runtime, "dispose");
  const disposeStore = vi.spyOn(store, "dispose");
  const app = (key: string) => (
    <StrictMode>
      <A11yProvider
        key={key}
        runtime={runtime}
        attentionStore={store}
        attentionPolicy
        delivery={false}
      >
        <Control />
      </A11yProvider>
    </StrictMode>
  );
  const view = render(app("first"));
  expect(screen.getByRole("button").textContent).toBe("background/auto/quiet");
  view.rerender(app("second"));
  expect(screen.getByRole("button").textContent).toBe("background/auto/quiet");
  await flush();
  expect(runtime.getDiagnosticSnapshot().attention?.observed).toBe(
    "background",
  );
  expect(disposeRuntime).not.toHaveBeenCalled();
  expect(disposeStore).not.toHaveBeenCalled();
  view.unmount();
  expect(runtime.getDiagnosticSnapshot().attention?.observed).toBe("unknown");
  await flush();
  store.dispose();
  runtime.dispose();
});

it("still rejects two concurrently mounted provider bridges", async () => {
  const runtime = createRuntime({
    policy: { attention: { enabled: true } },
  });
  const store = createAttentionStore({ document });
  const first = render(
    <A11yProvider
      runtime={runtime}
      attentionStore={store}
      attentionPolicy
      delivery={false}
    />,
  );
  expect(() =>
    render(
      <A11yProvider
        runtime={runtime}
        attentionStore={store}
        attentionPolicy
        delivery={false}
      />,
    ),
  ).toThrow(/already/);
  await flush();
  expect(() => bindAttention({ runtime, attentionStore: store })).toThrow(
    /already/,
  );
  first.unmount();
  await flush();
  const next = bindAttention({ runtime, attentionStore: store });
  next.dispose();
  store.dispose();
  runtime.dispose();
});
