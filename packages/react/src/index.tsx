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
  normalizePreferences,
  preferencesToCoreConfiguration,
  samePreferences,
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
  Component,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
  type RefCallback,
} from "react";
import { createPortal } from "react-dom";

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
    this.#serverSnapshot = normalizePreferences(
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
    this.#replace(normalizePreferences(value));
    this.#dirtyBeforeStart = true;
  };

  start(defaultDocument?: Document): void {
    if (this.#disposed) throw new Error("PreferenceStore is disposed");
    if (this.#store) return;
    const store = createPreferenceStore(
      preferenceOptionsForDocument(
        this.#options,
        this.#serverSnapshot,
        defaultDocument,
      ),
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
  defaultValue: PreferenceSchemaV1,
  defaultDocument: Document | undefined,
): PreferenceStoreOptions {
  const persistence = options.persistence;
  const defaultView = defaultDocument?.defaultView;
  if (persistence === undefined || !defaultView) {
    return { ...options, defaultValue };
  }

  const needsStorage = persistence.storage === undefined;
  const needsEvents = persistence.events === undefined;
  if (!needsStorage && !needsEvents) {
    return { ...options, defaultValue };
  }

  const realmStorage = resolveRealmStorage(defaultView);
  const storage = persistence.storage ?? realmStorage.storage;
  const events =
    persistence.events ??
    createRealmStorageEvents(defaultView, storage, realmStorage.nativeStorage);
  return {
    ...options,
    defaultValue,
    persistence: { ...persistence, storage, events },
  };
}

function resolveRealmStorage(defaultView: Window): {
  storage: PreferenceStorage;
  nativeStorage?: PreferenceStorage;
} {
  try {
    const storage = defaultView.localStorage;
    return { storage, nativeStorage: storage };
  } catch (error) {
    return {
      storage: {
        getItem() {
          throw error;
        },
        setItem() {
          throw error;
        },
      },
    };
  }
}

function createRealmStorageEvents(
  defaultView: Window,
  effectiveStorage: PreferenceStorage,
  nativeStorage: PreferenceStorage | undefined,
): PreferenceStorageEventSource {
  return {
    subscribe(listener) {
      const handle = (event: StorageEvent): void => {
        let storageArea: Storage | null;
        try {
          storageArea = event.storageArea;
        } catch {
          storageArea = null;
        }
        if (
          storageArea !== null &&
          nativeStorage !== undefined &&
          storageArea !== nativeStorage
        ) {
          return;
        }
        listener({
          get key() {
            return event.key;
          },
          get newValue() {
            return event.newValue;
          },
          storageArea: effectiveStorage,
        });
      };
      defaultView.addEventListener("storage", handle);
      return () => defaultView.removeEventListener("storage", handle);
    },
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

class ProviderResourceLifetime extends Component<{
  readonly children?: ReactNode;
  readonly onUnmount: () => void;
}> {
  override componentWillUnmount(): void {
    this.props.onUnmount();
  }

  override render(): ReactNode {
    return this.props.children;
  }
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
  const preferenceSubscribe = useCallback(
    (listener: () => void) => preferenceResource.store.subscribe(listener),
    [preferenceResource.store],
  );
  const preferenceGetSnapshot = useCallback(
    () => preferenceResource.store.getSnapshot(),
    [preferenceResource.store],
  );
  const preferenceGetServerSnapshot = useCallback(
    () => preferenceResource.store.getServerSnapshot(),
    [preferenceResource.store],
  );
  const initialPreferenceSnapshot = useSyncExternalStore(
    preferenceResource.configuresRuntime
      ? preferenceSubscribe
      : subscribeInertly,
    preferenceResource.configuresRuntime
      ? preferenceGetSnapshot
      : getDefaultPreferences,
    preferenceResource.configuresRuntime
      ? preferenceGetServerSnapshot
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

  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (resources.dom === false || portalHost) return;
    const ownerDocument = committedDocument.current;
    if (!ownerDocument) return;
    const parent = ownerDocument.body ?? ownerDocument.documentElement;
    if (!parent) return;
    const host = ownerDocument.createElement("div");
    host.dataset.generativeA11yLiveRegions = "true";
    parent.append(host);
    setPortalHost(host);
  }, [portalHost, resources]);

  const lifecycleEpoch = useRef(0);
  const lifetimeEpoch = useRef(0);
  useLayoutEffect(() => {
    lifetimeEpoch.current += 1;
  }, [resources]);
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
        if (resources.ownsAttention)
          (resources.attentionStore as ManagedAttentionStore).stop();
        if (resources.ownsPreferences)
          (resources.preferenceStore as ManagedPreferenceStore).stop();
      });
    };
  }, [resources]);

  const disposeOwnedResources = useCallback(() => {
    const cleanupEpoch = lifetimeEpoch.current;
    setTimeout(() => {
      if (lifetimeEpoch.current !== cleanupEpoch) return;
      if (resources.ownsAttention) disposeSafely(resources.attentionStore);
      if (resources.ownsPreferences) disposeSafely(resources.preferenceStore);
      if (resources.ownsRuntime) disposeSafely(resources.runtime);
      portalHost?.remove();
    }, 0);
  }, [portalHost, resources]);

  const regionMarkup =
    resources.dom === false ? null : (
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
    );

  return (
    <ProviderResourceLifetime onUnmount={disposeOwnedResources}>
      <GenerativeA11yContext.Provider value={context}>
        {portalHost && regionMarkup
          ? createPortal(regionMarkup, portalHost)
          : regionMarkup}
        {children}
      </GenerativeA11yContext.Provider>
    </ProviderResourceLifetime>
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
  const subscribe = useCallback(
    (listener: () => void) => attentionStore.subscribe(listener),
    [attentionStore],
  );
  const getSnapshot = useCallback(
    () => attentionStore.getSnapshot(),
    [attentionStore],
  );
  const getServerSnapshot = useCallback(
    () => attentionStore.getServerSnapshot(),
    [attentionStore],
  );
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useGenerativeA11yPreferences(): GenerativeA11yPreferencesResult {
  const { preferenceStore } = useGenerativeA11y();
  const subscribe = useCallback(
    (listener: () => void) => preferenceStore.subscribe(listener),
    [preferenceStore],
  );
  const getSnapshot = useCallback(
    () => preferenceStore.getSnapshot(),
    [preferenceStore],
  );
  const getServerSnapshot = useCallback(
    () => preferenceStore.getServerSnapshot(),
    [preferenceStore],
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
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
  const registerComposer = useCallback(
    (element: Element) => attentionStore.registerComposer(element),
    [attentionStore],
  );
  const registerConversation = useCallback(
    (element: Element) => attentionStore.registerConversation(element),
    [attentionStore],
  );
  const registerNewestResponse = useCallback(
    (element: Element) => attentionStore.registerNewestResponse(element),
    [attentionStore],
  );
  const composerRef =
    useAttentionRegistration<HTMLTextAreaElement>(registerComposer);
  const conversationRef =
    useAttentionRegistration<HTMLElement>(registerConversation);
  const newestResponseRef = useAttentionRegistration<HTMLElement>(
    registerNewestResponse,
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
