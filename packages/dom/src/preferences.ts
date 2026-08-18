import type { PolicyOverrides, PresetName } from "@generative-a11y/core";

import type { ExternalStore } from "./attention.js";

export type StreamingVerbosity =
  "preset" | "off" | "completion" | "paragraph" | "sentence";

export type ToolVerbosity =
  "preset" | "off" | "failures" | "status" | "progress";

export type PreferenceSchemaV1 =
  | Readonly<{ version: 1; preset: "completion-only" }>
  | Readonly<{
      version: 1;
      preset: "minimal" | "balanced" | "verbose";
      streaming: StreamingVerbosity;
      tools: ToolVerbosity;
    }>;

export interface PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface PreferenceStorageEvent {
  readonly key: string | null;
  readonly newValue: string | null;
  readonly storageArea?: PreferenceStorage | null;
}

export interface PreferenceStorageEventSource {
  subscribe(listener: (event: PreferenceStorageEvent) => void): () => void;
}

export type PreferenceDiagnosticSource =
  | "storage-read"
  | "storage-write"
  | "storage-event"
  | "event-subscribe"
  | "event-unsubscribe";

export type PreferenceDiagnosticCode =
  | "operation-failed"
  | "invalid-json"
  | "invalid-preference"
  | "unsupported-version";

export interface PreferenceDiagnostic {
  readonly source: PreferenceDiagnosticSource;
  readonly code: PreferenceDiagnosticCode;
  readonly error?: Readonly<{ name: string; message: string }>;
}

export interface PreferencePersistence {
  readonly key: string;
  readonly storage?: PreferenceStorage;
  readonly events?: PreferenceStorageEventSource;
}

export interface PreferenceStoreOptions {
  readonly defaultValue?: PreferenceSchemaV1;
  readonly persistence?: PreferencePersistence;
  readonly onDiagnostic?: (diagnostic: PreferenceDiagnostic) => void;
}

export interface PreferenceStore extends ExternalStore<PreferenceSchemaV1> {
  setPreferences(value: PreferenceSchemaV1): void;
  dispose(): void;
}

export interface CorePreferenceConfiguration {
  readonly preset: PresetName;
  readonly policy?: PolicyOverrides;
}

export const defaultPreferences: PreferenceSchemaV1 = Object.freeze({
  version: 1,
  preset: "balanced",
  streaming: "preset",
  tools: "preset",
});

export function preferencesToCoreConfiguration(
  value: PreferenceSchemaV1,
): CorePreferenceConfiguration {
  const preferences = normalizePreferences(value);
  if (preferences.preset === "completion-only") {
    return { preset: "completion-only" };
  }
  const policy: PolicyOverrides = {};
  const text = mapStreaming(preferences.streaming);
  const tools = mapTools(preferences.tools);
  if (text) policy.text = text;
  if (tools) policy.tools = tools;
  return Object.keys(policy).length === 0
    ? { preset: preferences.preset }
    : { preset: preferences.preset, policy };
}

export function createPreferenceStore(
  options: PreferenceStoreOptions = {},
): PreferenceStore {
  const configuredDefault = options.defaultValue
    ? normalizePreferences(options.defaultValue)
    : defaultPreferences;
  const persistence = resolvePersistence(options.persistence);
  const report = (
    source: PreferenceDiagnosticSource,
    code: PreferenceDiagnosticCode,
    cause?: unknown,
  ): void => {
    const diagnostic: PreferenceDiagnostic = {
      source,
      code,
      ...(cause === undefined ? {} : { error: serializeError(cause) }),
    };
    try {
      options.onDiagnostic?.(diagnostic);
    } catch {
      // Diagnostics are observational.
    }
  };
  let current = configuredDefault;
  if (persistence?.storage) {
    try {
      const stored = persistence.storage.getItem(persistence.key);
      if (stored !== null) {
        current = parsePreferences(stored, "storage-read", report) ?? current;
      }
    } catch (cause) {
      report("storage-read", "operation-failed", cause);
    }
  }
  let disposed = false;
  let eventEpoch = 0;
  const listeners = new Set<() => void>();
  let unsubscribeEvents: (() => void) | undefined;

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // External-store listeners cannot prevent other listeners.
      }
    }
  };
  const replace = (next: PreferenceSchemaV1): boolean => {
    if (samePreferences(current, next)) return false;
    current = next;
    notify();
    return true;
  };
  const handleStorageEvent = (event: PreferenceStorageEvent): void => {
    if (disposed || !persistence) return;
    const epoch = ++eventEpoch;
    let key: string | null;
    let newValue: string | null;
    let storageArea: PreferenceStorage | null | undefined;
    try {
      key = event.key;
      newValue = event.newValue;
      storageArea = event.storageArea;
    } catch (cause) {
      if (!disposed && epoch === eventEpoch) {
        report("storage-event", "operation-failed", cause);
      }
      return;
    }
    if (disposed || epoch !== eventEpoch) return;
    try {
      if (storageArea != null && storageArea !== persistence.storage) {
        return;
      }
      if (key !== null && key !== persistence.key) return;
      if (key === null || newValue === null) {
        replace(configuredDefault);
        return;
      }
      const next = parsePreferences(newValue, "storage-event", report);
      if (!disposed && epoch === eventEpoch && next) replace(next);
    } catch (cause) {
      if (!disposed && epoch === eventEpoch) {
        report("storage-event", "operation-failed", cause);
      }
    }
  };

  if (persistence?.events) {
    try {
      unsubscribeEvents = persistence.events.subscribe(handleStorageEvent);
    } catch (cause) {
      report("event-subscribe", "operation-failed", cause);
    }
  }

  return {
    subscribe(listener) {
      if (disposed) throw new Error("PreferenceStore is disposed");
      listeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        listeners.delete(listener);
      };
    },
    getSnapshot: () => current,
    getServerSnapshot: () => configuredDefault,
    setPreferences(value) {
      if (disposed) throw new Error("PreferenceStore is disposed");
      const next = normalizePreferences(value);
      const changed = replace(next);
      if (!disposed && persistence?.storage && samePreferences(current, next)) {
        const serialized = JSON.stringify(next);
        if (!changed) {
          const epoch = eventEpoch;
          let matchesStoredValue = false;
          try {
            matchesStoredValue =
              persistence.storage.getItem(persistence.key) === serialized;
          } catch (cause) {
            report("storage-read", "operation-failed", cause);
          }
          if (
            matchesStoredValue ||
            disposed ||
            epoch !== eventEpoch ||
            !samePreferences(current, next)
          ) {
            return;
          }
        }
        if (disposed || !samePreferences(current, next)) return;
        try {
          persistence.storage.setItem(persistence.key, serialized);
        } catch (cause) {
          report("storage-write", "operation-failed", cause);
        }
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      eventEpoch += 1;
      listeners.clear();
      const unsubscribe = unsubscribeEvents;
      unsubscribeEvents = undefined;
      if (unsubscribe) {
        try {
          unsubscribe();
        } catch (cause) {
          report("event-unsubscribe", "operation-failed", cause);
        }
      }
    },
  };
}

interface ResolvedPreferencePersistence {
  readonly key: string;
  readonly storage?: PreferenceStorage;
  readonly events?: PreferenceStorageEventSource;
}

function resolvePersistence(
  persistence: PreferencePersistence | undefined,
): ResolvedPreferencePersistence | undefined {
  if (!persistence) return undefined;
  if (persistence.storage) return persistence;
  const browser = getBrowserPersistence();
  return {
    key: persistence.key,
    ...(browser?.storage ? { storage: browser.storage } : {}),
    ...(persistence.events
      ? { events: persistence.events }
      : browser?.events
        ? { events: browser.events }
        : {}),
  };
}

function getBrowserPersistence():
  | { storage: PreferenceStorage; events: PreferenceStorageEventSource }
  | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const browserWindow = window;
    const storage = browserWindow.localStorage;
    if (!storage) return undefined;
    return {
      storage,
      events: {
        subscribe(listener) {
          const handle = (event: StorageEvent): void => listener(event);
          browserWindow.addEventListener("storage", handle);
          return () => browserWindow.removeEventListener("storage", handle);
        },
      },
    };
  } catch {
    return undefined;
  }
}

function parsePreferences(
  raw: string,
  source: "storage-read" | "storage-event",
  report: (
    source: PreferenceDiagnosticSource,
    code: PreferenceDiagnosticCode,
    cause?: unknown,
  ) => void,
): PreferenceSchemaV1 | undefined {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (cause) {
    report(source, "invalid-json", cause);
    return undefined;
  }
  try {
    return normalizePreferences(value as PreferenceSchemaV1);
  } catch (cause) {
    report(
      source,
      cause instanceof UnsupportedPreferenceVersionError
        ? "unsupported-version"
        : "invalid-preference",
      cause,
    );
    return undefined;
  }
}

class UnsupportedPreferenceVersionError extends TypeError {}

export function normalizePreferences(
  value: PreferenceSchemaV1,
): PreferenceSchemaV1 {
  const fields = snapshotPreferenceFields(value);
  if (fields.version !== 1)
    throw new UnsupportedPreferenceVersionError(
      "Unsupported preference version",
    );
  if (fields.preset === "completion-only") {
    if (!hasExactKeys(fields, ["version", "preset"]))
      throw new TypeError("Invalid completion-only preferences");
    return Object.freeze({ version: 1, preset: "completion-only" });
  }
  if (
    !(["minimal", "balanced", "verbose"] as unknown[]).includes(fields.preset)
  )
    throw new TypeError("Invalid preference preset");
  if (!hasExactKeys(fields, ["version", "preset", "streaming", "tools"]))
    throw new TypeError("Invalid preference fields");
  if (!STREAMING_VALUES.includes(fields.streaming as StreamingVerbosity))
    throw new TypeError("Invalid streaming preference");
  if (!TOOL_VALUES.includes(fields.tools as ToolVerbosity))
    throw new TypeError("Invalid tool preference");
  return Object.freeze({
    version: 1,
    preset: fields.preset as "minimal" | "balanced" | "verbose",
    streaming: fields.streaming as StreamingVerbosity,
    tools: fields.tools as ToolVerbosity,
  });
}

const STREAMING_VALUES: readonly StreamingVerbosity[] = [
  "preset",
  "off",
  "completion",
  "paragraph",
  "sentence",
];
const TOOL_VALUES: readonly ToolVerbosity[] = [
  "preset",
  "off",
  "failures",
  "status",
  "progress",
];

function snapshotPreferenceFields(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("Invalid preferences");
  }
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const fields = Object.create(null) as Record<string, unknown>;
    for (const key of Reflect.ownKeys(descriptors)) {
      if (typeof key !== "string")
        throw new TypeError("Invalid preference fields");
      const descriptor = descriptors[key];
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new TypeError(
          "Preference fields must be enumerable data properties",
        );
      }
      fields[key] = descriptor.value;
    }
    return fields;
  } catch {
    throw new TypeError("Invalid preferences");
  }
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const keys = Object.keys(value);
  return (
    keys.length === expected.length &&
    expected.every((key) => keys.includes(key))
  );
}

export function samePreferences(
  left: PreferenceSchemaV1,
  right: PreferenceSchemaV1,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mapStreaming(
  value: StreamingVerbosity,
): PolicyOverrides["text"] | undefined {
  if (value === "preset") return undefined;
  if (value === "off") return { strategy: "silent" };
  if (value === "completion")
    return { strategy: "completion", minimumCharacters: 0, maximumDelayMs: 0 };
  return { strategy: value };
}

function mapTools(value: ToolVerbosity): PolicyOverrides["tools"] | undefined {
  if (value === "preset") return undefined;
  return {
    announceStart: value === "status" || value === "progress",
    announceProgress: value === "progress",
    announceCompletion: value === "status" || value === "progress",
    announceFailure: value !== "off",
  };
}

function serializeError(cause: unknown): Readonly<{
  name: string;
  message: string;
}> {
  const fallback = { name: "Error", message: "Unknown error" } as const;
  try {
    if (cause instanceof Error) {
      const name = cause.name;
      const message = cause.message;
      if (typeof name !== "string" || typeof message !== "string") {
        return fallback;
      }
      return { name: name || "Error", message };
    }
    if (
      typeof cause === "string" ||
      typeof cause === "number" ||
      typeof cause === "boolean" ||
      typeof cause === "bigint" ||
      typeof cause === "symbol"
    ) {
      return { name: "Error", message: String(cause) };
    }
  } catch {
    return fallback;
  }
  return fallback;
}
