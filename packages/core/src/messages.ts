import type { InteractionKind } from "./types.js";

/** Parameters contain only existing user-safe labels and bounded lifecycle facts. */
export interface AnnouncementMessageParameters {
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
export type AnnouncementMessageId = keyof AnnouncementMessageParameters;
export type AnnouncementMessages = {
  readonly [K in AnnouncementMessageId]:
    | string
    | ((parameters: Readonly<AnnouncementMessageParameters[K]>) => string);
};
/** Construction-time, complete catalog. Callbacks must be pure and synchronous. */
export interface AnnouncementCatalog {
  readonly id: string;
  readonly locale: string;
  readonly messages: AnnouncementMessages;
}
export interface AdapterAnnouncementCopy {
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
export const englishAnnouncementCatalog: AnnouncementCatalog = Object.freeze({
  id: "generative-a11y.en.v1",
  locale: "en",
  messages: Object.freeze({
    "response.started": "Assistant is responding.",
    "response.completed": "Response complete.",
    "response.interrupted": "Response stopped.",
    "response.failed": "Response failed.",
    "response.retrying": ({ attempt }) =>
      attempt ? `Retrying response. Attempt ${attempt}.` : "Retrying response.",
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
      attempt ? `Retrying run. Attempt ${attempt}.` : "Retrying run.",
    "step.started": ({ label }) => punctuate(`${label} started`),
    "step.progress": progress,
    "step.completed": ({ label }) => `${label} complete.`,
    "step.interrupted": ({ label }) => `${label} stopped.`,
    "step.failed": ({ label }) => `${label} failed.`,
    "step.retrying": ({ label, attempt }) =>
      attempt ? `Retrying ${label}. Attempt ${attempt}.` : `Retrying ${label}.`,
    "interaction.resolved": ({ kind, outcome }) => `${kind} ${outcome}.`,
    "approval.resolved": ({ outcome }) => `Approval ${outcome}.`,
    "connection.lost": "Connection lost. Reconnecting.",
    "connection.restored": "Connection restored.",
    "citation.available": ({ count }) =>
      `${count} ${count === 1 ? "source" : "sources"} available.`,
  } satisfies AnnouncementMessages),
});
function boundedString(value: unknown, maximum = 4096): string {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new TypeError(
      "Announcement configuration contains an invalid string",
    );
  return value;
}
function localeTag(value: unknown): string {
  const tag = boundedString(value, 128);
  try {
    return (
      Intl.getCanonicalLocales(tag)[0] ??
      (() => {
        throw new Error();
      })()
    );
  } catch {
    throw new TypeError(
      "Announcement configuration contains an invalid language tag",
    );
  }
}
export function normalizeAnnouncementCatalog(
  catalog: AnnouncementCatalog,
): AnnouncementCatalog {
  const id = boundedString(catalog.id, 128);
  const locale = localeTag(catalog.locale);
  const keys = Object.keys(
    englishAnnouncementCatalog.messages,
  ) as AnnouncementMessageId[];
  if (
    !catalog.messages ||
    Reflect.ownKeys(catalog.messages).length !== keys.length ||
    keys.some((key) => !Object.hasOwn(catalog.messages, key))
  )
    throw new TypeError(
      "Announcement catalog must supply exactly all message keys",
    );
  const messages = Object.fromEntries(
    keys.map((key) => {
      const value = catalog.messages[key];
      return [key, typeof value === "function" ? value : boundedString(value)];
    }),
  ) as unknown as AnnouncementMessages;
  return Object.freeze({ id, locale, messages: Object.freeze(messages) });
}
/** Validate and snapshot shared adapter copy before creating a binding. */
export function normalizeAdapterAnnouncementCopy(
  copy: AdapterAnnouncementCopy,
): AdapterAnnouncementCopy {
  return Object.freeze({
    locale: localeTag(copy.locale),
    toolLabel: boundedString(copy.toolLabel),
    approvalRequested: boundedString(copy.approvalRequested),
    approvalResolved: Object.freeze({
      approved: boundedString(copy.approvalResolved?.approved),
      rejected: boundedString(copy.approvalResolved?.rejected),
      cancelled: boundedString(copy.approvalResolved?.cancelled),
    }),
    inputRequested: boundedString(copy.inputRequested),
    inputResolved: Object.freeze({
      submitted: boundedString(copy.inputResolved?.submitted),
      cancelled: boundedString(copy.inputResolved?.cancelled),
    }),
  });
}
export function formatAnnouncement<K extends AnnouncementMessageId>(
  catalog: AnnouncementCatalog,
  id: K,
  parameters: AnnouncementMessageParameters[K],
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
