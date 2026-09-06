import { describe, expect, it } from "vitest";
import { createRuntime, ManualClock, type AnnouncementIntent } from "@generative-a11y/core";
import { attentionScenario } from "../lib/attention-scenario";

describe("attention host scenario", () => {
  it("retains terminal and approval intents while quiet drops response text", () => {
    const clock = new ManualClock();
    const intents: AnnouncementIntent[] = [];
    const runtime = createRuntime({ clock, preset: "verbose", policy: {
      attention: { enabled: true }, minimumGapMs: 0,
      text: { minimumCharacters: 1, maximumDelayMs: 0 },
      tools: { announceStartAfterMs: 0 },
    } });
    const unsubscribe = runtime.subscribeAnnouncements((intent) => intents.push(intent));
    runtime.dispatch({ type: "attention.override", mode: "quiet" });
    for (const event of attentionScenario) {
      runtime.dispatch(event);
      clock.runUntilIdle();
    }
    expect(intents.some((intent) => intent.sourceType === "response.text.delta")).toBe(false);
    expect(intents.some((intent) => /report is ready|fresh sentence|attention change/.test(intent.text))).toBe(false);
    expect(intents.map((intent) => intent.sourceType)).toEqual(expect.arrayContaining([
      "tool.completed", "interaction.requested", "interaction.resolved", "response.completed",
    ]));
    expect(runtime.getDiagnosticSnapshot().attention?.effective).toBe("quiet");
    unsubscribe();
    runtime.dispose();
    expect(clock.pendingCount()).toBe(0);
  });

  it("keeps event identities stable through approval resolution", () => {
    const responseEvents = attentionScenario.filter((event) => "responseId" in event);
    expect(new Set(responseEvents.map((event) => event.responseId)).size).toBe(1);
    expect(new Set(responseEvents.map((event) => event.responseInstanceId)).size).toBe(1);
    const interactions = attentionScenario.filter((event) => "interactionId" in event);
    expect(interactions.map((event) => event.interactionId)).toEqual(["publish-report", "publish-report"]);
  });
});
