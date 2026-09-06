import type {
  AnnouncementPolicy,
  PresetName,
  ReadonlyAnnouncementPolicy,
} from "./types.js";

const balanced: AnnouncementPolicy = {
  attention: { enabled: false, quietWhen: ["background"] },
  text: { strategy: "sentence", minimumCharacters: 24, maximumDelayMs: 2_500 },
  tools: {
    announceStart: true,
    announceStartAfterMs: 1_500,
    announceProgress: false,
    progressEveryPercent: 25,
    announceCompletion: true,
    announceFailure: true,
  },
  workflows: {
    runs: "terminal",
    steps: "long-running",
    announceStepAfterMs: 2_000,
    announceProgress: false,
    announceNestedSteps: false,
  },
  announceResponseStarted: false,
  announceResponseCompleted: true,
  announceInterruption: true,
  announceRetry: true,
  announceInteractions: true,
  announceConnections: true,
  announceCitations: false,
  errorChannel: "assertive",
  minimumGapMs: 100,
  dedupeWindowMs: 2_000,
  maxQueueSize: 200,
  maxActiveEntities: 1_000,
};

const mutablePresets: Record<PresetName, AnnouncementPolicy> = {
  minimal: {
    ...balanced,
    text: { strategy: "completion", minimumCharacters: 0, maximumDelayMs: 0 },
    tools: {
      ...balanced.tools,
      announceStart: false,
      announceCompletion: false,
    },
    workflows: { ...balanced.workflows, steps: "silent" },
    announceResponseCompleted: false,
    announceRetry: false,
    announceConnections: false,
  },
  balanced,
  verbose: {
    ...balanced,
    text: { strategy: "sentence", minimumCharacters: 1, maximumDelayMs: 1_000 },
    tools: { ...balanced.tools, announceProgress: true },
    workflows: {
      runs: "all",
      steps: "all",
      announceStepAfterMs: 0,
      announceProgress: true,
      announceNestedSteps: true,
    },
    announceResponseStarted: true,
    announceCitations: true,
    minimumGapMs: 50,
  },
  "completion-only": {
    ...balanced,
    text: { strategy: "completion", minimumCharacters: 0, maximumDelayMs: 0 },
    tools: {
      ...balanced.tools,
      announceStart: false,
      announceProgress: false,
      announceCompletion: false,
      announceFailure: false,
    },
    workflows: {
      ...balanced.workflows,
      runs: "silent",
      steps: "silent",
    },
    announceResponseCompleted: false,
    announceInterruption: false,
    announceRetry: false,
    announceInteractions: false,
    announceConnections: false,
    announceCitations: false,
  },
};

function freezePolicy(policy: AnnouncementPolicy): ReadonlyAnnouncementPolicy {
  if (policy.attention) {
    Object.freeze(policy.attention.quietWhen);
    Object.freeze(policy.attention);
  }
  Object.freeze(policy.text);
  Object.freeze(policy.tools);
  Object.freeze(policy.workflows);
  return Object.freeze(policy);
}

export const presets: Readonly<Record<PresetName, ReadonlyAnnouncementPolicy>> =
  Object.freeze({
    minimal: freezePolicy(mutablePresets.minimal),
    balanced: freezePolicy(mutablePresets.balanced),
    verbose: freezePolicy(mutablePresets.verbose),
    "completion-only": freezePolicy(mutablePresets["completion-only"]),
  });

export type PolicyOverrides = Partial<
  Omit<AnnouncementPolicy, "text" | "tools" | "workflows" | "attention">
> & {
  attention?: Partial<NonNullable<AnnouncementPolicy["attention"]>>;
  text?: Partial<AnnouncementPolicy["text"]>;
  tools?: Partial<AnnouncementPolicy["tools"]>;
  workflows?: Partial<AnnouncementPolicy["workflows"]>;
};

export function resolvePolicy(
  preset: PresetName = "balanced",
  overrides: PolicyOverrides = {},
): ReadonlyAnnouncementPolicy {
  const base = presets[preset];
  const attention = {
    enabled: false,
    quietWhen: ["background"] as NonNullable<
      AnnouncementPolicy["attention"]
    >["quietWhen"],
    ...base.attention,
    ...overrides.attention,
  };
  if (typeof attention.enabled !== "boolean")
    throw new TypeError("attention.enabled must be a boolean");
  if (
    !Array.isArray(attention.quietWhen) ||
    [...attention.quietWhen].some(
      (mode) =>
        mode !== "background" && mode !== "reading-history" && mode !== "away",
    )
  ) {
    throw new TypeError(
      "attention.quietWhen must contain background, reading-history, or away",
    );
  }
  const policy: AnnouncementPolicy = {
    ...base,
    ...overrides,
    attention: { ...attention, quietWhen: [...new Set(attention.quietWhen)] },
    text: { ...base.text, ...overrides.text },
    tools: { ...base.tools, ...overrides.tools },
    workflows: { ...base.workflows, ...overrides.workflows },
  };
  const finiteNonNegative: Array<[string, number]> = [
    ["text.minimumCharacters", policy.text.minimumCharacters],
    ["text.maximumDelayMs", policy.text.maximumDelayMs],
    ["tools.announceStartAfterMs", policy.tools.announceStartAfterMs],
    ["workflows.announceStepAfterMs", policy.workflows.announceStepAfterMs],
    ["minimumGapMs", policy.minimumGapMs],
    ["dedupeWindowMs", policy.dedupeWindowMs],
  ];
  for (const [name, value] of finiteNonNegative) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite non-negative number`);
    }
  }
  if (
    !Number.isFinite(policy.tools.progressEveryPercent) ||
    policy.tools.progressEveryPercent <= 0 ||
    policy.tools.progressEveryPercent > 100
  ) {
    throw new RangeError(
      "tools.progressEveryPercent must be greater than 0 and at most 100",
    );
  }
  if (!Number.isInteger(policy.maxQueueSize) || policy.maxQueueSize <= 0) {
    throw new RangeError("maxQueueSize must be a positive integer");
  }
  if (
    !Number.isInteger(policy.maxActiveEntities) ||
    policy.maxActiveEntities <= 0
  ) {
    throw new RangeError("maxActiveEntities must be a positive integer");
  }
  if (!new Set(["silent", "terminal", "all"]).has(policy.workflows.runs))
    throw new TypeError("workflows.runs contains an unsupported mode");
  if (!new Set(["silent", "long-running", "all"]).has(policy.workflows.steps))
    throw new TypeError("workflows.steps contains an unsupported mode");
  if (typeof policy.workflows.announceProgress !== "boolean")
    throw new TypeError("workflows.announceProgress must be a boolean");
  if (typeof policy.workflows.announceNestedSteps !== "boolean")
    throw new TypeError("workflows.announceNestedSteps must be a boolean");
  return freezePolicy(policy);
}
