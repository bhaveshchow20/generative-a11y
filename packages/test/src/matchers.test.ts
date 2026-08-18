import { expect, test } from "vitest";

import { createAnnouncementRecorder } from "@generative-a11y/core";
import { installVitestMatchers } from "./vitest.js";

installVitestMatchers(expect);

test("matches semantic announcement transcripts and diagnostics", () => {
  const recorder = createAnnouncementRecorder();
  recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
  recorder.runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
  recorder.clock.runUntilIdle();

  expect(recorder).toHaveAnnouncementTranscript([
    { channel: "polite", text: "Response stopped." },
  ]);
  expect(recorder).toHaveAnnounced({ sourceType: "response.interrupted" });
  expect(recorder).toHaveDiagnostic({
    disposition: "suppressed",
    reason: "policy-silent",
  });
});
