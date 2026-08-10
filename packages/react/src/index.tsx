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
  type PreferenceStorage,
  type PreferenceStorageEventSource,
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
  useState,
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

  start(defaultDocument?: Document): void {
    if (this.#disposed) throw new Error("AttentionStore is disposed");
    if (this.#store) return;
    const options =
      this.#options.document === undefined && defaultDocument !== undefined
        ? { ...this.#options, document: defaultDocument }
        : this.#options;
    const store = createAttentionStore(options);
    let unsubscribe: (() => void) | undefined;
    const startedRegistrations: Array<{
      registration: {
        kind: "composer" | "conversation" | "newest";
        element: Element;
        unregister: (() => void) | undefined;
      };
      unregister: () => void;
    }> = [];
    try {
      unsubscribe = store.subscribe(() => this.#replace(store.getSnapshot()));
      for (const registration of this.#registrations.values()) {
        startedRegistrations.push({
          registration,
          unregister: registerAttention(store, registration),
        });
      }
      const nextSnapshot = store.getSnapshot();
      this.#store = store;
      this.#unsubscribe = unsubscribe;
      for (const started of startedRegistrations) {
        started.registration.unregister = started.unregister;
      }
      this.#replace(nextSnapshot);
    } catch (error) {
      for (const started of startedRegistrations.reverse()) {
        try {
          started.unregister();
        } catch {
          // A failed registration cannot block the remaining rollback.
        }
      }
      unsubscribeSafely(unsubscribe);
      disposeSafely(store);
      throw error;
    }
  }

  stop(): void {
    const store = this.#store;
    if (!store) return;
    this.#store = undefined;
    try {
      this.#unsubscribe?.();
    } catch {
      // Store cleanup remains best-effort and must continue.
    }
    this.#unsubscribe = undefined;
    for (const registration of this.#registrations.values()) {
      try {
        registration.unregister?.();
      } catch {
        // One registration cannot block the remaining cleanup.
      }
      registration.unregister = undefined;
    }
    disposeSafely(store);
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
    this.#listeners.clear();
    this.stop();
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
  #dirtyBeforeStart = false;

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
    this.#dirtyBeforeStart = true;
  };

  start(defaultDocument?: Document): void {
    if (this.#disposed) throw new Error("PreferenceStore is disposed");
    if (this.#store) return;
    const store = createPreferenceStore(
      preferenceOptionsForDocument(this.#options, defaultDocument),
    );
    let unsubscribe: (() => void) | undefined;
    try {
      if (this.#dirtyBeforeStart) store.setPreferences(this.#snapshot);
      const nextSnapshot = store.getSnapshot();
      unsubscribe = store.subscribe(() => this.#replace(store.getSnapshot()));
      this.#store = store;
      this.#unsubscribe = unsubscribe;
      this.#dirtyBeforeStart = false;
      this.#replace(nextSnapshot);
    } catch (error) {
      unsubscribeSafely(unsubscribe);
      disposeSafely(store);
      throw error;
    }
  }

  stop(): void {
    const store = this.#store;
    if (!store) return;
    this.#store = undefined;
    try {
      this.#unsubscribe?.();
    } catch {
      // Store cleanup remains best-effort and must continue.
    }
    this.#unsubscribe = undefined;
    disposeSafely(store);
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

function preferenceOptionsForDocument(
  options: PreferenceStoreOptions,
  defaultDocument: Document | undefined,
): PreferenceStoreOptions {
  const persistence = options.persistence;
  const defaultView = defaultDocument?.defaultView;
  if (
    persistence === undefined ||
    persistence.storage !== undefined ||
    persistence.events !== undefined ||
    !defaultView
  ) {
    return options;
  }

  let storage: PreferenceStorage;
  try {
    storage = defaultView.localStorage;
  } catch (error) {
    storage = {
      getItem() {
        throw error;
      },
      setItem() {
        throw error;
      },
    };
  }
  const events: PreferenceStorageEventSource = {
    subscribe(listener) {
      const handle = (event: StorageEvent): void => listener(event);
      defaultView.addEventListener("storage", handle);
      return () => defaultView.removeEventListener("storage", handle);
    },
  };
  return {
    ...options,
    persistence: { ...persistence, storage, events },
  };
}

function safelyNotify(listener: () => void): void {
  try {
    listener();
  } catch {
    // One external-store observer cannot block the remaining observers.
  }
}

function disposeSafely(resource: { dispose(): void } | undefined): void {
  try {
    resource?.dispose();
  } catch {
    // Cleanup errors cannot prevent disposal of sibling resources.
  }
}

function unsubscribeSafely(unsubscribe: (() => void) | undefined): void {
  try {
    unsubscribe?.();
  } catch {
    // Cleanup errors cannot replace the startup error being rolled back.
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

const subscribeInertly = (): (() => void) => () => undefined;
const getDefaultPreferences = (): PreferenceSchemaV1 => defaultPreferences;

interface ProviderResources {
  readonly suppliedRuntime: GenerativeA11yRuntime | undefined;
  readonly ownsRuntime: boolean;
  readonly runtime: GenerativeA11yRuntime;
  readonly dom: false | GenerativeA11yDOMOptions;
  readonly ownsAttention: boolean;
  readonly attentionStore: AttentionStore;
  readonly ownsPreferences: boolean;
  readonly preferenceStore: PreferenceStore;
}

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
  const [preferenceResource] = useState(() => ({
    configuresRuntime:
      suppliedRuntime === undefined &&
      runtimeOptions.preset === undefined &&
      runtimeOptions.policy === undefined,
    owns: suppliedPreferenceStore === undefined,
    store:
      suppliedPreferenceStore ?? new ManagedPreferenceStore(preferences ?? {}),
  }));
  const initialPreferenceSnapshot = useSyncExternalStore(
    preferenceResource.configuresRuntime
      ? preferenceResource.store.subscribe
      : subscribeInertly,
    preferenceResource.configuresRuntime
      ? preferenceResource.store.getSnapshot
      : getDefaultPreferences,
    preferenceResource.configuresRuntime
      ? preferenceResource.store.getServerSnapshot
      : getDefaultPreferences,
  );
  const [resources] = useState<ProviderResources>(() => {
    const preferenceConfiguration = preferencesToCoreConfiguration(
      initialPreferenceSnapshot,
    );
    const ownedRuntimeOptions: GenerativeA11yOptions = {
      ...runtimeOptions,
      ...(preferenceResource.configuresRuntime ? preferenceConfiguration : {}),
    };
    const runtime =
      suppliedRuntime ?? createGenerativeA11y(ownedRuntimeOptions);
    const attentionStore =
      suppliedAttentionStore ??
      (attention === false
        ? new InertAttentionStore()
        : new ManagedAttentionStore(attention ?? {}));
    return {
      suppliedRuntime,
      ownsRuntime: suppliedRuntime === undefined,
      runtime,
      dom: dom ?? {},
      ownsAttention:
        suppliedAttentionStore === undefined && attention !== false,
      attentionStore,
      ownsPreferences: preferenceResource.owns,
      preferenceStore: preferenceResource.store,
    };
  });
  if (suppliedRuntime !== resources.suppliedRuntime) {
    throw new Error(
      "GenerativeA11yProvider runtime cannot change without a keyed remount",
    );
  }

  const context = useMemo<GenerativeA11yContextValue>(
    () =>
      Object.freeze({
        runtime: resources.runtime,
        attentionStore: resources.attentionStore,
        preferenceStore: resources.preferenceStore,
      }),
    [resources],
  );

  const politeRegion = useRef<HTMLElement | null>(null);
  const assertiveRegion = useRef<HTMLElement | null>(null);
  const binding = useRef<DOMRuntimeBinding | undefined>(undefined);
  const committedDocument = useRef<Document | undefined>(undefined);
  const reconcileBinding = useCallback(() => {
    disposeSafely(binding.current);
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
      if (node) committedDocument.current ??= node.ownerDocument;
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

  const lifecycleEpoch = useRef(0);
  useEffect(() => {
    lifecycleEpoch.current += 1;
    try {
      if (resources.ownsAttention)
        (resources.attentionStore as ManagedAttentionStore).start(
          committedDocument.current,
        );
      if (resources.ownsPreferences)
        (resources.preferenceStore as ManagedPreferenceStore).start(
          committedDocument.current,
        );
    } catch (error) {
      disposeSafely(binding.current);
      binding.current = undefined;
      if (resources.ownsAttention) disposeSafely(resources.attentionStore);
      if (resources.ownsPreferences) disposeSafely(resources.preferenceStore);
      if (resources.ownsRuntime) disposeSafely(resources.runtime);
      throw error;
    }
    return () => {
      const cleanupEpoch = ++lifecycleEpoch.current;
      queueMicrotask(() => {
        if (lifecycleEpoch.current !== cleanupEpoch) return;
        disposeSafely(binding.current);
        binding.current = undefined;
        if (resources.ownsAttention) disposeSafely(resources.attentionStore);
        if (resources.ownsPreferences) disposeSafely(resources.preferenceStore);
        if (resources.ownsRuntime) disposeSafely(resources.runtime);
      });
    };
  }, [resources]);

  return (
    <GenerativeA11yContext.Provider value={context}>
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
