// @vitest-environment jsdom

import { ManualClock, createRuntime } from "@generative-a11y/core";
import {
  createAttentionStore,
  createPreferenceStore,
  type AttentionSnapshot,
  type AttentionStore,
  type PreferenceStore,
  type PreferenceSchemaV1,
  type PreferenceStoreOptions,
} from "@generative-a11y/dom";
import { act, render, renderHook, screen } from "@testing-library/react";
import * as React from "react";
import { StrictMode, useLayoutEffect, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  A11yProvider,
  useA11y,
  useAttention,
  useAttentionRefs,
  usePreferences,
  useRuntime,
} from "./index.js";

type ActivityComponent = (props: {
  mode: "visible" | "hidden";
  children?: ReactNode;
}) => ReactNode;
const Activity = (React as typeof React & { Activity?: ActivityComponent })
  .Activity;

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
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
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

describe("A11yProvider", () => {
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
      return <span>{useRuntime().getPolicy().text.strategy}</span>;
    }
    expect(
      renderToString(
        <A11yProvider preferenceStore={store} delivery={false}>
          <Policy />
        </A11yProvider>,
      ),
    ).toContain("completion");
  });

  it("does not read an irrelevant hostile preference store", () => {
    const runtime = createRuntime({ onAnnouncement: () => undefined });
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
        <A11yProvider
          runtime={runtime}
          preferenceStore={store}
          delivery={false}
        >
          <span />
        </A11yProvider>,
      ),
    ).not.toThrow();
    runtime.dispose();

    const view = render(
      <A11yProvider preset="verbose" preferenceStore={store} delivery={false}>
        <span />
      </A11yProvider>,
    );
    expect(view.container.querySelector("span")).toBeTruthy();
    view.unmount();
  });

  it("creates a runtime and exposes a stable context", () => {
    const values: unknown[] = [];
    function Probe() {
      const value = useA11y();
      values.push(value);
      return <span>{value.runtime.getPolicy().text.strategy}</span>;
    }
    const view = render(
      <A11yProvider delivery={false}>
        <Probe />
      </A11yProvider>,
    );
    view.rerender(
      <A11yProvider delivery={false}>
        <Probe />
      </A11yProvider>,
    );
    expect(screen.getByText("sentence")).toBeTruthy();
    expect(values[0]).toBe(values[1]);
  });

  it("uses but never disposes an external runtime", async () => {
    const runtime = createRuntime({ onAnnouncement: () => undefined });
    const dispose = vi.spyOn(runtime, "dispose");
    const { result, unmount } = renderHook(() => useRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider runtime={runtime} delivery={false}>
          {children}
        </A11yProvider>
      ),
    });
    expect(result.current).toBe(runtime);
    unmount();
    await flushCleanup();
    expect(dispose).not.toHaveBeenCalled();
    runtime.dispose();
  });

  it("does not dispose an owned runtime during a Strict Mode probe", async () => {
    let runtime: ReturnType<typeof useRuntime> | undefined;
    function Probe() {
      runtime = useRuntime();
      return null;
    }
    const view = render(
      <StrictMode>
        <A11yProvider delivery={false}>
          <Probe />
        </A11yProvider>
      </StrictMode>,
    );
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "r" }),
    ).not.toThrow();
    view.unmount();
    await flushCleanup();
    expect(
      runtime?.dispatch({ type: "response.started", responseId: "later" }),
    ).toBe(false);
  });

  it("disposes owned attention and preference stores after a real unmount", async () => {
    let context: ReturnType<typeof useA11y> | undefined;
    function Probe() {
      context = useA11y();
      return null;
    }
    const view = render(
      <StrictMode>
        <A11yProvider delivery={false}>
          <Probe />
        </A11yProvider>
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
    const first = createRuntime({ onAnnouncement: () => undefined });
    const second = createRuntime({ onAnnouncement: () => undefined });
    const view = render(
      <A11yProvider runtime={first} delivery={false}>
        <span />
      </A11yProvider>,
    );
    expect(() =>
      view.rerender(
        <A11yProvider runtime={second} delivery={false}>
          <span />
        </A11yProvider>,
      ),
    ).toThrow("runtime cannot change");
    first.dispose();
    second.dispose();
  });

  it("keeps the provider outside a disconnected Activity boundary", async () => {
    if (!Activity) return;
    let runtime: ReturnType<typeof useRuntime> | undefined;
    function Probe() {
      runtime = useRuntime();
      return null;
    }
    const view = render(
      <A11yProvider delivery={false}>
        <Activity mode="visible">
          <Probe />
        </Activity>
      </A11yProvider>,
    );
    view.rerender(
      <A11yProvider delivery={false}>
        <Activity mode="hidden">
          <Probe />
        </Activity>
      </A11yProvider>,
    );
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "activity" }),
    ).not.toThrow();
  });

  it("restarts owned resources when Activity hides and shows the provider", async () => {
    if (!Activity) return;
    let runtime: ReturnType<typeof useRuntime> | undefined;
    function Probe() {
      runtime = useRuntime();
      return null;
    }
    const view = render(
      <Activity mode="visible">
        <A11yProvider delivery={false}>
          <Probe />
        </A11yProvider>
      </Activity>,
    );
    view.rerender(
      <Activity mode="hidden">
        <A11yProvider delivery={false}>
          <Probe />
        </A11yProvider>
      </Activity>,
    );
    view.rerender(
      <Activity mode="visible">
        <A11yProvider delivery={false}>
          <Probe />
        </A11yProvider>
      </Activity>,
    );
    await flushCleanup();
    expect(() =>
      runtime?.dispatch({ type: "response.started", responseId: "restart" }),
    ).not.toThrow();
  });

  it("supports isolated nested providers and nearest context", () => {
    const outer = createRuntime({ onAnnouncement: () => undefined });
    const inner = createRuntime({ onAnnouncement: () => undefined });
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useRuntime());
      return null;
    }
    render(
      <A11yProvider runtime={outer} delivery={false}>
        <Probe />
        <A11yProvider runtime={inner} delivery={false}>
          <Probe />
        </A11yProvider>
      </A11yProvider>,
    );
    expect(seen).toEqual([outer, inner]);
    outer.dispose();
    inner.dispose();
  });

  it("captures initial construction and DOM configuration", () => {
    const view = render(
      <A11yProvider preset="minimal" delivery={false}>
        <span />
      </A11yProvider>,
    );
    view.rerender(
      <A11yProvider preset="verbose">
        <span />
      </A11yProvider>,
    );
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("rolls back transactional startup when a managed store fails", () => {
    let runtime: ReturnType<typeof useRuntime> | undefined;
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
      runtime = useRuntime();
      return null;
    }
    expect(() =>
      render(
        <A11yProvider preferences={preferenceOptions}>
          <Probe />
        </A11yProvider>,
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
    expect(
      runtime?.dispatch({ type: "response.started", responseId: "stale" }),
    ).toBe(false);
  });

  it("throws clear errors for every hook outside a provider", () => {
    for (const hook of [
      useA11y,
      useRuntime,
      useAttention,
      useAttentionRefs,
      usePreferences,
    ]) {
      expect(() => renderHook(() => hook())).toThrow(
        "must be used within A11yProvider",
      );
    }
  });
});

describe("DOM delivery", () => {
  it("moves live regions outside the provider host markup", () => {
    const host = document.createElement("section");
    document.body.append(host);
    const view = render(
      <A11yProvider>
        <span>Host UI</span>
      </A11yProvider>,
      { container: host },
    );

    expect(host.querySelector("[aria-live]")).toBeNull();
    expect(document.body.querySelectorAll("[aria-live]")).toHaveLength(2);
    view.unmount();
  });

  it("server-renders stable hidden regions without announcements", () => {
    const html = renderToString(
      <A11yProvider>
        <main>Host UI</main>
      </A11yProvider>,
    );
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('aria-atomic="true"');
    expect(html).toContain('aria-relevant="additions text"');
    expect(html).toContain("Host UI");
    expect(html).not.toContain('role="');
  });

  it("pre-mounts regions before a child layout effect dispatches", async () => {
    const clock = new ManualClock();
    function Dispatch() {
      const runtime = useRuntime();
      useLayoutEffect(() => {
        runtime.dispatch({ type: "response.started", responseId: "r" });
      }, [runtime]);
      return null;
    }
    render(
      <A11yProvider clock={clock} preset="verbose">
        <Dispatch />
      </A11yProvider>,
    );
    await act(async () => {
      clock.runUntilIdle();
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Assistant is responding.",
    );
  });

  it("does not render or install regions when DOM delivery is disabled", () => {
    render(
      <A11yProvider delivery={false}>
        <main>Host UI</main>
      </A11yProvider>,
    );
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("hydrates without duplicate bindings or announcements", async () => {
    const clock = new ManualClock();
    const runtime = createRuntime({ preset: "verbose", clock });
    const app = (
      <A11yProvider runtime={runtime}>
        <main>Host UI</main>
      </A11yProvider>
    );
    const container = document.createElement("div");
    container.innerHTML = renderToString(app);
    document.body.append(container);
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, app);
    });
    await act(async () => {
      runtime.dispatch({ type: "response.started", responseId: "one" });
    });
    await act(async () => {
      clock.runUntilIdle();
    });
    expect(document.querySelector('[aria-live="polite"]')?.textContent).toBe(
      "Assistant is responding.",
    );
    act(() => root.unmount());
    runtime.dispose();
  });

  it("keeps one active binding through Strict Mode probes and rerenders", () => {
    const clock = new ManualClock();
    const runtime = createRuntime({ preset: "verbose", clock });
    const diagnostics = vi.fn();
    const app = (label: string) => (
      <StrictMode>
        <A11yProvider runtime={runtime} delivery={{ onDelivery: diagnostics }}>
          <main>{label}</main>
        </A11yProvider>
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
    const first = createRuntime({
      preset: "verbose",
      clock: firstClock,
    });
    const second = createRuntime({
      preset: "verbose",
      clock: secondClock,
    });
    render(
      <>
        <section data-testid="first-provider">
          <A11yProvider runtime={first}>
            <span />
          </A11yProvider>
        </section>
        <section data-testid="second-provider">
          <A11yProvider runtime={second}>
            <span />
          </A11yProvider>
        </section>
      </>,
    );
    act(() => {
      first.dispatch({ type: "response.started", responseId: "first" });
      firstClock.runUntilIdle();
    });
    const politeRegions = document.querySelectorAll('[aria-live="polite"]');
    expect(politeRegions).toHaveLength(2);
    expect(politeRegions[0]?.textContent).toBe("Assistant is responding.");
    expect(politeRegions[1]?.textContent).toBe("");
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
    const { result } = renderHook(() => useRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider
          preferences={{ defaultValue: preference }}
          delivery={false}
        >
          {children}
        </A11yProvider>
      ),
    });
    expect(result.current.getPolicy().text.strategy).toBe("completion");
    expect(snapshotCount).toBe(1);
  });

  it("observes defaults and updates without resetting the active runtime", () => {
    let runtime: ReturnType<typeof useRuntime> | undefined;
    const { result } = renderHook(
      () => {
        runtime = useRuntime();
        return usePreferences();
      },
      { wrapper: A11yProvider },
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
      const { setPreferences } = usePreferences();
      useLayoutEffect(() => {
        setPreferences({ version: 1, preset: "invalid" } as never);
      }, [setPreferences]);
      return null;
    }
    expect(() =>
      render(
        <A11yProvider delivery={false}>
          <InvalidUpdate />
        </A11yProvider>,
      ),
    ).toThrow("Invalid preference preset");
  });

  it("uses an external preference snapshot for initial owned runtime policy", () => {
    const store = createPreferenceStore({
      defaultValue: { version: 1, preset: "completion-only" },
    });
    const { result, unmount } = renderHook(
      () => ({
        policy: useRuntime().getPolicy(),
        preferences: usePreferences(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <A11yProvider preferenceStore={store} delivery={false}>
            {children}
          </A11yProvider>
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
    const { result } = renderHook(() => useRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider preferenceStore={store} delivery={false}>
          {children}
        </A11yProvider>
      ),
    });
    expect(getSnapshot).toHaveBeenCalled();
    expect(result.current.getPolicy().text.strategy).toBe("completion");
  });

  it("explicit runtime configuration wins over preferences", () => {
    const store = createPreferenceStore({
      defaultValue: { version: 1, preset: "completion-only" },
    });
    const { result } = renderHook(() => useRuntime(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider preferenceStore={store} preset="verbose" delivery={false}>
          {children}
        </A11yProvider>
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
        policy: useRuntime().getPolicy(),
        preference: usePreferences(),
      }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <A11yProvider
            preferences={{ persistence: { key: "test", storage } }}
            delivery={false}
          >
            {children}
          </A11yProvider>
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
    let current: ReturnType<typeof usePreferences> | undefined;
    function SetBeforePassiveStart() {
      current = usePreferences();
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
      <A11yProvider
        preferences={{ persistence: { key: "pre-start", storage } }}
        delivery={false}
      >
        <SetBeforePassiveStart />
      </A11yProvider>,
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
    const { result } = renderHook(() => usePreferences(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider
          preferences={{
            persistence: { key: "test", storage },
            onDiagnostic: diagnostics,
          }}
          delivery={false}
        >
          {children}
        </A11yProvider>
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
      <A11yProvider
        preferenceStore={preferenceStore}
        attentionStore={attentionStore}
        delivery={false}
      >
        <span />
      </A11yProvider>,
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
  it("preserves receivers for borrowed store methods", () => {
    class ReceiverAttentionStore implements AttentionStore {
      readonly snapshot: AttentionSnapshot = {
        visibility: "visible",
        windowFocus: "focused",
        focusArea: "none",
        newestResponse: "unobserved",
        mode: "unknown",
      };
      readonly listeners = new Set<() => void>();

      subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      }
      getSnapshot(): AttentionSnapshot {
        return this.snapshot;
      }
      getServerSnapshot(): AttentionSnapshot {
        return this.snapshot;
      }
      registerComposer(): () => void {
        return () => undefined;
      }
      registerConversation(): () => void {
        return () => undefined;
      }
      registerNewestResponse(): () => void {
        return () => undefined;
      }
      dispose(): void {
        this.listeners.clear();
      }
    }

    class ReceiverPreferenceStore implements PreferenceStore {
      snapshot: PreferenceSchemaV1 = { version: 1, preset: "completion-only" };
      readonly listeners = new Set<() => void>();

      subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      }
      getSnapshot() {
        return this.snapshot;
      }
      getServerSnapshot() {
        return this.snapshot;
      }
      setPreferences(value: PreferenceSchemaV1): void {
        this.snapshot = value;
        for (const listener of this.listeners) listener();
      }
      dispose(): void {
        this.listeners.clear();
      }
    }

    const attentionStore = new ReceiverAttentionStore();
    const preferenceStore = new ReceiverPreferenceStore();
    function Probe() {
      const attention = useAttention();
      const preferences = usePreferences();
      return (
        <output>
          {attention.visibility}:{preferences.preferences.preset}
        </output>
      );
    }
    render(
      <A11yProvider
        attentionStore={attentionStore}
        preferenceStore={preferenceStore}
        delivery={false}
      >
        <Probe />
      </A11yProvider>,
    );
    expect(screen.getByText("visible:completion-only")).toBeTruthy();
  });

  it("derives realm storage while preserving supplied preference events", () => {
    const { container, realmDocument, realmStorage, realmWindow } =
      createIframeRealm();
    const realmEvents = vi.spyOn(realmWindow, "addEventListener");
    const suppliedEvents = {
      subscribe: vi.fn(() => () => undefined),
    };
    render(
      <A11yProvider
        preferences={{
          persistence: { key: "events-only", events: suppliedEvents },
        }}
      >
        <span />
      </A11yProvider>,
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
    let preferenceSnapshot: ReturnType<typeof usePreferences> | undefined;
    function Probe() {
      preferenceSnapshot = usePreferences();
      return null;
    }
    render(
      <A11yProvider
        preferences={{
          persistence: { key: "storage-only", storage: suppliedStorage },
        }}
      >
        <Probe />
      </A11yProvider>,
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
      <A11yProvider
        preferences={{
          persistence: {
            key: "both",
            storage: suppliedStorage,
            events: suppliedEvents,
          },
        }}
      >
        <span />
      </A11yProvider>,
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
    let snapshot: ReturnType<typeof useAttention> | undefined;
    let preferenceSnapshot: ReturnType<typeof usePreferences> | undefined;
    function Probe() {
      snapshot = useAttention();
      preferenceSnapshot = usePreferences();
      return null;
    }
    const container = realmDocument.createElement("div");
    realmDocument.body.append(container);
    render(
      <A11yProvider preferences={{ persistence: { key: "realm" } }}>
        <Probe />
      </A11yProvider>,
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
    const { result } = renderHook(() => useAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider attention={false} delivery={false}>
          {children}
        </A11yProvider>
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
    const { result } = renderHook(() => useAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider attentionStore={store} delivery={false}>
          {children}
        </A11yProvider>
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
    const { result } = renderHook(() => useAttention(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <A11yProvider attention={{ document }} delivery={false}>
          {children}
        </A11yProvider>
      ),
    });
    expect(result.current.visibility).toBe("hidden");
    expect(result.current.mode).toBe("background");
  });

  it("registers, replaces, and unregisters binding refs", () => {
    const store = createAttentionStore({ document });
    function Fixture({ alternate = false }: { alternate?: boolean }) {
      const bindings = useAttentionRefs();
      const attention = useAttention();
      return (
        <>
          {alternate ? (
            <textarea data-testid="alternate" ref={bindings.composerRef} />
          ) : (
            <textarea data-testid="composer" ref={bindings.composerRef} />
          )}
          <div ref={bindings.conversationRef}>
            <span data-testid="history" />
          </div>
          <div ref={bindings.newestResponseRef} />
          <output>{attention.focusArea}</output>
        </>
      );
    }
    const view = render(
      <A11yProvider attentionStore={store} delivery={false}>
        <Fixture />
      </A11yProvider>,
    );
    act(() => screen.getByTestId("composer").focus());
    expect(screen.getByText("composer")).toBeTruthy();
    view.rerender(
      <A11yProvider attentionStore={store} delivery={false}>
        <Fixture alternate />
      </A11yProvider>,
    );
    act(() => screen.getByTestId("alternate").focus());
    expect(screen.getByText("composer")).toBeTruthy();
    view.unmount();
    store.dispose();
  });

  it("replays binding refs registered before owned attention installation", () => {
    function Fixture() {
      const bindings = useAttentionRefs();
      const attention = useAttention();
      return (
        <>
          <textarea data-testid="owned-composer" ref={bindings.composerRef} />
          <output>{attention.focusArea}</output>
        </>
      );
    }
    render(
      <A11yProvider attention={{ document }} delivery={false}>
        <Fixture />
      </A11yProvider>,
    );
    const composer = screen.getByTestId("owned-composer");
    act(() => composer.focus());
    expect(screen.getByText("composer")).toBeTruthy();
  });

  it("does not move focus or scroll while installing bindings", () => {
    const before = document.activeElement;
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    function Fixture() {
      const bindings = useAttentionRefs();
      return <textarea ref={bindings.composerRef} />;
    }
    render(
      <A11yProvider delivery={false}>
        <Fixture />
      </A11yProvider>,
    );
    expect(document.activeElement).toBe(before);
    expect(focus).not.toHaveBeenCalled();
  });
});
