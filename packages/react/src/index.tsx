import {
  createGenerativeA11y,
  type GenerativeA11yOptions,
  type GenerativeA11yRuntime,
} from "@generative-a11y/core";
import {
  connectRuntimeToDOM,
  createAttentionStore,
  createPreferenceStore,
  defaultPreferences,
  preferencesToCoreConfiguration,
  type AttentionSnapshot,
  type AttentionStore,
  type AttentionStoreOptions,
  type DOMAnnouncerOptions,
  type DOMRuntimeBinding,
  type PreferenceSchemaV1,
  type PreferenceStore,
  type PreferenceStoreOptions,
} from "@generative-a11y/dom";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefCallback,
} from "react";

export type GenerativeA11yDOMOptions = Omit<
  DOMAnnouncerOptions,
  "document" | "regions"
>;

export interface GenerativeA11yProviderProps extends GenerativeA11yOptions {
  readonly children?: ReactNode;
  readonly runtime?: GenerativeA11yRuntime;
  readonly dom?: false | GenerativeA11yDOMOptions;
  readonly attention?: false | AttentionStoreOptions;
  readonly attentionStore?: AttentionStore;
  readonly preferences?: PreferenceStoreOptions;
  readonly preferenceStore?: PreferenceStore;
}

export interface GenerativeA11yContextValue {
  readonly runtime: GenerativeA11yRuntime;
  readonly attentionStore: AttentionStore;
  readonly preferenceStore: PreferenceStore;
}

export interface GenerativeA11yPreferencesResult {
  readonly preferences: PreferenceSchemaV1;
  readonly setPreferences: (preferences: PreferenceSchemaV1) => void;
  readonly store: PreferenceStore;
}

export interface GenerativeA11yComposerProps {
  readonly ref: RefCallback<HTMLTextAreaElement>;
}

export interface GenerativeA11yConversationProps {
  readonly ref: RefCallback<HTMLElement>;
}

export interface GenerativeA11yNewestResponseProps {
  readonly ref: RefCallback<HTMLElement>;
}

export interface GenerativeA11yBindings {
  readonly composerProps: GenerativeA11yComposerProps;
  readonly conversationProps: GenerativeA11yConversationProps;
  readonly newestResponseProps: GenerativeA11yNewestResponseProps;
}

const UNKNOWN_ATTENTION: AttentionSnapshot = Object.freeze({
  visibility: "unknown",
  windowFocus: "unknown",
  focusArea: "unknown",
  newestResponse: "unknown",
  mode: "unknown",
});

const visuallyHiddenStyle: CSSProperties = Object.freeze({
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0,
});

class InertAttentionStore implements AttentionStore {
  subscribe = (): (() => void) => () => undefined;
  getSnapshot = (): AttentionSnapshot => UNKNOWN_ATTENTION;
  getServerSnapshot = (): AttentionSnapshot => UNKNOWN_ATTENTION;
  registerComposer = (): (() => void) => () => undefined;
  registerConversation = (): (() => void) => () => undefined;
  registerNewestResponse = (): (() => void) => () => undefined;
  dispose = (): void => undefined;
}

class ManagedAttentionStore implements AttentionStore {
  readonly #options: AttentionStoreOptions;
  readonly #listeners = new Set<() => void>();
  readonly #registrations = new Map<
    number,
    {
      kind: "composer" | "conversation" | "newest";
      element: Element;
      unregister: (() => void) | undefined;
    }
  >();
  #nextRegistration = 1;
  #store: AttentionStore | undefined;
  #unsubscribe: (() => void) | undefined;
  #snapshot: AttentionSnapshot = UNKNOWN_ATTENTION;
  #disposed = false;

  constructor(options: AttentionStoreOptions) {
    this.#options = options;
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.#disposed) throw new Error("AttentionStore is disposed");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): AttentionSnapshot => this.#snapshot;

  getServerSnapshot = (): AttentionSnapshot => UNKNOWN_ATTENTION;

  start(): void {
    if (this.#disposed) throw new Error("AttentionStore is disposed");
    if (this.#store) return;
    const store = createAttentionStore(this.#options);
    this.#store = store;
    this.#unsubscribe = store.subscribe(() =>
      this.#replace(store.getSnapshot()),
    );
    for (const registration of this.#registrations.values()) {
      registration.unregister = registerAttention(store, registration);
    }
    this.#replace(store.getSnapshot());
  }

  stop(): void {
    const store = this.#store;
    if (!store) return;
    this.#store = undefined;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    for (const registration of this.#registrations.values()) {
      registration.unregister = undefined;
    }
    store.dispose();
    this.#replace(UNKNOWN_ATTENTION);
  }

  registerComposer = (element: Element): (() => void) =>
    this.#register("composer", element);

  registerConversation = (element: Element): (() => void) =>
    this.#register("conversation", element);

  registerNewestResponse = (element: Element): (() => void) =>
    this.#register("newest", element);

  dispose = (): void => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#listeners.clear();
    this.#registrations.clear();
  };

  #replace(next: AttentionSnapshot): void {
    if (this.#snapshot === next) return;
    this.#snapshot = next;
    for (const listener of [...this.#listeners]) safelyNotify(listener);
  }

  #register(
    kind: "composer" | "conversation" | "newest",
    element: Element,
  ): () => void {
    if (this.#disposed) throw new Error("AttentionStore is disposed");
    const id = this.#nextRegistration++;
    const registration = { kind, element, unregister: undefined } as {
      kind: "composer" | "conversation" | "newest";
      element: Element;
      unregister: (() => void) | undefined;
    };
    this.#registrations.set(id, registration);
    if (this.#store)
      registration.unregister = registerAttention(this.#store, registration);
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.#registrations.delete(id);
      registration.unregister?.();
    };
  }
}

class ManagedPreferenceStore implements PreferenceStore {
  readonly #options: PreferenceStoreOptions;
  readonly #listeners = new Set<() => void>();
  readonly #serverSnapshot: PreferenceSchemaV1;
  #snapshot: PreferenceSchemaV1;
  #store: PreferenceStore | undefined;
  #unsubscribe: (() => void) | undefined;
  #disposed = false;

  constructor(options: PreferenceStoreOptions) {
    this.#options = options;
    this.#serverSnapshot = normalizeManagedPreferences(
      options.defaultValue ?? defaultPreferences,
    );
    this.#snapshot = this.#serverSnapshot;
  }

  subscribe = (listener: () => void): (() => void) => {
    if (this.#disposed) throw new Error("PreferenceStore is disposed");
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  getSnapshot = (): PreferenceSchemaV1 => this.#snapshot;

  getServerSnapshot = (): PreferenceSchemaV1 => this.#serverSnapshot;

  setPreferences = (value: PreferenceSchemaV1): void => {
    if (this.#disposed) throw new Error("PreferenceStore is disposed");
    if (this.#store) {
      this.#store.setPreferences(value);
      return;
    }
    this.#replace(normalizeManagedPreferences(value));
  };

  start(): void {
    if (this.#disposed) throw new Error("PreferenceStore is disposed");
    if (this.#store) return;
    const store = createPreferenceStore(this.#options);
    this.#store = store;
    this.#unsubscribe = store.subscribe(() =>
      this.#replace(store.getSnapshot()),
    );
    this.#replace(store.getSnapshot());
  }

  stop(): void {
    const store = this.#store;
    if (!store) return;
    this.#store = undefined;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;
    store.dispose();
  }

  dispose = (): void => {
    if (this.#disposed) return;
    this.#disposed = true;
    this.stop();
    this.#listeners.clear();
  };

  #replace(next: PreferenceSchemaV1): void {
    if (samePreferences(this.#snapshot, next)) return;
    this.#snapshot = next;
    for (const listener of [...this.#listeners]) safelyNotify(listener);
  }
}

function safelyNotify(listener: () => void): void {
  try {
    listener();
  } catch {
    // One external-store observer cannot block the remaining observers.
  }
}

function samePreferences(
  left: PreferenceSchemaV1,
  right: PreferenceSchemaV1,
): boolean {
  if (left.preset !== right.preset) return false;
  if (left.preset === "completion-only" || right.preset === "completion-only")
    return true;
  return left.streaming === right.streaming && left.tools === right.tools;
}

function normalizeManagedPreferences(
  value: PreferenceSchemaV1,
): PreferenceSchemaV1 {
  // The DOM mapping performs the package's strict schema validation without
  // installing storage or browser listeners.
  preferencesToCoreConfiguration(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const preset = descriptors.preset?.value as PreferenceSchemaV1["preset"];
  if (preset === "completion-only") {
    return Object.freeze({ version: 1, preset: "completion-only" });
  }
  return Object.freeze({
    version: 1,
    preset,
    streaming: descriptors.streaming?.value as Exclude<
      PreferenceSchemaV1,
      { preset: "completion-only" }
    >["streaming"],
    tools: descriptors.tools?.value as Exclude<
      PreferenceSchemaV1,
      { preset: "completion-only" }
    >["tools"],
  });
}

function registerAttention(
  store: AttentionStore,
  registration: {
    kind: "composer" | "conversation" | "newest";
    element: Element;
  },
): () => void {
  if (registration.kind === "composer")
    return store.registerComposer(registration.element);
  if (registration.kind === "conversation")
    return store.registerConversation(registration.element);
  return store.registerNewestResponse(registration.element);
}

const GenerativeA11yContext = createContext<GenerativeA11yContextValue | null>(
  null,
);

export function GenerativeA11yProvider({
  children,
  runtime: suppliedRuntime,
  dom,
  attention,
  attentionStore: suppliedAttentionStore,
  preferences,
  preferenceStore: suppliedPreferenceStore,
  ...runtimeOptions
}: GenerativeA11yProviderProps) {
  const initial = useRef<
    | {
        suppliedRuntime: GenerativeA11yRuntime | undefined;
        ownsRuntime: boolean;
        runtime: GenerativeA11yRuntime;
        dom: false | GenerativeA11yDOMOptions;
        ownsAttention: boolean;
        attentionStore: AttentionStore;
        ownsPreferences: boolean;
        preferenceStore: PreferenceStore;
      }
    | undefined
  >(undefined);

  if (!initial.current) {
    const preferenceOptions = preferences ?? {};
    const preferenceStore =
      suppliedPreferenceStore ?? new ManagedPreferenceStore(preferenceOptions);
    const preferenceConfiguration = preferencesToCoreConfiguration(
      preferenceStore.getSnapshot(),
    );
    const hasExplicitRuntimeConfiguration =
      runtimeOptions.preset !== undefined ||
      runtimeOptions.policy !== undefined;
    const ownedRuntimeOptions: GenerativeA11yOptions = {
      ...runtimeOptions,
      ...(!hasExplicitRuntimeConfiguration ? preferenceConfiguration : {}),
    };
    const runtime =
      suppliedRuntime ?? createGenerativeA11y(ownedRuntimeOptions);
    const attentionStore =
      suppliedAttentionStore ??
      (attention === false
        ? new InertAttentionStore()
        : new ManagedAttentionStore(attention ?? {}));
    initial.current = {
      suppliedRuntime,
      ownsRuntime: suppliedRuntime === undefined,
      runtime,
      dom: dom ?? {},
      ownsAttention:
        suppliedAttentionStore === undefined && attention !== false,
      attentionStore,
      ownsPreferences: suppliedPreferenceStore === undefined,
      preferenceStore,
    };
  }

  const resources = initial.current;
  if (suppliedRuntime !== resources.suppliedRuntime) {
    throw new Error(
      "GenerativeA11yProvider runtime cannot change without a keyed remount",
    );
  }

  const context = useRef<GenerativeA11yContextValue | undefined>(undefined);
  context.current ??= Object.freeze({
    runtime: resources.runtime,
    attentionStore: resources.attentionStore,
    preferenceStore: resources.preferenceStore,
  });

  const lifecycleEpoch = useRef(0);
  useEffect(() => {
    lifecycleEpoch.current += 1;
    if (resources.ownsAttention)
      (resources.attentionStore as ManagedAttentionStore).start();
    if (resources.ownsPreferences)
      (resources.preferenceStore as ManagedPreferenceStore).start();
    return () => {
      const cleanupEpoch = ++lifecycleEpoch.current;
      queueMicrotask(() => {
        if (lifecycleEpoch.current !== cleanupEpoch) {
          return;
        }
        if (resources.ownsAttention) resources.attentionStore.dispose();
        if (resources.ownsPreferences) resources.preferenceStore.dispose();
        if (resources.ownsRuntime) resources.runtime.dispose();
      });
    };
  }, [resources]);

  const politeRegion = useRef<HTMLElement | null>(null);
  const assertiveRegion = useRef<HTMLElement | null>(null);
  const binding = useRef<DOMRuntimeBinding | undefined>(undefined);
  const reconcileBinding = useCallback(() => {
    binding.current?.dispose();
    binding.current = undefined;
    if (
      resources.dom !== false &&
      politeRegion.current &&
      assertiveRegion.current
    ) {
      binding.current = connectRuntimeToDOM(resources.runtime, {
        ...resources.dom,
        regions: {
          polite: politeRegion.current,
          assertive: assertiveRegion.current,
        },
      });
    }
  }, [resources]);
  const setPoliteRegion = useCallback(
    (node: HTMLDivElement | null) => {
      if (politeRegion.current === node) return;
      politeRegion.current = node;
      reconcileBinding();
    },
    [reconcileBinding],
  );
  const setAssertiveRegion = useCallback(
    (node: HTMLDivElement | null) => {
      if (assertiveRegion.current === node) return;
      assertiveRegion.current = node;
      reconcileBinding();
    },
    [reconcileBinding],
  );

  return (
    <GenerativeA11yContext.Provider value={context.current}>
      {resources.dom === false ? null : (
        <>
          <div
            ref={setPoliteRegion}
            aria-live="polite"
            aria-atomic="true"
            aria-relevant="additions text"
            style={visuallyHiddenStyle}
          />
          <div
            ref={setAssertiveRegion}
            aria-live="assertive"
            aria-atomic="true"
            aria-relevant="additions text"
            style={visuallyHiddenStyle}
          />
        </>
      )}
      {children}
    </GenerativeA11yContext.Provider>
  );
}

export function useGenerativeA11y(): GenerativeA11yContextValue {
  const value = useContext(GenerativeA11yContext);
  if (!value) {
    throw new Error(
      "useGenerativeA11y must be used within GenerativeA11yProvider",
    );
  }
  return value;
}

export function useGenerativeA11yRuntime(): GenerativeA11yRuntime {
  return useGenerativeA11y().runtime;
}

export function useGenerativeA11yAttention(): AttentionSnapshot {
  const { attentionStore } = useGenerativeA11y();
  return useSyncExternalStore(
    attentionStore.subscribe,
    attentionStore.getSnapshot,
    attentionStore.getServerSnapshot,
  );
}

export function useGenerativeA11yPreferences(): GenerativeA11yPreferencesResult {
  const { preferenceStore } = useGenerativeA11y();
  const snapshot = useSyncExternalStore(
    preferenceStore.subscribe,
    preferenceStore.getSnapshot,
    preferenceStore.getServerSnapshot,
  );
  const setPreferences = useCallback(
    (next: PreferenceSchemaV1) => preferenceStore.setPreferences(next),
    [preferenceStore],
  );
  return useMemo(
    () => ({ preferences: snapshot, setPreferences, store: preferenceStore }),
    [preferenceStore, setPreferences, snapshot],
  );
}

export function useGenerativeA11yBindings(): GenerativeA11yBindings {
  const { attentionStore } = useGenerativeA11y();
  const composerRef = useAttentionRegistration<HTMLTextAreaElement>(
    attentionStore.registerComposer,
  );
  const conversationRef = useAttentionRegistration<HTMLElement>(
    attentionStore.registerConversation,
  );
  const newestResponseRef = useAttentionRegistration<HTMLElement>(
    attentionStore.registerNewestResponse,
  );
  return useMemo(
    () => ({
      composerProps: { ref: composerRef },
      conversationProps: { ref: conversationRef },
      newestResponseProps: { ref: newestResponseRef },
    }),
    [composerRef, conversationRef, newestResponseRef],
  );
}

function useAttentionRegistration<T extends Element>(
  register: (element: Element) => () => void,
): RefCallback<T> {
  const cleanup = useRef<(() => void) | undefined>(undefined);
  return useCallback(
    (node: T | null) => {
      cleanup.current?.();
      cleanup.current = undefined;
      if (node) cleanup.current = register(node);
    },
    [register],
  );
}
