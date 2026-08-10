import type {
  AnnouncementPolicy,
  PresetName,
  ReadonlyAnnouncementPolicy,
} from "./types.js";

const balanced: AnnouncementPolicy = {
  text: { strategy: "sentence", minimumCharacters: 24, maximumDelayMs: 2_500 },
  tools: {
    announceStart: true,
    announceStartAfterMs: 1_500,
    announceProgress: false,
    progressEveryPercent: 25,
    announceCompletion: true,
    announceFailure: true,
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
    announceResponseCompleted: false,
    announceRetry: false,
    announceConnections: false,
  },
  balanced,
  verbose: {
    ...balanced,
    text: { strategy: "sentence", minimumCharacters: 1, maximumDelayMs: 1_000 },
    tools: { ...balanced.tools, announceProgress: true },
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
    announceResponseCompleted: false,
    announceInterruption: false,
    announceRetry: false,
    announceInteractions: false,
    announceConnections: false,
    announceCitations: false,
  },
};

function freezePolicy(policy: AnnouncementPolicy): ReadonlyAnnouncementPolicy {
  Object.freeze(policy.text);
  Object.freeze(policy.tools);
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
  Omit<AnnouncementPolicy, "text" | "tools">
> & {
  text?: Partial<AnnouncementPolicy["text"]>;
  tools?: Partial<AnnouncementPolicy["tools"]>;
};

export function resolvePolicy(
  preset: PresetName = "balanced",
  overrides: PolicyOverrides = {},
): ReadonlyAnnouncementPolicy {
  const base = presets[preset];
  const policy: AnnouncementPolicy = {
    ...base,
    ...overrides,
    text: { ...base.text, ...overrides.text },
    tools: { ...base.tools, ...overrides.tools },
  };
  const finiteNonNegative: Array<[string, number]> = [
    ["text.minimumCharacters", policy.text.minimumCharacters],
    ["text.maximumDelayMs", policy.text.maximumDelayMs],
    ["tools.announceStartAfterMs", policy.tools.announceStartAfterMs],
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
  return freezePolicy(policy);
}
