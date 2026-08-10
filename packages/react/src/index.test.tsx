// @vitest-environment jsdom

import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
import {
  createAttentionStore,
  createPreferenceStore,
  type PreferenceStore,
  type PreferenceStoreOptions,
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

function createIframeRealm() {
  const iframe = document.createElement("iframe");
  document.body.append(iframe);
  const realmDocument = iframe.contentDocument;
  const realmWindow = iframe.contentWindow;
  if (!realmDocument || !realmWindow)
    throw new Error("iframe realm unavailable");
  const realmStorage = {
    getItem: vi.fn(() => null as string | null),
    setItem: vi.fn(),
  };
  Object.defineProperty(realmWindow, "localStorage", {
    configurable: true,
    value: realmStorage,
  });
  const container = realmDocument.createElement("div");
  realmDocument.body.append(container);
  return { container, realmDocument, realmStorage, realmWindow };
}

function createRealmStorageEvent(
  realmDocument: Document,
  key: string,
  newValue: string,
  storageArea: unknown,
): Event {
  const event = realmDocument.createEvent("Event");
  event.initEvent("storage", false, false);
  Object.defineProperties(event, {
    key: { value: key },
    newValue: { value: newValue },
    storageArea: { value: storageArea },
  });
  return event;
}

describe("GenerativeA11yProvider", () => {
  it("uses an external preference server snapshot during SSR", () => {
    const store: PreferenceStore = {
      subscribe: () => () => undefined,
      getSnapshot: () => {
        throw new Error("client snapshot unavailable on server");
      },
      getServerSnapshot: () => ({ version: 1, preset: "completion-only" }),
      setPreferences: () => undefined,
      dispose: () => undefined,
    };
    function Policy() {
      return (
        <span>{useGenerativeA11yRuntime().getPolicy().text.strategy}</span>
      );
    }
    expect(
      renderToString(
        <GenerativeA11yProvider preferenceStore={store} dom={false}>
          <Policy />
        </GenerativeA11yProvider>,
      ),
    ).toContain("completion");
  });

  it("does not read an irrelevant hostile preference store", () => {
    const runtime = createGenerativeA11y({ onAnnouncement: () => undefined });
    const store: PreferenceStore = {
      subscribe: () => {
        throw new Error("irrelevant subscribe");
      },
      getSnapshot: () => {
        throw new Error("irrelevant client snapshot");
      },
      getServerSnapshot: () => {
        throw new Error("irrelevant server snapshot");
      },
      setPreferences: () => undefined,
      dispose: () => undefined,
    };
    expect(() =>
      renderToString(
        <GenerativeA11yProvider
          runtime={runtime}
          preferenceStore={store}
          dom={false}
        >
          <span />
        </GenerativeA11yProvider>,
      ),
    ).not.toThrow();
    runtime.dispose();

    const view = render(
      <GenerativeA11yProvider
        preset="verbose"
        preferenceStore={store}
        dom={false}
      >
        <span />
      </GenerativeA11yProvider>,
    );
    expect(view.container.querySelector("span")).toBeTruthy();
    view.unmount();
  });

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

  it("rolls back transactional startup when a managed store fails", () => {
    let runtime: ReturnType<typeof useGenerativeA11yRuntime> | undefined;
    const preferenceOptions = {} as PreferenceStoreOptions;
    Object.defineProperty(preferenceOptions, "persistence", {
      enumerable: true,
      get() {
        throw new Error("startup failed");
      },
    });
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const windowAdded = vi.spyOn(window, "addEventListener");
    const windowRemoved = vi.spyOn(window, "removeEventListener");
    function Probe() {
      runtime = useGenerativeA11yRuntime();
      return null;
    }
    expect(() =>
      render(
        <GenerativeA11yProvider preferences={preferenceOptions}>
          <Probe />
        </GenerativeA11yProvider>,
      ),
    ).toThrow("startup failed");
    const observedEvents = new Set(["visibilitychange", "focusin", "focusout"]);
    const addCount = added.mock.calls.filter(([name]) =>
      observedEvents.has(name),
    ).length;
    const removeCount = removed.mock.calls.filter(([name]) =>
      observedEvents.has(name),
    ).length;
    expect(addCount).toBeGreaterThan(0);
    expect(removeCount).toBe(addCount);
    const windowObservedEvents = new Set(["focus", "blur"]);
    const windowAddCount = windowAdded.mock.calls.filter(([name]) =>
      windowObservedEvents.has(name),
    ).length;
    const windowRemoveCount = windowRemoved.mock.calls.filter(([name]) =>
      windowObservedEvents.has(name),
    ).length;
    expect(windowAddCount).toBeGreaterThan(0);
    expect(windowRemoveCount).toBe(windowAddCount);
    expect(document.querySelector("[aria-live]")).toBeNull();
    expect(runtime?.pendingCount()).toBe(0);
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "stale" }),
    ).toThrow("disposed");
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
  it("normalizes a caller-controlled preference snapshot only once", () => {
    let snapshotCount = 0;
    const target = { version: 1, preset: "completion-only" } as const;
    const preference = new Proxy(target, {
      ownKeys(value) {
        snapshotCount += 1;
        return Reflect.ownKeys(value);
      },
      getOwnPropertyDescriptor(value, key) {
        const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
        if (key === "preset" && descriptor && snapshotCount > 1) {
          return { ...descriptor, value: "invalid" };
        }
        return descriptor;
      },
    });
    const { result } = renderHook(() => useGenerativeA11yRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider
          preferences={{ defaultValue: preference }}
          dom={false}
        >
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(result.current.getPolicy().text.strategy).toBe("completion");
    expect(snapshotCount).toBe(1);
  });

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

  it("uses the client snapshot for an initial external preference policy", () => {
    const clientSnapshot = Object.freeze({
      version: 1 as const,
      preset: "completion-only" as const,
    });
    const getSnapshot = vi.fn(() => clientSnapshot);
    const store: PreferenceStore = {
      subscribe: () => () => undefined,
      getSnapshot,
      getServerSnapshot: () => ({
        version: 1,
        preset: "balanced",
        streaming: "preset",
        tools: "preset",
      }),
      setPreferences: () => undefined,
      dispose: () => undefined,
    };
    const { result } = renderHook(() => useGenerativeA11yRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <GenerativeA11yProvider preferenceStore={store} dom={false}>
          {children}
        </GenerativeA11yProvider>
      ),
    });
    expect(getSnapshot).toHaveBeenCalled();
    expect(result.current.getPolicy().text.strategy).toBe("completion");
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

  it("preserves and persists a valid pre-start layout-effect update", () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({ version: 1, preset: "completion-only" }),
      ),
      setItem: vi.fn(),
    };
    let current: ReturnType<typeof useGenerativeA11yPreferences> | undefined;
    function SetBeforePassiveStart() {
      current = useGenerativeA11yPreferences();
      useLayoutEffect(() => {
        current?.setPreferences({
          version: 1,
          preset: "minimal",
          streaming: "off",
          tools: "off",
        });
      }, []);
      return null;
    }
    render(
      <GenerativeA11yProvider
        preferences={{ persistence: { key: "pre-start", storage } }}
        dom={false}
      >
        <SetBeforePassiveStart />
      </GenerativeA11yProvider>,
    );
    expect(current?.preferences.preset).toBe("minimal");
    expect(storage.setItem).toHaveBeenCalledWith(
      "pre-start",
      JSON.stringify({
        version: 1,
        preset: "minimal",
        streaming: "off",
        tools: "off",
      }),
    );
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
  it("derives realm storage while preserving supplied preference events", () => {
    const { container, realmDocument, realmStorage, realmWindow } =
      createIframeRealm();
    const realmEvents = vi.spyOn(realmWindow, "addEventListener");
    const suppliedEvents = {
      subscribe: vi.fn(() => () => undefined),
    };
    render(
      <GenerativeA11yProvider
        preferences={{
          persistence: { key: "events-only", events: suppliedEvents },
        }}
      >
        <span />
      </GenerativeA11yProvider>,
      { container, baseElement: realmDocument.body },
    );
    expect(realmStorage.getItem).toHaveBeenCalledWith("events-only");
    expect(suppliedEvents.subscribe).toHaveBeenCalledTimes(1);
    expect(
      realmEvents.mock.calls.filter(([name]) => name === "storage"),
    ).toHaveLength(0);
  });

  it("derives realm events for supplied storage and accepts native storageArea", () => {
    const { container, realmDocument, realmStorage, realmWindow } =
      createIframeRealm();
    const suppliedStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    const realmEvents = vi.spyOn(realmWindow, "addEventListener");
    let preferenceSnapshot:
      ReturnType<typeof useGenerativeA11yPreferences> | undefined;
    function Probe() {
      preferenceSnapshot = useGenerativeA11yPreferences();
      return null;
    }
    render(
      <GenerativeA11yProvider
        preferences={{
          persistence: { key: "storage-only", storage: suppliedStorage },
        }}
      >
        <Probe />
      </GenerativeA11yProvider>,
      { container, baseElement: realmDocument.body },
    );
    expect(suppliedStorage.getItem).toHaveBeenCalledWith("storage-only");
    expect(
      realmEvents.mock.calls.filter(([name]) => name === "storage"),
    ).toHaveLength(1);
    act(() => {
      realmWindow.dispatchEvent(
        createRealmStorageEvent(
          realmDocument,
          "storage-only",
          JSON.stringify({ version: 1, preset: "completion-only" }),
          realmStorage,
        ),
      );
    });
    expect(preferenceSnapshot?.preferences.preset).toBe("completion-only");
  });

  it("preserves supplied preference storage and events together", () => {
    const { container, realmDocument, realmStorage, realmWindow } =
      createIframeRealm();
    const suppliedStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    const suppliedEvents = {
      subscribe: vi.fn(() => () => undefined),
    };
    const realmEvents = vi.spyOn(realmWindow, "addEventListener");
    render(
      <GenerativeA11yProvider
        preferences={{
          persistence: {
            key: "both",
            storage: suppliedStorage,
            events: suppliedEvents,
          },
        }}
      >
        <span />
      </GenerativeA11yProvider>,
      { container, baseElement: realmDocument.body },
    );
    expect(suppliedStorage.getItem).toHaveBeenCalledWith("both");
    expect(realmStorage.getItem).not.toHaveBeenCalled();
    expect(suppliedEvents.subscribe).toHaveBeenCalledTimes(1);
    expect(
      realmEvents.mock.calls.filter(([name]) => name === "storage"),
    ).toHaveLength(0);
  });

  it("derives owned browser services from the committed region document", () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    const iframe = document.createElement("iframe");
    document.body.append(iframe);
    const realmDocument = iframe.contentDocument;
    const realmWindow = iframe.contentWindow;
    if (!realmDocument || !realmWindow)
      throw new Error("iframe realm unavailable");
    Object.defineProperty(realmDocument, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const realmStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    };
    Object.defineProperty(realmWindow, "localStorage", {
      configurable: true,
      value: realmStorage,
    });
    const realmEvents = vi.spyOn(realmWindow, "addEventListener");
    const parentEvents = vi.spyOn(window, "addEventListener");
    let snapshot: ReturnType<typeof useGenerativeA11yAttention> | undefined;
    let preferenceSnapshot:
      ReturnType<typeof useGenerativeA11yPreferences> | undefined;
    function Probe() {
      snapshot = useGenerativeA11yAttention();
      preferenceSnapshot = useGenerativeA11yPreferences();
      return null;
    }
    const container = realmDocument.createElement("div");
    realmDocument.body.append(container);
    render(
      <GenerativeA11yProvider preferences={{ persistence: { key: "realm" } }}>
        <Probe />
      </GenerativeA11yProvider>,
      { container, baseElement: realmDocument.body },
    );
    expect(snapshot?.visibility).toBe("visible");
    expect(realmStorage.getItem).toHaveBeenCalledWith("realm");
    expect(
      realmEvents.mock.calls.filter(([name]) => name === "storage"),
    ).toHaveLength(1);
    expect(
      parentEvents.mock.calls.filter(([name]) => name === "storage"),
    ).toHaveLength(0);
    const storageEvent = realmDocument.createEvent("Event");
    storageEvent.initEvent("storage", false, false);
    Object.defineProperties(storageEvent, {
      key: { value: "realm" },
      newValue: {
        value: JSON.stringify({ version: 1, preset: "completion-only" }),
      },
      storageArea: { value: realmStorage },
    });
    act(() => {
      realmWindow.dispatchEvent(storageEvent);
    });
    expect(preferenceSnapshot?.preferences.preset).toBe("completion-only");
  });

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
