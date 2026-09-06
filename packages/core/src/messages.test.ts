import { describe, expect, it } from "vitest";
import {
  createGenerativeA11y,
  ManualClock,
  englishAnnouncementCatalog,
  type AnnouncementIntent,
} from "./index.js";

describe("announcement catalogs", () => {
  it("uses catalog language independently of response language", () => {
    const clock = new ManualClock();
    const output: AnnouncementIntent[] = [];
    const runtime = createGenerativeA11y({
      clock,
      onAnnouncement: (item) => output.push(item),
      announcementCatalog: {
        ...englishAnnouncementCatalog,
        id: "fr-example",
        locale: "fr",
        messages: {
          ...englishAnnouncementCatalog.messages,
          "response.completed": "Réponse terminée.",
        },
      },
    });
    runtime.dispatch({
      type: "response.started",
      responseId: "r",
      locale: "en",
    });
    runtime.dispatch({ type: "response.completed", responseId: "r" });
    clock.runUntilIdle();
    expect(output.at(-1)).toMatchObject({
      text: "Réponse terminée.",
      locale: "fr",
    });
    runtime.dispose();
  });
});

import { vi } from "vitest";
import {
  createAnnouncementRecorder,
  createAnnouncementScheduler,
  normalizeAdapterAnnouncementCopy,
  type AnnouncementCatalog,
  type AnnouncementMessageId,
  type AnnouncementMessageParameters,
  type AnnouncementMessages,
  type GenerativeA11yEvent,
} from "./index.js";
import { recordRuntime, replayEvents } from "./testing.js";

const catalog = (
  messages: Partial<AnnouncementMessages> = {},
): AnnouncementCatalog => ({
  id: "test.fr.v1",
  locale: "fr",
  messages: { ...englishAnnouncementCatalog.messages, ...messages },
});

it("routes all 25 generated message keys through typed callbacks", () => {
  const seen = new Map<string, unknown>();
  const messages = Object.fromEntries(
    Object.keys(englishAnnouncementCatalog.messages).map((key) => [
      key,
      (parameters: unknown) => {
        expect(Object.isFrozen(parameters)).toBe(true);
        seen.set(key, parameters);
        return key;
      },
    ]),
  ) as unknown as AnnouncementMessages;
  const r = createAnnouncementRecorder({
    preset: "verbose",
    announcementCatalog: catalog(messages),
    policy: { minimumGapMs: 0, tools: { announceStartAfterMs: 0 } },
  });
  const send = (event: GenerativeA11yEvent) => {
    r.runtime.dispatch(event);
    r.clock.runUntilIdle();
  };
  for (const end of ["completed", "interrupted", "failed"] as const) {
    send({ type: "response.started", responseId: end });
    send({ type: "response.retrying", responseId: end, attempt: 2 });
    send({ type: `response.${end}`, responseId: end } as GenerativeA11yEvent);
    send({ type: "run.started", runId: end, label: "Workflow" });
    send({ type: "run.retrying", runId: end, attempt: 2 });
    send({ type: "step.started", runId: end, stepId: end, label: "Step" });
    send({
      type: "step.retrying",
      runId: end,
      stepId: end,
      label: "Step",
      attempt: 2,
    });
    send({
      type: "step.progress",
      runId: end,
      stepId: end,
      label: "Step",
      progress: 0.5,
    });
    send({ type: `step.${end}`, runId: end, stepId: end, label: "Step" });
    send({ type: `run.${end}`, runId: end });
  }
  for (const end of ["completed", "failed"] as const) {
    send({ type: "tool.started", toolId: end, label: "Tool" });
    send({ type: "tool.progress", toolId: end, label: "Tool", progress: 0.5 });
    send({
      type: `tool.${end}`,
      toolId: end,
      label: "Tool",
    } as GenerativeA11yEvent);
  }
  send({
    type: "interaction.resolved",
    interactionId: "i",
    kind: "input",
    outcome: "submitted",
  });
  send({ type: "approval.resolved", approvalId: "a", outcome: "approved" });
  send({ type: "connection.lost" });
  send({ type: "connection.restored" });
  send({ type: "citation.available", count: 2 });
  expect([...seen.keys()].sort()).toEqual(
    Object.keys(englishAnnouncementCatalog.messages).sort(),
  );
  expect(seen.get("step.progress")).toEqual({ label: "Step", percent: 50 });
  expect(seen.get("run.completed")).toEqual({
    completedSteps: 1,
    failedSteps: 0,
  });
  expect(r.transcript().every((item) => item.locale === "fr")).toBe(true);
  r.runtime.dispose();
  expect(r.clock.pendingCount()).toBe(0);
});

it.each([
  () => {
    throw new Error("SECRET");
  },
  () => "",
  () => " ",
  () => "x".repeat(4097),
  () => 42,
  () => Promise.resolve("later"),
  () => Promise.reject(new Error("SECRET")),
])(
  "contains invalid formatter output without exposing content",
  (formatter) => {
    const r = createAnnouncementRecorder({
      announcementCatalog: catalog({
        "response.failed": formatter as () => string,
      }),
    });
    r.runtime.dispatch({
      type: "response.started",
      responseId: "r",
      locale: "de",
    });
    r.runtime.dispatch({
      type: "response.failed",
      responseId: "r",
      error: "RAW SECRET",
    });
    r.clock.runUntilIdle();
    expect(r.transcript()).toMatchObject([
      { text: "Status updated.", locale: "en" },
    ]);
    expect(
      r
        .diagnosticTranscript()
        .filter((item) => item.reason === "catalog-format-error"),
    ).toHaveLength(1);
    expect(JSON.stringify(r.diagnosticTranscript())).not.toContain("SECRET");
    expect(r.runtime.getDiagnosticSnapshot().responses[0]?.status).toBe(
      "failed",
    );
    r.runtime.dispose();
    expect(r.clock.pendingCount()).toBe(0);
  },
);

it("formats only eligible notices and preserves explicit host copy and locale", () => {
  const format = vi.fn(() => "catalog text");
  const messages = Object.fromEntries(
    Object.keys(englishAnnouncementCatalog.messages).map((key) => [
      key,
      format,
    ]),
  ) as unknown as AnnouncementMessages;
  const r = createAnnouncementRecorder({
    preset: "verbose",
    announcementCatalog: catalog(messages),
    policy: { attention: { enabled: true }, announceConnections: false },
  });
  r.runtime.dispatch({ type: "attention.override", mode: "quiet" });
  r.runtime.dispatch({ type: "response.started", responseId: "r" });
  r.runtime.dispatch({ type: "tool.started", toolId: "t", label: "Tool" });
  r.runtime.dispatch({
    type: "tool.progress",
    toolId: "t",
    label: "Tool",
    progress: 0.5,
  });
  r.runtime.dispatch({ type: "connection.lost" });
  expect(format).not.toHaveBeenCalled();
  r.runtime.dispatch({
    type: "response.failed",
    responseId: "r",
    announcement: "Host notice",
    locale: "de",
  });
  expect(format).not.toHaveBeenCalled();
  r.runtime.dispatch({ type: "tool.completed", toolId: "t", label: "Tool" });
  expect(format).toHaveBeenCalledOnce();
  r.clock.runUntilIdle();
  expect(r.transcript()).toMatchObject([
    { text: "Host notice", locale: "de" },
    { text: "catalog text", locale: "fr" },
  ]);
  r.runtime.dispose();
});

it("validates the complete catalog before allocating a clock timer", () => {
  const clock = new ManualClock();
  const malformed = [
    { ...catalog(), id: "" },
    { ...catalog(), id: "x".repeat(129) },
    { ...catalog(), locale: "bad_tag" },
    { ...catalog(), locale: "x".repeat(129) },
    { ...catalog(), messages: {} },
    { ...catalog(), messages: { ...catalog().messages, extra: "unexpected" } },
    catalog({ "response.completed": "" }),
    catalog({ "response.completed": "x".repeat(4097) }),
  ];
  for (const value of malformed)
    expect(() =>
      createGenerativeA11y({
        clock,
        announcementCatalog: value as AnnouncementCatalog,
      }),
    ).toThrow();
  expect(clock.pendingCount()).toBe(0);
  expect(() =>
    createGenerativeA11y({
      clock,
      announcementCatalog: {
        ...catalog(),
        id: "x".repeat(128),
        messages: {
          ...catalog().messages,
          "response.completed": "x".repeat(4096),
        },
      },
    }),
  ).not.toThrow();
});

it("snapshots catalog configuration and exposes only metadata", () => {
  const source = {
    id: "safe-id",
    locale: "FR",
    messages: {
      ...englishAnnouncementCatalog.messages,
      "response.completed": "Original",
    },
  };
  const r = createAnnouncementRecorder({ announcementCatalog: source });
  source.id = "changed";
  source.locale = "de";
  source.messages["response.completed"] = "Changed";
  r.runtime.dispatch({ type: "response.started", responseId: "r" });
  r.runtime.dispatch({ type: "response.completed", responseId: "r" });
  r.clock.runUntilIdle();
  expect(r.transcript()).toMatchObject([{ text: "Original", locale: "fr" }]);
  expect(r.runtime.getDiagnosticSnapshot().announcementCatalog).toEqual({
    catalogId: "safe-id",
    locale: "fr",
  });
  expect(JSON.stringify(r.runtime.getDiagnosticSnapshot())).not.toContain(
    "Original",
  );
  r.runtime.dispose();
});

it.each(["sentence", "completion"] as const)(
  "keeps %s response chunks in their own language",
  (strategy) => {
    const r = createAnnouncementRecorder({
      policy: {
        text: { strategy, minimumCharacters: 1000 },
        announceResponseCompleted: false,
      },
    });
    r.runtime.dispatch({
      type: "response.started",
      responseId: "r",
      locale: "en",
    });
    r.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      delta: "English unfinished",
    });
    r.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      locale: "fr",
      delta: "Français",
    });
    if (strategy === "completion") expect(r.runtime.pendingCount()).toBe(0);
    r.runtime.dispatch({
      type: "response.completed",
      responseId: "r",
      locale: "de",
    });
    r.clock.runUntilIdle();
    expect(r.transcript()).toMatchObject([
      { text: "English unfinished", locale: "en" },
      { text: "Français", locale: "fr" },
    ]);
    r.runtime.dispose();
    expect(r.clock.pendingCount()).toBe(0);
  },
);

it("includes language in both default and explicit scheduler dedupe keys", () => {
  for (const explicit of [false, true]) {
    const clock = new ManualClock();
    const output: AnnouncementIntent[] = [];
    const scheduler = createAnnouncementScheduler({
      clock,
      minimumGapMs: 0,
      dedupeWindowMs: 1000,
      maxQueueSize: 5,
      onAnnouncement: (item) => output.push(item),
    });
    for (const locale of ["en", "fr", "en"])
      scheduler.schedule({
        channel: "polite",
        sourceType: "citation.available",
        text: "same",
        locale,
        ...(explicit ? { dedupeKey: "same-count" } : {}),
      });
    clock.runUntilIdle();
    expect(output.map((item) => item.locale)).toEqual(["en", "fr"]);
    scheduler.dispose();
  }
});

it("serializes reentrant dispatch and stops safely when formatter disposes", () => {
  const r = createAnnouncementRecorder({
    announcementCatalog: catalog({
      "response.completed": () => {
        r.runtime.dispatch({ type: "connection.restored" });
        return "Done";
      },
    }),
  });
  r.runtime.dispatch({ type: "response.started", responseId: "r" });
  r.runtime.dispatch({ type: "response.completed", responseId: "r" });
  r.clock.runUntilIdle();
  expect(r.transcript().map((item) => item.text)).toEqual([
    "Done",
    "Connection restored.",
  ]);
  r.runtime.dispose();
  const stopped = createAnnouncementRecorder({
    announcementCatalog: catalog({
      "response.completed": () => {
        stopped.runtime.dispose();
        return "must not deliver";
      },
    }),
  });
  stopped.runtime.dispatch({ type: "response.started", responseId: "r" });
  stopped.runtime.dispatch({ type: "response.completed", responseId: "r" });
  stopped.clock.runUntilIdle();
  expect(stopped.transcript()).toEqual([]);
  expect(stopped.clock.pendingCount()).toBe(0);
});

it("replays localized attention and fallback with the same catalog", () => {
  const options = {
    announcementCatalog: catalog({
      "response.completed": "Terminée",
      "connection.restored": () => {
        throw new Error("private");
      },
    }),
    policy: { attention: { enabled: true }, minimumGapMs: 0 },
  };
  const source = createAnnouncementRecorder(options);
  const recording = recordRuntime({
    runtime: source.runtime,
    clock: source.clock,
  });
  const events: GenerativeA11yEvent[] = [
    { type: "response.started", responseId: "r" },
    { type: "attention.override", mode: "quiet" },
    { type: "response.text.delta", responseId: "r", delta: "hidden" },
    { type: "response.completed", responseId: "r" },
    { type: "connection.restored" },
  ];
  for (const event of events) {
    source.clock.advanceBy(1);
    recording.runtime.dispatch(event);
  }
  source.clock.runUntilIdle();
  const target = createAnnouncementRecorder(options);
  replayEvents(
    target.runtime,
    target.clock,
    JSON.parse(JSON.stringify(recording.fixture())),
  );
  target.clock.runUntilIdle();
  expect(target.transcript()).toEqual(source.transcript());
  expect(target.diagnosticTranscript()).toEqual(source.diagnosticTranscript());
  source.runtime.dispose();
  target.runtime.dispose();
});

it("validates and copies shared serializable adapter copy", () => {
  const original = {
    locale: "FR",
    toolLabel: "Outil",
    approvalRequested: "Autoriser",
    approvalResolved: { approved: "Oui", rejected: "Non", cancelled: "Annulé" },
    inputRequested: "Saisir",
    inputResolved: { submitted: "Envoyé", cancelled: "Annulé" },
  };
  const copy = normalizeAdapterAnnouncementCopy(original);
  original.approvalResolved.approved = "changed";
  expect(copy.locale).toBe("fr");
  expect(copy.approvalResolved.approved).toBe("Oui");
  expect(Object.isFrozen(copy)).toBe(true);
  expect(Object.isFrozen(copy.approvalResolved)).toBe(true);
  expect(Object.isFrozen(copy.inputResolved)).toBe(true);
  expect(() =>
    normalizeAdapterAnnouncementCopy({
      ...original,
      toolLabel: "x".repeat(4097),
    }),
  ).toThrow();
  expect(() =>
    normalizeAdapterAnnouncementCopy({ ...original, locale: "bad_tag" }),
  ).toThrow();
  expect(() =>
    normalizeAdapterAnnouncementCopy({
      ...original,
      inputResolved: {},
    } as typeof original),
  ).toThrow();
});

// Compile-time catalog callbacks expose only the declared parameters.
const typedMessages: AnnouncementMessages = {
  ...englishAnnouncementCatalog.messages,
  "citation.available": (parameters) => {
    const count: AnnouncementMessageParameters["citation.available"]["count"] =
      parameters.count;
    // @ts-expect-error raw event and backend error content is not a formatter input
    void parameters.error;
    return String(count);
  },
};
const typedId: AnnouncementMessageId = "citation.available";
void typedMessages[typedId];

it("bounds retained completion language chunks and clears them on retry/quiet", () => {
  const r = createAnnouncementRecorder({
    policy: {
      text: { strategy: "completion" },
      maxQueueSize: 2,
      announceResponseCompleted: false,
      announceRetry: false,
      attention: { enabled: true },
    },
  });
  r.runtime.dispatch({ type: "response.started", responseId: "r" });
  for (let index = 0; index < 8; index++)
    r.runtime.dispatch({
      type: "response.text.delta",
      responseId: "r",
      locale: index % 2 ? "fr" : "en",
      delta: `part ${index}`,
    });
  expect(
    r.diagnosticTranscript().some((item) => item.reason === "queue-capacity"),
  ).toBe(true);
  r.runtime.dispatch({ type: "response.retrying", responseId: "r" });
  r.runtime.dispatch({
    type: "response.text.delta",
    responseId: "r",
    delta: "after retry",
  });
  r.runtime.dispatch({ type: "attention.override", mode: "quiet" });
  r.runtime.dispatch({ type: "attention.override", mode: "normal" });
  r.runtime.dispatch({ type: "response.completed", responseId: "r" });
  r.clock.runUntilIdle();
  expect(r.transcript()).toEqual([]);
  r.runtime.dispose();
  expect(r.clock.pendingCount()).toBe(0);
});

it("keeps latest coalesced progress paired with its language", () => {
  const clock = new ManualClock();
  const output: AnnouncementIntent[] = [];
  const scheduler = createAnnouncementScheduler({
    clock,
    minimumGapMs: 0,
    dedupeWindowMs: 1000,
    maxQueueSize: 2,
    onAnnouncement: (item) => output.push(item),
  });
  scheduler.schedule({
    sourceType: "tool.progress",
    channel: "polite",
    text: "Working",
    locale: "en",
    coalesceKey: "progress",
  });
  scheduler.schedule({
    sourceType: "tool.progress",
    channel: "polite",
    text: "En cours",
    locale: "fr",
    coalesceKey: "progress",
  });
  clock.runUntilIdle();
  expect(output).toMatchObject([{ text: "En cours", locale: "fr" }]);
  scheduler.dispose();
});

it("supports host plural and RTL text without interpreting or altering it", () => {
  const formatter = vi.fn(({ count }: Readonly<{ count: number }>) =>
    count === 0 ? "لا مصادر" : count === 2 ? "مصدران" : `${count} مصادر`,
  );
  const r = createAnnouncementRecorder({
    preset: "verbose",
    announcementCatalog: {
      ...catalog({ "citation.available": formatter }),
      locale: "ar",
    },
  });
  for (const count of [0, 2, 5]) {
    r.runtime.dispatch({ type: "citation.available", count });
    r.clock.runUntilIdle();
  }
  expect(r.transcript().map((item) => [item.text, item.locale])).toEqual([
    ["لا مصادر", "ar"],
    ["مصدران", "ar"],
    ["5 مصادر", "ar"],
  ]);
  expect(formatter).toHaveBeenCalledTimes(3);
  r.runtime.dispose();
});

it("does not format stale attempts or lose retry lifecycle after formatter failure", () => {
  const format = vi.fn(() => {
    throw new Error("private");
  });
  const r = createAnnouncementRecorder({
    announcementCatalog: catalog({ "response.retrying": format }),
  });
  r.runtime.dispatch({
    type: "response.started",
    responseId: "r",
    responseInstanceId: "a",
  });
  r.runtime.dispatch({
    type: "response.retrying",
    responseId: "r",
    responseInstanceId: "a",
    nextResponseInstanceId: "b",
  });
  r.clock.runUntilIdle();
  r.runtime.dispatch({
    type: "response.retrying",
    responseId: "r",
    responseInstanceId: "a",
  });
  expect(format).toHaveBeenCalledOnce();
  r.runtime.dispatch({
    type: "response.completed",
    responseId: "r",
    responseInstanceId: "b",
  });
  r.clock.runUntilIdle();
  expect(r.transcript().map((item) => item.text)).toEqual([
    "Status updated.",
    "Response complete.",
  ]);
  r.runtime.dispose();
  expect(r.clock.pendingCount()).toBe(0);
});

it.each([undefined, 0, 2])(
  "preserves an explicitly supplied retry attempt %s across English lifecycle notices",
  (attempt) => {
    const r = createAnnouncementRecorder({ preset: "verbose" });
    const parameters = attempt === undefined ? {} : { attempt };
    r.runtime.dispatch({ type: "response.started", responseId: "response" });
    r.runtime.dispatch({
      type: "response.retrying",
      responseId: "response",
      ...parameters,
    });
    r.clock.runUntilIdle();
    r.runtime.dispatch({ type: "run.started", runId: "run" });
    r.runtime.dispatch({ type: "run.retrying", runId: "run", ...parameters });
    r.clock.runUntilIdle();
    r.runtime.dispatch({
      type: "step.started",
      runId: "run",
      stepId: "step",
      label: "Research",
    });
    r.runtime.dispatch({
      type: "step.retrying",
      runId: "run",
      stepId: "step",
      label: "Research",
      ...parameters,
    });
    r.clock.runUntilIdle();
    const suffix = attempt === undefined ? "" : ` Attempt ${attempt}.`;
    expect(
      r
        .transcript()
        .filter((item) => item.sourceType.endsWith(".retrying"))
        .map((item) => item.text),
    ).toEqual([
      `Retrying response.${suffix}`,
      `Retrying run.${suffix}`,
      `Retrying Research.${suffix}`,
    ]);
    r.runtime.dispose();
  },
);
