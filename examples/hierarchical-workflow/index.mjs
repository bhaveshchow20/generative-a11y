import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * Runs a deterministic hierarchical workflow without rendering or replacing
 * host UI. The returned data is content-free except for localized example
 * labels and prepared announcement text.
 */
export function runHierarchicalWorkflowExample() {
  const clock = new ManualClock(1_000);
  const transcript = [];
  const diagnostics = [];
  const events = [];
  const runtime = createGenerativeA11y({
    clock,
    preset: "verbose",
    policy: {
      minimumGapMs: 0,
      dedupeWindowMs: 0,
      tools: { announceStartAfterMs: 0 },
      workflows: { announceStepAfterMs: 0 },
    },
    onAnnouncement: (intent) => transcript.push(intent),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  const dispatch = (event) => {
    events.push(event);
    runtime.dispatch(event);
    clock.runUntilIdle();
  };

  dispatch({ type: "run.started", runId: "report", runInstanceId: "run-1" });

  dispatch({
    type: "step.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "plan",
    stepInstanceId: "plan-1",
    label: "Plan report",
  });
  dispatch({
    type: "step.completed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "plan",
    stepInstanceId: "plan-1",
    label: "Plan report",
  });

  for (const [stepId, label] of [
    ["sources", "Collect sources"],
    ["outline", "Draft outline"],
  ]) {
    dispatch({
      type: "step.started",
      runId: "report",
      runInstanceId: "run-1",
      stepId,
      stepInstanceId: `${stepId}-1`,
      label,
    });
  }
  dispatch({
    type: "tool.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-1",
    toolId: "search",
    toolInstanceId: "search-1",
    label: "Search sources",
  });
  dispatch({
    type: "tool.completed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-1",
    toolId: "search",
    toolInstanceId: "search-1",
    label: "Search sources",
  });
  dispatch({
    type: "step.completed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "outline",
    stepInstanceId: "outline-1",
    label: "Draft outline",
  });

  dispatch({
    type: "step.retrying",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-1",
    nextStepInstanceId: "sources-2",
    attempt: 2,
    label: "Collect sources",
  });
  dispatch({
    type: "tool.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-1",
    toolId: "late-search",
    label: "Stale search",
  });
  dispatch({
    type: "step.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-2",
    label: "Collect sources",
  });
  dispatch({
    type: "step.completed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "sources",
    stepInstanceId: "sources-2",
    label: "Collect sources",
  });

  dispatch({
    type: "step.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "approval",
    stepInstanceId: "approval-1",
    label: "Review approval",
  });
  dispatch({
    type: "interaction.requested",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "approval",
    stepInstanceId: "approval-1",
    interactionId: "publish-approval",
    kind: "approval",
    label: "Approve publication",
    urgent: true,
  });
  dispatch({
    type: "interaction.resolved",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "approval",
    stepInstanceId: "approval-1",
    interactionId: "publish-approval",
    kind: "approval",
    outcome: "approved",
    label: "Approve publication",
  });
  dispatch({
    type: "step.completed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "approval",
    stepInstanceId: "approval-1",
    label: "Review approval",
  });

  dispatch({
    type: "step.started",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "optional-check",
    stepInstanceId: "optional-check-1",
    label: "Optional quality check",
  });
  dispatch({
    type: "step.failed",
    runId: "report",
    runInstanceId: "run-1",
    stepId: "optional-check",
    stepInstanceId: "optional-check-1",
    label: "Optional quality check",
    announcement: "Optional quality check failed.",
  });
  dispatch({ type: "run.completed", runId: "report", runInstanceId: "run-1" });

  const snapshot = runtime.getDiagnosticSnapshot();
  const result = {
    events: events.map((event) => ({ ...event })),
    policy: runtime.getPolicy(),
    transcript: transcript.map((intent) => ({ ...intent })),
    diagnostics: diagnostics.map((diagnostic) => ({ ...diagnostic })),
    snapshot,
  };
  runtime.dispose();
  return {
    ...result,
    disposedDispatchAccepted: runtime.dispatch({
      type: "run.started",
      runId: "after-dispose",
    }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stdout.write(
    `${JSON.stringify(runHierarchicalWorkflowExample(), null, 2)}\n`,
  );
}
