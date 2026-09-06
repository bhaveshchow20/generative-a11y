import type {
  AttentionMode,
  AttentionOverride,
  AttentionPolicy,
  AttentionState,
} from "./types.js";

/** Controls are runtime-wide; even partial entity attribution is invalid. */
export function hasAttentionScope(event: object): boolean {
  return [
    "runId",
    "runInstanceId",
    "stepId",
    "stepInstanceId",
    "responseId",
    "responseInstanceId",
    "toolId",
    "toolInstanceId",
    "interactionId",
    "approvalId",
  ].some((key) => key in event);
}

export function isAttentionMode(value: unknown): value is AttentionMode {
  return (
    value === "foreground" ||
    value === "background" ||
    value === "reading-history" ||
    value === "away" ||
    value === "unknown"
  );
}

export function isAttentionOverride(
  value: unknown,
): value is AttentionOverride {
  return value === "auto" || value === "normal" || value === "quiet";
}

export function resolveAttentionState(
  policy: Readonly<AttentionPolicy>,
  observed: AttentionMode,
  override: AttentionOverride,
): AttentionState {
  const automaticQuiet =
    observed !== "unknown" &&
    observed !== "foreground" &&
    policy.quietWhen.includes(observed);
  return Object.freeze({
    observed,
    override,
    effective:
      override === "auto" ? (automaticQuiet ? "quiet" : "normal") : override,
  });
}
