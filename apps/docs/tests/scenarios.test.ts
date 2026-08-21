import { describe, expect, it } from "vitest";

import { createScenarioSteps } from "../lib/scenarios";

describe("lifecycle scenarios", () => {
  it("streams append-only deltas before completing", () => {
    const steps = createScenarioSteps("stream");
    expect(steps.map((step) => step.event.type)).toEqual([
      "response.started",
      "response.text.delta",
      "response.text.delta",
      "response.text.delta",
      "response.completed",
    ]);
    expect(
      steps
        .filter((step) => step.event.type === "response.text.delta")
        .map((step) =>
          step.event.type === "response.text.delta" ? step.event.delta : "",
        )
        .join(""),
    ).toMatch(/migration completed successfully/i);
  });

  it("models progress with explicit normalized values", () => {
    const steps = createScenarioSteps("tool-success");
    const progress = steps
      .map((step) => step.event)
      .filter((event) => event.type === "tool.progress");
    expect(progress.map((event) => event.progress)).toEqual([0.25, 0.5, 0.75]);
    expect(steps.at(-1)?.event.type).toBe("tool.completed");
  });

  it("rotates response identity on retry and includes a stale event", () => {
    const steps = createScenarioSteps("retry");
    expect(steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: expect.objectContaining({
            type: "response.retrying",
            nextResponseInstanceId: "attempt-2",
          }),
        }),
        expect.objectContaining({
          event: expect.objectContaining({
            type: "response.text.delta",
            responseInstanceId: "attempt-1",
          }),
        }),
      ]),
    );
  });

  it("supports failure, interruption, and approval lifecycles", () => {
    expect(createScenarioSteps("tool-error").at(-1)?.event.type).toBe(
      "tool.failed",
    );
    expect(createScenarioSteps("abort").at(-1)?.event.type).toBe(
      "response.interrupted",
    );
    expect(createScenarioSteps("approval").map((step) => step.event.type)).toEqual(
      ["tool.started", "interaction.requested", "interaction.resolved", "tool.completed"],
    );
  });
});
