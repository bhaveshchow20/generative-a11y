import type { InteractionKind } from "./types.js";

/** Parameters contain only existing user-safe labels and bounded lifecycle facts. */
export interface MessageParams {
  "response.started": Record<never, never>;
  "response.completed": Record<never, never>;
  "response.interrupted": Record<never, never>;
  "response.failed": Record<never, never>;
  "response.retrying": { attempt?: number };
  "tool.started": { label: string };
  "tool.progress": { label: string; percent?: number };
  "tool.completed": { label: string };
  "tool.failed": { label: string };
  "run.started": { label?: string };
  "run.completed": { completedSteps: number; failedSteps: number };
  "run.interrupted": Record<never, never>;
  "run.failed": Record<never, never>;
  "run.retrying": { attempt?: number };
  "step.started": { label: string };
  "step.progress": { label: string; percent?: number };
  "step.completed": { label: string };
  "step.interrupted": { label: string };
  "step.failed": { label: string };
  "step.retrying": { label: string; attempt?: number };
  "interaction.resolved": {
    kind: InteractionKind;
    outcome: "approved" | "rejected" | "submitted" | "cancelled";
  };
  "approval.resolved": { outcome: "approved" | "rejected" | "cancelled" };
  "connection.lost": Record<never, never>;
  "connection.restored": Record<never, never>;
  "citation.available": { count: number };
}
export type MessageKey = keyof MessageParams;
export type MessageMap = {
  readonly [K in MessageKey]:
    string | ((parameters: Readonly<MessageParams[K]>) => string);
};
/** Construction-time, complete catalog. Callbacks must be pure and synchronous. */
export interface Messages {
  readonly id: string;
  readonly locale: string;
  readonly messages: MessageMap;
}
export interface AdapterCopy {
  readonly locale: string;
  readonly toolLabel: string;
  readonly approvalRequested: string;
  readonly approvalResolved: Readonly<
    Record<"approved" | "rejected" | "cancelled", string>
  >;
  readonly inputRequested: string;
  readonly inputResolved: Readonly<Record<"submitted" | "cancelled", string>>;
}
const punctuate = (text: string) =>
  /[.!?。！？…]\s*$/u.test(text) ? text : `${text}.`;
const progress = ({ label, percent }: { label: string; percent?: number }) =>
  percent === undefined
    ? `${label} in progress.`
    : `${label} ${percent} percent.`;
export const en: Messages = Object.freeze({
  id: "generative-a11y.en.v1",
  locale: "en",
  messages: Object.freeze({
    "response.started": "Assistant is responding.",
    "response.completed": "Response complete.",
    "response.interrupted": "Response stopped.",
    "response.failed": "Response failed.",
    "response.retrying": ({ attempt }) =>
      attempt !== undefined
        ? `Retrying response. Attempt ${attempt}.`
        : "Retrying response.",
    "tool.started": ({ label }) => punctuate(label),
    "tool.progress": progress,
    "tool.completed": ({ label }) => `${label} complete.`,
    "tool.failed": ({ label }) => `${label} failed.`,
    "run.started": ({ label }) => punctuate(`${label ?? "Run"} started`),
    "run.completed": ({ completedSteps, failedSteps }) => {
      const parts = [];
      if (completedSteps > 0)
        parts.push(
          `${completedSteps} ${completedSteps === 1 ? "step" : "steps"} completed`,
        );
      if (failedSteps > 0)
        parts.push(
          `${failedSteps} ${failedSteps === 1 ? "step" : "steps"} failed`,
        );
      return parts.length
        ? `Run complete. ${parts.join(", ")}.`
        : "Run complete.";
    },
    "run.interrupted": "Run stopped.",
    "run.failed": "Run failed.",
    "run.retrying": ({ attempt }) =>
      attempt !== undefined
        ? `Retrying run. Attempt ${attempt}.`
        : "Retrying run.",
    "step.started": ({ label }) => punctuate(`${label} started`),
    "step.progress": progress,
    "step.completed": ({ label }) => `${label} complete.`,
    "step.interrupted": ({ label }) => `${label} stopped.`,
    "step.failed": ({ label }) => `${label} failed.`,
    "step.retrying": ({ label, attempt }) =>
      attempt !== undefined
        ? `Retrying ${label}. Attempt ${attempt}.`
        : `Retrying ${label}.`,
    "interaction.resolved": ({ kind, outcome }) => `${kind} ${outcome}.`,
    "approval.resolved": ({ outcome }) => `Approval ${outcome}.`,
    "connection.lost": "Connection lost. Reconnecting.",
    "connection.restored": "Connection restored.",
    "citation.available": ({ count }) =>
      `${count} ${count === 1 ? "source" : "sources"} available.`,
  } satisfies MessageMap),
});
function boundedString(
  value: unknown,
  maximum = 4096,
  field = "message result",
): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new TypeError(
      `${field} must be a non-empty string of at most ${maximum} characters`,
    );
  return value;
}
function localeTag(value: unknown, field: string): string {
  const tag = boundedString(value, 128, field);
  try {
    const canonical = Intl.getCanonicalLocales(tag)[0];
    if (canonical) return canonical;
  } catch {
    // Never include a caller-supplied value in configuration errors.
  }
  throw new TypeError(`${field} must be a valid language tag`);
}
export function normalizeAnnouncementCatalog(catalog: Messages): Messages {
  if (typeof catalog !== "object" || catalog === null)
    throw new TypeError(
      "messages must be an object with id, locale, and messages",
    );
  const id = boundedString(catalog.id, 128, "messages.id");
  const locale = localeTag(catalog.locale, "messages.locale");
  const keys = Object.keys(en.messages) as MessageKey[];
  if (!catalog.messages || typeof catalog.messages !== "object")
    throw new TypeError(
      "messages.messages must contain the complete message map",
    );
  const missing = keys.filter((key) => !Object.hasOwn(catalog.messages, key));
  if (missing.length)
    throw new TypeError(`Missing message keys: ${missing.join(", ")}`);
  if (Reflect.ownKeys(catalog.messages).length !== keys.length)
    throw new TypeError(
      "messages.messages contains unsupported keys; use only the documented message keys",
    );
  const messages = Object.fromEntries(
    keys.map((key) => {
      const value = catalog.messages[key];
      return [
        key,
        typeof value === "function"
          ? value
          : boundedString(value, 4096, `messages.messages[${key}]`),
      ];
    }),
  ) as unknown as MessageMap;
  return Object.freeze({ id, locale, messages: Object.freeze(messages) });
}
/** Validate and snapshot shared adapter copy before creating a binding. */
export function normalizeAdapterCopy(copy: AdapterCopy): AdapterCopy {
  if (typeof copy !== "object" || copy === null)
    throw new TypeError(
      "copy must be an object with a locale and all adapter labels",
    );
  return Object.freeze({
    locale: localeTag(copy.locale, "copy.locale"),
    toolLabel: boundedString(copy.toolLabel, 4096, "copy.toolLabel"),
    approvalRequested: boundedString(
      copy.approvalRequested,
      4096,
      "copy.approvalRequested",
    ),
    approvalResolved: Object.freeze({
      approved: boundedString(
        copy.approvalResolved?.approved,
        4096,
        "copy.approvalResolved.approved",
      ),
      rejected: boundedString(
        copy.approvalResolved?.rejected,
        4096,
        "copy.approvalResolved.rejected",
      ),
      cancelled: boundedString(
        copy.approvalResolved?.cancelled,
        4096,
        "copy.approvalResolved.cancelled",
      ),
    }),
    inputRequested: boundedString(
      copy.inputRequested,
      4096,
      "copy.inputRequested",
    ),
    inputResolved: Object.freeze({
      submitted: boundedString(
        copy.inputResolved?.submitted,
        4096,
        "copy.inputResolved.submitted",
      ),
      cancelled: boundedString(
        copy.inputResolved?.cancelled,
        4096,
        "copy.inputResolved.cancelled",
      ),
    }),
  });
}
export function formatAnnouncement<K extends MessageKey>(
  catalog: Messages,
  id: K,
  parameters: MessageParams[K],
): string {
  const formatter = catalog.messages[id];
  const result: unknown =
    typeof formatter === "function"
      ? formatter(Object.freeze({ ...parameters }))
      : formatter;
  // Async callbacks are invalid, but contain a native rejected Promise so a
  // configuration error cannot become an unhandled rejection after fallback.
  if (result instanceof Promise) void result.catch(() => {});
  return boundedString(result);
}
