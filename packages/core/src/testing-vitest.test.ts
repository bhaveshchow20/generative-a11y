import { expect, test } from "vitest";

import { createRecorder } from "./index.js";
import { installVitestMatchers } from "./testing.js";

const accessibilityExpect = installVitestMatchers(expect);

test("the testing entry installs semantic Vitest matchers", () => {
  const recorder = createRecorder();
  recorder.runtime.dispatch({ type: "response.started", responseId: "r1" });
  recorder.runtime.dispatch({ type: "response.interrupted", responseId: "r1" });
  recorder.clock.runUntilIdle();

  accessibilityExpect(recorder).toHaveAnnouncementTranscript([
    { channel: "polite", text: "Response stopped." },
  ]);
  accessibilityExpect(recorder).toHaveAnnounced({
    sourceType: "response.interrupted",
  });
  accessibilityExpect(recorder).toHaveDiagnostic({
    disposition: "suppressed",
    reason: "policy-silent",
  });
});
