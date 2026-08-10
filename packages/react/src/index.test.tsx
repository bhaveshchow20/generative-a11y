// @vitest-environment jsdom

import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
import {
  createAttentionStore,
  createPreferenceStore,
} from "@generative-a11y/dom";
import { act, render, renderHook, screen } from "@testing-library/react";
import { Activity, StrictMode, useLayoutEffect, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  GenerativeA11yProvider,
  useGenerativeA11y,
  useGenerativeA11yAttention,
  useGenerativeA11yBindings,
  useGenerativeA11yPreferences,
  useGenerativeA11yRuntime,
} from "./index.js";

afterEach(() => {
  document.body.replaceChildren();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  vi.restoreAllMocks();
});

async function flushCleanup(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

describe("GenerativeA11yProvider", () => {
  it("creates a runtime and exposes a stable context", () => {
    const values: unknown[] = [];
    function Probe() {
      const value = useGenerativeA11y();
      values.push(value);
      return <span>{value.runtime.getPolicy().text.strategy}</span>;
    }
    const view = render(
      <GenerativeA11yProvider dom={false}>
        <Probe />
      </GenerativeA11yProvider>,
    );
    view.rerender(
      <GenerativeA11yProvider dom={false}>
        <Probe />
      </GenerativeA11yProvider>,
    );
    expect(screen.getByText("sentence")).toBeTruthy();
    expect(values[0]).toBe(values[1]);
  });

  it("uses but never disposes an external runtime", async () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const dispose = vi.spyOn(runtime, "dispose");
    const { result, unmount } = renderHook(() => useGenerativeA11yRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider runtime={runtime} dom={false}>
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current).toBe(runtime);
    unmount();
    await flushCleanup();
    expect(dispose).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("does not dispose an owned runtime during a Strict Mode probe", async () => {
    let runtime: ReturnType<typeof useGenerativeA11yRuntime> | undefined;
    function Probe() {
      runtime = useGenerativeA11yRuntime();
      return null;
    }
    const view = render(
      <StrictMode>
        <GenerativeA11yProvider dom={false}>
          <Probe />
        </GenerativeA11yProvider>
      </StrictMode>,
    );
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "r" }),
    ).not.toThrow();
    view.unmount();
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "later" }),
    ).toThrow("disposed");
  });

  it("disposes owned attention and preference stores after a real unmount", async () => {
    let context: ReturnType<typeof useGenerativeA11y> | undefined;
    function Probe() {
      context = useGenerativeA11y();
      return null;
    }
    const view = render(
      <StrictMode>
        <GenerativeA11yProvider dom={false}>
          <Probe />
        </GenerativeA11yProvider>
      </StrictMode>,
    );
    await flushCleanup();
    expect(() =>
      context?.attentionStore.registerComposer(document.body),
    ).not.toThrow();
    view.unmount();
    await flushCleanup();
    expect(() =>
      context?.attentionStore.registerComposer(document.body),
    ).toThrow("disposed");
    expect(() =>
      context?.preferenceStore.setPreferences({
        version: 1,
        preset: "completion-only",
      }),
    ).toThrow("disposed");
  });

  it("rejects changing runtime identity without a keyed remount", () => {
    const first = createGenerativeA11y({ onAnnouncement: () => undefined });
    const second = createGenerativeA11y({ onAnnouncement: () => undefined });
    const view = render(
      <GenerativeA11yProvider runtime={first} dom={false}>
        <span />
      </GenerativeA11yProvider>,
    );
    expect(() =>
      view.rerender(
        <GenerativeA11yProvider runtime={second} dom={false}>
          <span />
        </GenerativeA11yProvider>,
      ),
    ).toThrow("runtime cannot change");
    first.dispose();
    second.dispose();
  });

  it("keeps the provider outside a disconnected Activity boundary", async () => {
    let runtime: ReturnType<typeof useGenerativeA11yRuntime> | undefined;
    function Probe() {
      runtime = useGenerativeA11yRuntime();
      return null;
    }
    const view = render(
      <GenerativeA11yProvider dom={false}>
        <Activity mode="visible">
          <Probe />
        </Activity>
      </GenerativeA11yProvider>,
    );
    view.rerender(
      <GenerativeA11yProvider dom={false}>
        <Activity mode="hidden">
          <Probe />
        </Activity>
      </GenerativeA11yProvider>,
    );
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "activity" }),
    ).not.toThrow();
  });

  it("supports isolated nested providers and nearest context", () => {
    const outer = createGenerativeA11y({ onAnnouncement: () => undefined });
    const inner = createGenerativeA11y({ onAnnouncement: () => undefined });
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useGenerativeA11yRuntime());
      return null;
    }
    render(
      <GenerativeA11yProvider runtime={outer} dom={false}>
        <Probe />
        <GenerativeA11yProvider runtime={inner} dom={false}>
          <Probe />
        </GenerativeA11yProvider>
      </GenerativeA11yProvider>,
    );
    expect(seen).toEqual([outer, inner]);
    outer.dispose();
    inner.dispose();
  });

  it("captures initial construction and DOM configuration", () => {
    const view = render(
      <GenerativeA11yProvider preset="minimal" dom={false}>
        <span />
      </GenerativeA11yProvider>,
    );
    view.rerender(
      <GenerativeA11yProvider preset="verbose">
        <span />
      </GenerativeA11yProvider>,
    );
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("throws clear errors for every hook outside a provider", () => {
    for (const hook of [
      useGenerativeA11y,
      useGenerativeA11yRuntime,
      useGenerativeA11yAttention,
      useGenerativeA11yBindings,
      useGenerativeA11yPreferences,
    ]) {
      expect(() => renderHook(() => hook())).toThrow(
        "must be used within GenerativeA11yProvider",
      );
    }
  });
});

describe("DOM delivery", () => {
  it("server-renders stable hidden regions without announcements", () => {
    const html = renderToString(
      <GenerativeA11yProvider>
        <main>Host UI</main>
      </GenerativeA11yProvider>,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('aria-relevant="additions text"');
    expect(html).toContain("Host UI");
    expect(html).not.toContain('role="');
  });

  it("pre-mounts regions before a child layout effect dispatches", () => {
    const clock = new ManualClock();
    function Dispatch() {
      const runtime = useGenerativeA11yRuntime();
      useLayoutEffect(() => {
        runtime.dispatch({ type: "response.started", responseId: "r" });
      }, [runtime]);
      return null;
    }
    render(
      <GenerativeA11yProvider clock={clock} preset="verbose">
        <Dispatch />
      </GenerativeA11yProvider>,
    );
    act(() => clock.runUntilIdle());
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Assistant is responding.",
    );
  });

  it("does not render or install regions when DOM delivery is disabled", () => {
    render(
      <GenerativeA11yProvider dom={false}>
        <main>Host UI</main>
      </GenerativeA11yProvider>,
    );
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("hydrates without duplicate bindings or announcements", async () => {
    const clock = new ManualClock();
    const runtime = createGenerativeA11y({ preset: "verbose", clock });
    const app = (
      <GenerativeA11yProvider runtime={runtime}>
        <main>Host UI</main>
      </GenerativeA11yProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, app);
    });
    act(() =>
      runtime.dispatch({ type: "response.started", responseId: "one" }),
    );
    act(() => clock.runUntilIdle());
    expect(container.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Assistant is responding.",
    );
    act(() => root.unmount());
    runtime.dispose();
  });

  it("keeps one active binding through Strict Mode probes and rerenders", () => {
    const clock = new ManualClock();
    const runtime = createGenerativeA11y({ preset: "verbose", clock });
    const diagnostics = vi.fn();
    const app = (label: string) => (
      <StrictMode>
        <GenerativeA11yProvider
          runtime={runtime}
          dom={{ onDiagnostic: diagnostics }}
        >
          <main>{label}</main>
        </GenerativeA11yProvider>
      </StrictMode>
    );
    const view = render(app("first"));
    view.rerender(app("second"));
    act(() => {
      runtime.dispatch({ type: "response.started", responseId: "strict" });
      clock.runUntilIdle();
    });
    expect(document.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(document.querySelectorAll('[aria-live="assertive"]')).toHaveLength(
      1,
    );
    expect(diagnostics).toHaveBeenCalledTimes(1);
    runtime.dispose();
  });

  it("isolates live regions for multiple runtimes", () => {
    const firstClock = new ManualClock();
    const secondClock = new ManualClock();
    const first = createGenerativeA11y({
      preset: "verbose",
      clock: firstClock,
    });
    const second = createGenerativeA11y({
      preset: "verbose",
      clock: secondClock,
    });
    render(
      <>
        <section data-testid="first-provider">
          <GenerativeA11yProvider runtime={first}>
            <span />
          </GenerativeA11yProvider>
        </section>
        <section data-testid="second-provider">
          <GenerativeA11yProvider runtime={second}>
            <span />
          </GenerativeA11yProvider>
        </section>
      </>,
    );
    act(() => {
      first.dispatch({ type: "response.started", responseId: "first" });
      firstClock.runUntilIdle();
    });
    expect(
      screen.getByTestId("first-provider").querySelector('[aria-live="polite"]')
        ?.textContent,
    ).toBe("Assistant is responding.");
    expect(
      screen
        .getByTestId("second-provider")
        .querySelector('[aria-live="polite"]')?.textContent,
    ).toBe("");
    first.dispose();
    second.dispose();
  });
});

describe("preferences", () => {
  it("observes defaults and updates without resetting the active runtime", () => {
    let runtime: ReturnType<typeof useGenerativeA11yRuntime> | undefined;
    const { result } = renderHook(
      () => {
        runtime = useGenerativeA11yRuntime();
        return useGenerativeA11yPreferences();
      },
      { wrapper: GenerativeA11yProvider },
    );
    expect(result.current.preferences.preset).toBe("balanced");
    const before = runtime;
    act(() =>
      result.current.setPreferences({
        version: 1,
        preset: "minimal",
        streaming: "off",
        tools: "off",
      }),
    );
    expect(result.current.preferences.preset).toBe("minimal");
    expect(runtime).toBe(before);
  });

  it("validates updates made before the owned store installs", () => {
    function InvalidUpdate() {
      const { setPreferences } = useGenerativeA11yPreferences();
      useLayoutEffect(() => {
        setPreferences({ version: 1, preset: "invalid" } as never);
      }, [setPreferences]);
      return null;
    }
    expect(() =>
      render(
        <GenerativeA11yProvider dom={false}>
          <InvalidUpdate />
        </GenerativeA11yProvider>,
      ),
    ).toThrow("Invalid preference preset");
  });

  it("uses an external preference snapshot for initial owned runtime policy", () => {
    const store = createPreferenceStore({
      defaultValue: { version: 1, preset: "completion-only" },
    });
    const { result, unmount } = renderHook(
      () => ({
        policy: useGenerativeA11yRuntime().getPolicy(),
        preferences: useGenerativeA11yPreferences(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <GenerativeA11yProvider preferenceStore={store} dom={false}>
            {children}
          </GenerativeA11yProvider>
        ),
      },
    );
    expect(result.current.policy.text.strategy).toBe("completion");
    expect(result.current.policy.announceInteractions).toBe(false);
    expect(result.current.preferences.store).toBe(store);
    unmount();
    expect(() =>
      store.setPreferences({ version: 1, preset: "completion-only" }),
    ).not.toThrow();
    store.dispose();
  });

  it("explicit runtime configuration wins over preferences", () => {
    const store = createPreferenceStore({
      defaultValue: { version: 1, preset: "completion-only" },
    });
    const { result } = renderHook(() => useGenerativeA11yRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider
          preferenceStore={store}
          preset="verbose"
          dom={false}
        >
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current.getPolicy().announceResponseStarted).toBe(true);
    store.dispose();
  });

  it("loads persisted client preferences without resetting the active runtime", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({ version: 1, preset: "completion-only" }),
      ),
      setItem: vi.fn(),
    };
    const { result } = renderHook(
      () => ({
        policy: useGenerativeA11yRuntime().getPolicy(),
        preference: useGenerativeA11yPreferences(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <GenerativeA11yProvider
            preferences={{ persistence: { key: "test", storage } }}
            dom={false}
          >
            {children}
          </GenerativeA11yProvider>
        ),
      },
    );
    expect(result.current.preference.preferences.preset).toBe(
      "completion-only",
    );
    expect(result.current.policy.text.strategy).toBe("sentence");
    act(() =>
      result.current.preference.setPreferences({
        version: 1,
        preset: "minimal",
        streaming: "preset",
        tools: "preset",
      }),
    );
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(result.current.policy.text.strategy).toBe("sentence");
  });

  it("isolates storage failures from rendering and preference updates", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new DOMException("blocked", "SecurityError");
      }),
      setItem: vi.fn(() => {
        throw new DOMException("full", "QuotaExceededError");
      }),
    };
    const diagnostics = vi.fn();
    const { result } = renderHook(() => useGenerativeA11yPreferences(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider
          preferences={{
            persistence: { key: "test", storage },
            onDiagnostic: diagnostics,
          }}
          dom={false}
        >
          {children}
        </GenerativeA11yProvider>
      ),
    });
    act(() =>
      result.current.setPreferences({ version: 1, preset: "completion-only" }),
    );
    expect(result.current.preferences.preset).toBe("completion-only");
    expect(diagnostics).toHaveBeenCalledTimes(2);
  });

  it("never disposes borrowed preference and attention stores", async () => {
    const preferenceStore = createPreferenceStore();
    const attentionStore = createAttentionStore({ document });
    const preferenceDispose = vi.spyOn(preferenceStore, "dispose");
    const attentionDispose = vi.spyOn(attentionStore, "dispose");
    const view = render(
      <GenerativeA11yProvider
        preferenceStore={preferenceStore}
        attentionStore={attentionStore}
        dom={false}
      >
        <span />
      </GenerativeA11yProvider>,
    );
    view.unmount();
    await flushCleanup();
    expect(preferenceDispose).not.toHaveBeenCalled();
    expect(attentionDispose).not.toHaveBeenCalled();
    preferenceStore.dispose();
    attentionStore.dispose();
  });
});

describe("attention and bindings", () => {
  it("keeps observation inert when attention is disabled", () => {
    const { result } = renderHook(() => useGenerativeA11yAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider attention={false} dom={false}>
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current).toEqual({
      visibility: "unknown",
      windowFocus: "unknown",
      focusArea: "unknown",
      newestResponse: "unknown",
      mode: "unknown",
    });
  });

  it("forwards attention snapshots through useSyncExternalStore", () => {
    const store = createAttentionStore({ document });
    const { result } = renderHook(() => useGenerativeA11yAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider attentionStore={store} dom={false}>
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current.visibility).toBe("visible");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(result.current.visibility).toBe("hidden");
    store.dispose();
  });

  it("installs owned attention after commit and forwards observations", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const { result } = renderHook(() => useGenerativeA11yAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider attention={{ document }} dom={false}>
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current.visibility).toBe("hidden");
    expect(result.current.mode).toBe("background");
  });

  it("registers, replaces, and unregisters binding refs", () => {
    const store = createAttentionStore({ document });
    function Fixture({ alternate = false }: { alternate?: boolean }) {
      const bindings = useGenerativeA11yBindings();
      const attention = useGenerativeA11yAttention();
      return (
        <>
          {alternate ? (
            <textarea data-testid="alternate" {...bindings.composerProps} />
          ) : (
            <textarea data-testid="composer" {...bindings.composerProps} />
          )}
          <div {...bindings.conversationProps}>
            <span data-testid="history" />
          </div>
          <div {...bindings.newestResponseProps} />
          <output>{attention.focusArea}</output>
        </>
      );
    }
    const view = render(
      <GenerativeA11yProvider attentionStore={store} dom={false}>
        <Fixture />
      </GenerativeA11yProvider>,
    );
    act(() => screen.getByTestId("composer").focus());
    expect(screen.getByText("composer")).toBeTruthy();
    view.rerender(
      <GenerativeA11yProvider attentionStore={store} dom={false}>
        <Fixture alternate />
      </GenerativeA11yProvider>,
    );
    act(() => screen.getByTestId("alternate").focus());
    expect(screen.getByText("composer")).toBeTruthy();
    view.unmount();
    store.dispose();
  });

  it("replays binding refs registered before owned attention installation", () => {
    function Fixture() {
      const bindings = useGenerativeA11yBindings();
      const attention = useGenerativeA11yAttention();
      return (
        <>
          <textarea data-testid="owned-composer" {...bindings.composerProps} />
          <output>{attention.focusArea}</output>
        </>
      );
    }
    render(
      <GenerativeA11yProvider attention={{ document }} dom={false}>
        <Fixture />
      </GenerativeA11yProvider>,
    );
    const composer = screen.getByTestId("owned-composer");
    act(() => composer.focus());
    expect(screen.getByText("composer")).toBeTruthy();
  });

  it("does not move focus or scroll while installing bindings", () => {
    const before = document.activeElement;
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    function Fixture() {
      const bindings = useGenerativeA11yBindings();
      return <textarea {...bindings.composerProps} />;
    }
    render(
      <GenerativeA11yProvider dom={false}>
        <Fixture />
      </GenerativeA11yProvider>,
    );
    expect(document.activeElement).toBe(before);
    expect(focus).not.toHaveBeenCalled();
  });
});
