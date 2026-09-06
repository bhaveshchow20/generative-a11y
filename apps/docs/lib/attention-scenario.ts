import type { GenerativeA11yEvent } from "@generative-a11y/core";

const response = { responseId: "attention-report", responseInstanceId: "attempt-1" };
const tool = { toolId: "prepare-report", toolInstanceId: "tool-run-1", label: "Prepare report" };

/** Host-controlled steps: each action reports a confirmed lifecycle event. */
export const attentionScenario: readonly GenerativeA11yEvent[] = [
  { type: "response.started", ...response },
  { type: "response.text.delta", ...response, delta: "The report is ready. " },
  { type: "response.text.delta", ...response, delta: "This sentence crosses " },
  { type: "response.text.delta", ...response, delta: "the attention change. " },
  { type: "response.text.delta", ...response, delta: "Here is a fresh sentence. " },
  { type: "tool.started", ...tool },
  { type: "tool.completed", ...tool },
  { type: "interaction.requested", interactionId: "publish-report", kind: "approval", label: "Publish the report?" },
  { type: "interaction.resolved", interactionId: "publish-report", kind: "approval", outcome: "approved", label: "Publishing approved" },
  { type: "response.completed", ...response },
];
