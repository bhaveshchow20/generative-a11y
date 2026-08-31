import assert from "node:assert/strict";
import test from "node:test";
import { runHierarchicalWorkflowExample } from "./index.mjs";

test("demonstrates hierarchy, retry isolation, failure priority, and cleanup", () => {
  const result = runHierarchicalWorkflowExample();
  const texts = result.transcript.map((item) => item.text);

  assert.equal(result.snapshot.pendingCount, 0);
  assert.equal(result.disposedDispatchAccepted, false);
  assert.equal(result.snapshot.runs?.[0]?.status, "completed");
  assert.equal(
    result.snapshot.steps?.find((step) => step.stepId === "optional-check")
      ?.status,
    "failed",
  );
  assert.ok(
    result.diagnostics.some(
      (item) => item.reason === "stale-step" && item.toolId === "late-search",
    ),
  );
  assert.ok(!texts.some((text) => text.includes("Stale search")));
  assert.ok(
    result.transcript.some(
      (item) =>
        item.channel === "assertive" &&
        item.text === "Optional quality check failed.",
    ),
  );
  assert.equal(
    new Set(result.transcript.map((item) => item.id)).size,
    result.transcript.length,
  );
  assert.ok(texts.at(-1)?.includes("Run complete"));
});
