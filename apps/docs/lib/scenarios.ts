import type { GenerativeA11yEvent } from "@generative-a11y/core";

export type ScenarioName =
  | "stream"
  | "tool-success"
  | "tool-error"
  | "abort"
  | "retry"
  | "approval";

export interface ScenarioStep {
  readonly at: number;
  readonly event: GenerativeA11yEvent;
  readonly visibleText?: string;
  readonly label: string;
}

const responseId = "release-report";
const toolId = "prepare-report";

const scenarios: Readonly<Record<ScenarioName, readonly ScenarioStep[]>> = {
  stream: [
    {
      at: 0,
      event: { type: "response.started", responseId, responseInstanceId: "attempt-1" },
      label: "Response started",
    },
    {
      at: 250,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-1",
        delta: "The release report summarizes three outcomes. ",
      },
      visibleText: "The release report summarizes three outcomes. ",
      label: "First text delta",
    },
    {
      at: 850,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-1",
        delta: "First, the migration completed successfully. ",
      },
      visibleText: "First, the migration completed successfully. ",
      label: "Second text delta",
    },
    {
      at: 1_450,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-1",
        delta: "No records were lost, and the deployment is ready for review.",
      },
      visibleText: "No records were lost, and the deployment is ready for review.",
      label: "Final text delta",
    },
    {
      at: 2_050,
      event: { type: "response.completed", responseId, responseInstanceId: "attempt-1" },
      label: "Response completed",
    },
  ],
  "tool-success": [
    {
      at: 0,
      event: {
        type: "tool.started",
        toolId,
        toolInstanceId: "tool-run-1",
        label: "Prepare release report",
      },
      label: "Tool started",
    },
    ...[0.25, 0.5, 0.75].map((progress, index) => ({
      at: (index + 1) * 500,
      event: {
        type: "tool.progress" as const,
        toolId,
        toolInstanceId: "tool-run-1",
        label: "Prepare release report",
        progress,
        message: `${progress * 100}% complete`,
      },
      label: `Tool progress ${progress * 100}%`,
    })),
    {
      at: 2_000,
      event: {
        type: "tool.completed",
        toolId,
        toolInstanceId: "tool-run-1",
        label: "Prepare release report",
        summary: "Release report is ready",
      },
      label: "Tool completed",
    },
  ],
  "tool-error": [
    {
      at: 0,
      event: {
        type: "tool.started",
        toolId,
        toolInstanceId: "tool-run-error",
        label: "Prepare release report",
      },
      label: "Tool started",
    },
    {
      at: 700,
      event: {
        type: "tool.failed",
        toolId,
        toolInstanceId: "tool-run-error",
        label: "Prepare release report",
        error: "Private backend stack trace",
        announcement: "The release report could not be prepared.",
      },
      label: "Tool failed with safe announcement copy",
    },
  ],
  abort: [
    {
      at: 0,
      event: { type: "response.started", responseId, responseInstanceId: "abort-1" },
      label: "Response started",
    },
    {
      at: 250,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "abort-1",
        delta: "The release report is still being prepared and this fragment",
      },
      visibleText: "The release report is still being prepared…",
      label: "Incomplete text buffered",
    },
    {
      at: 750,
      event: {
        type: "response.interrupted",
        responseId,
        responseInstanceId: "abort-1",
      },
      label: "Response interrupted; buffered text cancelled",
    },
  ],
  retry: [
    {
      at: 0,
      event: { type: "response.started", responseId, responseInstanceId: "attempt-1" },
      label: "First attempt started",
    },
    {
      at: 300,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-1",
        delta: "The first attempt started but did not finish.",
      },
      visibleText: "The first attempt started but did not finish.",
      label: "First attempt text",
    },
    {
      at: 700,
      event: {
        type: "response.retrying",
        responseId,
        responseInstanceId: "attempt-1",
        nextResponseInstanceId: "attempt-2",
        attempt: 2,
      },
      label: "Retry started with replacement identity",
    },
    {
      at: 1_000,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-1",
        delta: "Late stale transport text.",
      },
      label: "Late stale-response delta suppressed",
    },
    {
      at: 1_250,
      event: {
        type: "response.text.delta",
        responseId,
        responseInstanceId: "attempt-2",
        delta: "The regenerated report is complete and ready for review.",
      },
      visibleText: "The regenerated report is complete and ready for review.",
      label: "Replacement attempt text",
    },
    {
      at: 1_800,
      event: {
        type: "response.completed",
        responseId,
        responseInstanceId: "attempt-2",
      },
      label: "Replacement attempt completed",
    },
  ],
  approval: [
    {
      at: 0,
      event: {
        type: "tool.started",
        toolId,
        toolInstanceId: "approval-tool-1",
        label: "Publish release report",
      },
      label: "Tool started",
    },
    {
      at: 500,
      event: {
        type: "interaction.requested",
        interactionId: "publish-approval",
        kind: "approval",
        label: "Approve publishing the release report",
        urgent: true,
      },
      label: "Approval requested",
    },
    {
      at: 1_200,
      event: {
        type: "interaction.resolved",
        interactionId: "publish-approval",
        kind: "approval",
        outcome: "approved",
        label: "Publishing approved",
      },
      label: "Approval resolved",
    },
    {
      at: 1_700,
      event: {
        type: "tool.completed",
        toolId,
        toolInstanceId: "approval-tool-1",
        label: "Publish release report",
      },
      label: "Tool completed",
    },
  ],
};

export function createScenarioSteps(name: ScenarioName): ScenarioStep[] {
  return scenarios[name].map((step) => ({
    ...step,
    event: { ...step.event },
  }));
}
