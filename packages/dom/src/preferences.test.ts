import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

import {
  createPreferenceStore,
  defaultPreferences,
  preferencesToCoreConfiguration,
  type PreferenceSchemaV1,
  type PreferenceStorage,
  type PreferenceStorageEvent,
  type PreferenceStorageEventSource,
} from "./preferences.js";
import * as publicAPI from "./index.js";

function balanced(
  streaming: Exclude<
    PreferenceSchemaV1,
    { preset: "completion-only" }
  >["streaming"] = "preset",
  tools: Exclude<
    PreferenceSchemaV1,
    { preset: "completion-only" }
  >["tools"] = "preset",
): PreferenceSchemaV1 {
  return { version: 1, preset: "balanced", streaming, tools };
}

class MemoryStorage implements PreferenceStorage {
  readonly values = new Map<string, string>();
  readonly getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  readonly setItem = vi.fn((key: string, value: string) => {
    this.values.set(key, value);
  });
}

class StorageEvents implements PreferenceStorageEventSource {
  readonly listeners = new Set<(event: PreferenceStorageEvent) => void>();
  readonly unsubscribe = vi.fn();
  readonly subscribe = vi.fn(
    (listener: (event: PreferenceStorageEvent) => void) => {
      this.listeners.add(listener);
      return () => {
        this.listeners.delete(listener);
        this.unsubscribe();
      };
    },
  );

  emit(event: PreferenceStorageEvent): void {
    for (const listener of [...this.listeners]) listener(event);
  }
}

describe("preference schema and core mapping", () => {
  it("exports one frozen balanced default with stable store identities", () => {
    expect(publicAPI.createPreferenceStore).toBe(createPreferenceStore);
    expect(publicAPI.defaultPreferences).toBe(defaultPreferences);
    expect(publicAPI.preferencesToCoreConfiguration).toBe(
      preferencesToCoreConfiguration,
    );
    expect(defaultPreferences).toEqual(balanced());
    expect(Object.isFrozen(defaultPreferences)).toBe(true);

    const store = createPreferenceStore();
    expect(store.getSnapshot()).toBe(defaultPreferences);
    expect(store.getServerSnapshot()).toBe(defaultPreferences);
  });

  it.each([
    null,
    [],
    {},
    { version: 2, preset: "balanced", streaming: "preset", tools: "preset" },
    { version: 1, preset: "completion-only", streaming: "preset" },
    { version: 1, preset: "balanced", streaming: "preset" },
    { version: 1, preset: "balanced", streaming: "tokens", tools: "preset" },
    { version: 1, preset: "balanced", streaming: "preset", tools: "all" },
    {
      version: 1,
      preset: "balanced",
      streaming: "preset",
      tools: "preset",
      extra: true,
    },
  ])("rejects invalid strict input %#", (value) => {
    expect(() =>
      preferencesToCoreConfiguration(value as PreferenceSchemaV1),
    ).toThrow(TypeError);
    const store = createPreferenceStore();
    expect(() => store.setPreferences(value as PreferenceSchemaV1)).toThrow(
      TypeError,
    );
  });

  it("rejects accessor-backed, mutating, symbol-extra, and hostile proxy inputs", () => {
    let reads = 0;
    const accessorValue = {
      version: 1,
      get preset() {
        reads += 1;
        return reads === 1 ? "balanced" : "verbose";
      },
      streaming: "preset",
      tools: "preset",
    } as unknown as PreferenceSchemaV1;
    const symbolValue = balanced() as PreferenceSchemaV1 & {
      [key: symbol]: unknown;
    };
    Object.defineProperty(symbolValue, Symbol("extra"), {
      enumerable: true,
      value: true,
    });
    const prototypeNamedExtra = balanced();
    Object.defineProperty(prototypeNamedExtra, "__proto__", {
      enumerable: true,
      value: true,
    });
    const proxyValue = new Proxy(balanced(), {
      ownKeys() {
        throw new Error("hostile ownKeys");
      },
    });

    for (const value of [
      accessorValue,
      symbolValue,
      prototypeNamedExtra,
      proxyValue,
    ]) {
      expect(() => preferencesToCoreConfiguration(value)).toThrow(TypeError);
      const store = createPreferenceStore();
      expect(() => store.setPreferences(value)).toThrow(TypeError);
      expect(store.getSnapshot()).toBe(defaultPreferences);
    }
    expect(reads).toBe(0);
  });

  it.each([
    ["preset", undefined],
    ["off", { strategy: "silent" }],
    [
      "completion",
      { strategy: "completion", minimumCharacters: 0, maximumDelayMs: 0 },
    ],
    ["paragraph", { strategy: "paragraph" }],
    ["sentence", { strategy: "sentence" }],
  ] as const)("maps streaming %s", (streaming, text) => {
    const configuration = preferencesToCoreConfiguration(
      balanced(streaming, "preset"),
    );
    expect(configuration).toEqual(
      text === undefined
        ? { preset: "balanced" }
        : { preset: "balanced", policy: { text } },
    );
  });

  it.each([
    ["preset", undefined],
    [
      "off",
      {
        announceStart: false,
        announceProgress: false,
        announceCompletion: false,
        announceFailure: false,
      },
    ],
    [
      "failures",
      {
        announceStart: false,
        announceProgress: false,
        announceCompletion: false,
        announceFailure: true,
      },
    ],
    [
      "status",
      {
        announceStart: true,
        announceProgress: false,
        announceCompletion: true,
        announceFailure: true,
      },
    ],
    [
      "progress",
      {
        announceStart: true,
        announceProgress: true,
        announceCompletion: true,
        announceFailure: true,
      },
    ],
  ] as const)("maps tools %s", (tools, mappedTools) => {
    const configuration = preferencesToCoreConfiguration(
      balanced("preset", tools),
    );
    expect(configuration).toEqual(
      mappedTools === undefined
        ? { preset: "balanced" }
        : { preset: "balanced", policy: { tools: mappedTools } },
    );
  });

  it("maps all presets and keeps completion-only free of overrides", () => {
    for (const preset of ["minimal", "balanced", "verbose"] as const) {
      expect(
        preferencesToCoreConfiguration({
          version: 1,
          preset,
          streaming: "sentence",
          tools: "progress",
        }),
      ).toMatchObject({ preset });
    }
    expect(
      preferencesToCoreConfiguration({ version: 1, preset: "completion-only" }),
    ).toEqual({ preset: "completion-only" });
  });
});

describe("preference persistence", () => {
  it("loads valid storage while preserving the configured server default", () => {
    const storage = new MemoryStorage();
    storage.values.set(
      "preferences",
      JSON.stringify({
        version: 1,
        preset: "minimal",
        streaming: "off",
        tools: "failures",
      }),
    );
    const configuredDefault = balanced("sentence", "progress");
    const store = createPreferenceStore({
      defaultValue: configuredDefault,
      persistence: { key: "preferences", storage },
    });

    expect(store.getSnapshot()).toEqual({
      version: 1,
      preset: "minimal",
      streaming: "off",
      tools: "failures",
    });
    expect(Object.isFrozen(store.getSnapshot())).toBe(true);
    expect(store.getServerSnapshot()).toEqual(configuredDefault);
    expect(store.getServerSnapshot()).not.toBe(store.getSnapshot());
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", null, undefined],
    ["corrupt", "{", "invalid-json"],
    [
      "invalid",
      JSON.stringify({ version: 1, preset: "balanced" }),
      "invalid-preference",
    ],
    [
      "forward version",
      JSON.stringify({ version: 2, preset: "balanced" }),
      "unsupported-version",
    ],
  ] as const)(
    "falls back for %s stored data without overwriting it",
    (_name, raw, code) => {
      const storage = new MemoryStorage();
      if (raw !== null) storage.values.set("p", raw);
      const diagnostics: unknown[] = [];
      const store = createPreferenceStore({
        persistence: { key: "p", storage },
        onDiagnostic: (value) => diagnostics.push(value),
      });

      expect(store.getSnapshot()).toBe(defaultPreferences);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(diagnostics).toEqual(
        code === undefined
          ? []
          : [expect.objectContaining({ source: "storage-read", code })],
      );
    },
  );

  it("diagnoses read failures with serializable errors and isolates diagnostics", () => {
    const storage = new MemoryStorage();
    storage.getItem.mockImplementation(() => {
      throw new Error("no access");
    });
    const seen: unknown[] = [];
    expect(() =>
      createPreferenceStore({
        persistence: { key: "p", storage },
        onDiagnostic: (diagnostic) => {
          seen.push(diagnostic);
          throw new Error("observer failure");
        },
      }),
    ).not.toThrow();
    expect(seen).toEqual([
      {
        source: "storage-read",
        code: "operation-failed",
        error: { name: "Error", message: "no access" },
      },
    ]);
    expect(JSON.parse(JSON.stringify(seen[0]))).toEqual(seen[0]);
  });

  it.each([
    new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype trap");
        },
      },
    ),
    Object.defineProperties(new Error("hidden"), {
      name: {
        get() {
          throw new Error("name trap");
        },
      },
      message: {
        get() {
          throw new Error("message trap");
        },
      },
    }),
    {
      [Symbol.toPrimitive]() {
        throw new Error("primitive trap");
      },
    },
  ])("never leaks hostile thrown values while reporting %#", (cause) => {
    const storage: PreferenceStorage = {
      getItem() {
        throw cause;
      },
      setItem() {},
    };
    const seen: unknown[] = [];

    expect(() =>
      createPreferenceStore({
        persistence: { key: "p", storage },
        onDiagnostic: (diagnostic) => seen.push(diagnostic),
      }),
    ).not.toThrow();
    expect(seen).toEqual([
      {
        source: "storage-read",
        code: "operation-failed",
        error: { name: "Error", message: "Unknown error" },
      },
    ]);
  });

  it("contains a throwing Error Symbol.hasInstance hook", () => {
    const previous = Object.getOwnPropertyDescriptor(Error, Symbol.hasInstance);
    const seen: unknown[] = [];
    try {
      Object.defineProperty(Error, Symbol.hasInstance, {
        configurable: true,
        value() {
          throw new Error("instance trap");
        },
      });
      const storage: PreferenceStorage = {
        getItem() {
          throw {};
        },
        setItem() {},
      };
      createPreferenceStore({
        persistence: { key: "p", storage },
        onDiagnostic: (diagnostic) => seen.push(diagnostic),
      });
    } finally {
      if (previous) {
        Object.defineProperty(Error, Symbol.hasInstance, previous);
      } else {
        Reflect.deleteProperty(Error, Symbol.hasInstance);
      }
    }
    expect(seen).toEqual([
      {
        source: "storage-read",
        code: "operation-failed",
        error: { name: "Error", message: "Unknown error" },
      },
    ]);
  });

  it("updates and notifies before writing canonical JSON", () => {
    const order: string[] = [];
    let stored: string | null = null;
    const storage: PreferenceStorage = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
        order.push(`write:${value}`);
      },
    };
    const store = createPreferenceStore({ persistence: { key: "p", storage } });
    store.subscribe(() => order.push(`notify:${store.getSnapshot().preset}`));
    const value = balanced("paragraph", "status");
    store.setPreferences(value);
    store.setPreferences({ ...value });

    expect(order).toEqual([
      "notify:balanced",
      `write:${JSON.stringify(value)}`,
    ]);
  });

  it("persists an explicit unchanged selection when storage is missing", () => {
    const storage = new MemoryStorage();
    const value = balanced("sentence", "progress");
    const store = createPreferenceStore({
      defaultValue: value,
      persistence: { key: "p", storage },
    });

    store.setPreferences({ ...value });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    store.setPreferences({ ...value });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it("does not rewrite an unchanged selection already stored canonically", () => {
    const storage = new MemoryStorage();
    const value = balanced("sentence", "progress");
    storage.values.set("p", JSON.stringify(value));
    const store = createPreferenceStore({
      defaultValue: value,
      persistence: { key: "p", storage },
    });

    store.setPreferences({ ...value });
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not persist a stale value after a reentrant storage read", () => {
    const storage = new MemoryStorage();
    const events = new StorageEvents();
    const value = balanced("paragraph", "status");
    const newer = balanced("sentence", "progress");
    const store = createPreferenceStore({
      defaultValue: value,
      persistence: { key: "p", storage, events },
    });
    storage.getItem.mockImplementation(() => {
      events.emit({
        key: "p",
        newValue: JSON.stringify(newer),
        storageArea: storage,
      });
      return null;
    });

    store.setPreferences({ ...value });

    expect(store.getSnapshot()).toEqual(newer);
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("does not let a reentrant listener persist an obsolete outer transition", () => {
    const storage = new MemoryStorage();
    const store = createPreferenceStore({ persistence: { key: "p", storage } });
    let nested = false;
    store.subscribe(() => {
      if (nested) return;
      nested = true;
      store.setPreferences(balanced("sentence", "progress"));
    });

    store.setPreferences(balanced("paragraph", "status"));
    expect(store.getSnapshot()).toEqual(balanced("sentence", "progress"));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.values.get("p")).toBe(
      JSON.stringify(balanced("sentence", "progress")),
    );
  });

  it("does not write when a listener disposes during notification", () => {
    const storage = new MemoryStorage();
    const store = createPreferenceStore({ persistence: { key: "p", storage } });
    store.subscribe(() => store.dispose());

    store.setPreferences(balanced("sentence", "progress"));
    expect(store.getSnapshot()).toEqual(balanced("sentence", "progress"));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it("keeps a successful update when writing fails", () => {
    const diagnostics: unknown[] = [];
    const storage: PreferenceStorage = {
      getItem: () => null,
      setItem: () => {
        throw "quota";
      },
    };
    const store = createPreferenceStore({
      persistence: { key: "p", storage },
      onDiagnostic: (value) => diagnostics.push(value),
    });
    store.setPreferences(balanced("sentence", "progress"));
    expect(store.getSnapshot()).toEqual(balanced("sentence", "progress"));
    expect(diagnostics).toEqual([
      {
        source: "storage-write",
        code: "operation-failed",
        error: { name: "Error", message: "quota" },
      },
    ]);
  });
});

describe("preference subscriptions and synchronization", () => {
  it("iterates a stable subscriber snapshot once per transition", () => {
    const store = createPreferenceStore();
    const calls: string[] = [];
    let unsubscribeSecond: () => void = () => undefined;
    const second = () => calls.push("second");
    store.subscribe(() => {
      calls.push("first");
      unsubscribeSecond();
      store.subscribe(second);
    });
    unsubscribeSecond = store.subscribe(second);

    store.setPreferences(balanced("off"));
    expect(calls).toEqual(["first", "second"]);
  });

  it("filters external events, applies valid changes, resets, and ignores echoes", () => {
    const storage = new MemoryStorage();
    const otherStorage = new MemoryStorage();
    const events = new StorageEvents();
    const diagnostics: unknown[] = [];
    const store = createPreferenceStore({
      persistence: { key: "p", storage, events },
      onDiagnostic: (value) => diagnostics.push(value),
    });
    const notify = vi.fn();
    store.subscribe(notify);
    const external = balanced("sentence", "progress");
    const raw = JSON.stringify(external);

    events.emit({ key: "other", newValue: raw, storageArea: storage });
    events.emit({ key: "p", newValue: raw, storageArea: otherStorage });
    expect(notify).not.toHaveBeenCalled();
    events.emit({ key: "p", newValue: raw, storageArea: storage });
    expect(store.getSnapshot()).toEqual(external);
    expect(notify).toHaveBeenCalledTimes(1);
    events.emit({ key: "p", newValue: raw, storageArea: storage });
    expect(notify).toHaveBeenCalledTimes(1);
    events.emit({ key: "p", newValue: null, storageArea: storage });
    expect(store.getSnapshot()).toBe(defaultPreferences);
    events.emit({ key: null, newValue: null, storageArea: storage });
    expect(notify).toHaveBeenCalledTimes(2);
    expect(storage.setItem).not.toHaveBeenCalled();

    for (const [value, code] of [
      ["{", "invalid-json"],
      [
        JSON.stringify({ version: 1, preset: "balanced" }),
        "invalid-preference",
      ],
      [JSON.stringify({ version: 3 }), "unsupported-version"],
    ] as const) {
      events.emit({ key: "p", newValue: value, storageArea: storage });
      expect(diagnostics.at(-1)).toEqual(
        expect.objectContaining({ source: "storage-event", code }),
      );
      expect(store.getSnapshot()).toBe(defaultPreferences);
    }
  });

  it("lets a reentrant newer storage event win over the outer event", () => {
    const storage = new MemoryStorage();
    const events = new StorageEvents();
    const store = createPreferenceStore({
      persistence: { key: "p", storage, events },
    });
    let keyReads = 0;
    let valueReads = 0;
    let areaReads = 0;
    const outer = {
      get key() {
        keyReads += 1;
        return "p";
      },
      get newValue() {
        valueReads += 1;
        events.emit({
          key: "p",
          newValue: JSON.stringify(balanced("sentence", "progress")),
          storageArea: storage,
        });
        return JSON.stringify(balanced("paragraph", "status"));
      },
      get storageArea() {
        areaReads += 1;
        return storage;
      },
    } as PreferenceStorageEvent;

    events.emit(outer);
    expect(store.getSnapshot()).toEqual(balanced("sentence", "progress"));
    expect({ keyReads, valueReads, areaReads }).toEqual({
      keyReads: 1,
      valueReads: 1,
      areaReads: 1,
    });
  });

  it("does not commit an event whose getter disposes the store", () => {
    const storage = new MemoryStorage();
    const events = new StorageEvents();
    const store = createPreferenceStore({
      persistence: { key: "p", storage, events },
    });
    events.emit({
      key: "p",
      newValue: JSON.stringify(balanced("off")),
      get storageArea() {
        store.dispose();
        return storage;
      },
    });
    expect(store.getSnapshot()).toBe(defaultPreferences);
  });

  it("synchronizes two stores only through an injected broadcaster", () => {
    const events = new StorageEvents();
    const storage = new MemoryStorage();
    storage.setItem.mockImplementation((key, value) => {
      storage.values.set(key, value);
      events.emit({ key, newValue: value, storageArea: storage });
    });
    const options = { persistence: { key: "p", storage, events } } as const;
    const first = createPreferenceStore(options);
    const second = createPreferenceStore(options);
    const secondListener = vi.fn();
    second.subscribe(secondListener);

    first.setPreferences(balanced("completion", "failures"));
    expect(second.getSnapshot()).toEqual(first.getSnapshot());
    expect(secondListener).toHaveBeenCalledTimes(1);
  });

  it("rejects a storage-area event when no matching storage is configured", () => {
    const events = new StorageEvents();
    const store = createPreferenceStore({ persistence: { key: "p", events } });
    events.emit({
      key: "p",
      newValue: JSON.stringify(balanced("sentence")),
      storageArea: new MemoryStorage(),
    });
    expect(store.getSnapshot()).toBe(defaultPreferences);
  });

  it("contains event setup and teardown failures and ignores stale callbacks", () => {
    let stale: ((event: PreferenceStorageEvent) => void) | undefined;
    const diagnostics: unknown[] = [];
    const events: PreferenceStorageEventSource = {
      subscribe(listener) {
        stale = listener;
        return () => {
          throw new Error("unsubscribe failed");
        };
      },
    };
    const store = createPreferenceStore({
      persistence: { key: "p", storage: new MemoryStorage(), events },
      onDiagnostic: (value) => diagnostics.push(value),
    });
    store.dispose();
    store.dispose();
    stale?.({ key: "p", newValue: JSON.stringify(balanced("off")) });
    expect(store.getSnapshot()).toBe(defaultPreferences);
    expect(diagnostics).toEqual([
      expect.objectContaining({
        source: "event-unsubscribe",
        code: "operation-failed",
      }),
    ]);
    expect(() => store.subscribe(() => undefined)).toThrow(/disposed/);
    expect(() => store.setPreferences(balanced())).toThrow(/disposed/);
    expect(store.getServerSnapshot()).toBe(defaultPreferences);
  });

  it("contains hostile unsubscribe errors and reentrant diagnostic disposal", () => {
    const hostile = Object.defineProperties(new Error(), {
      name: {
        get() {
          throw new Error("name trap");
        },
      },
      message: {
        get() {
          throw new Error("message trap");
        },
      },
    });
    const diagnostics: unknown[] = [];
    let store: ReturnType<typeof createPreferenceStore>;
    store = createPreferenceStore({
      persistence: {
        key: "p",
        storage: new MemoryStorage(),
        events: {
          subscribe: () => () => {
            throw hostile;
          },
        },
      },
      onDiagnostic: (diagnostic) => {
        diagnostics.push(diagnostic);
        store.dispose();
      },
    });

    expect(() => store.dispose()).not.toThrow();
    expect(diagnostics).toEqual([
      {
        source: "event-unsubscribe",
        code: "operation-failed",
        error: { name: "Error", message: "Unknown error" },
      },
    ]);
  });

  it("diagnoses a throwing event subscription and remains usable", () => {
    const diagnostics: unknown[] = [];
    const store = createPreferenceStore({
      persistence: {
        key: "p",
        storage: new MemoryStorage(),
        events: {
          subscribe: () => {
            throw new Error("subscribe failed");
          },
        },
      },
      onDiagnostic: (value) => diagnostics.push(value),
    });
    store.setPreferences(balanced("paragraph"));
    expect(store.getSnapshot()).toEqual(balanced("paragraph"));
    expect(diagnostics).toEqual([
      expect.objectContaining({
        source: "event-subscribe",
        code: "operation-failed",
      }),
    ]);
  });

  it("uses browser localStorage and native storage events only when persistence opts in", () => {
    const dom = new JSDOM();
    const storage = new MemoryStorage();
    Object.defineProperty(dom.window, "localStorage", { value: storage });
    const add = vi.spyOn(dom.window, "addEventListener");
    const remove = vi.spyOn(dom.window, "removeEventListener");
    vi.stubGlobal("window", dom.window);
    try {
      const store = createPreferenceStore({ persistence: { key: "p" } });
      expect(add).toHaveBeenCalledWith("storage", expect.any(Function));
      const listener = add.mock.calls.find(([type]) => type === "storage")?.[1];
      expect(listener).toBeTypeOf("function");
      (listener as EventListener)({
        key: "p",
        newValue: JSON.stringify(balanced("sentence")),
        storageArea: storage,
      } as unknown as Event);
      expect(store.getSnapshot()).toEqual(balanced("sentence"));
      store.dispose();
      expect(remove).toHaveBeenCalledWith("storage", listener);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("remains an in-memory store when browser globals are unavailable", () => {
    expect(typeof window).toBe("undefined");
    const store = createPreferenceStore({ persistence: { key: "p" } });
    store.setPreferences(balanced("completion", "failures"));
    expect(store.getSnapshot()).toEqual(balanced("completion", "failures"));
  });
});
