import { JSDOM } from "jsdom";
import { expect, it } from "vitest";
import { createRuntime, ManualClock } from "@generative-a11y/core";
import { en } from "@generative-a11y/core/messages";
import { bindRuntime } from "./index.js";

it.each(["live-region", "auto"] as const)(
  "delivers catalog language before %s output and preserves borrowed regions",
  (mode) => {
    const dom = new JSDOM(
      '<html><body><input id="composer"><div id="polite"></div><div id="assertive"></div></body></html>',
    );
    const document = dom.window.document;
    const polite = document.getElementById("polite")!;
    const assertive = document.getElementById("assertive")!;
    const output: Array<{ text: string; locale: string | null }> = [];
    Object.assign(polite, {
      ariaNotify(text: string) {
        output.push({ text, locale: polite.getAttribute("lang") });
      },
    });
    const clock = new ManualClock();
    const runtime = createRuntime({
      clock,
      policy: { minimumGapMs: 0 },
      messages: {
        id: "test-fr",
        locale: "fr",
        messages: {
          ...en.messages,
          "response.completed": "Réponse <terminée>.",
        },
      },
    });
    const binding = bindRuntime(runtime, {
      document,
      mode,
      regions: { polite, assertive },
    });
    document.getElementById("composer")!.focus();
    runtime.dispatch({
      type: "response.started",
      responseId: "r",
      locale: "en",
    });
    runtime.dispatch({ type: "response.completed", responseId: "r" });
    clock.advanceBy(1000);
    expect(polite.lang).toBe("fr");
    if (mode === "auto")
      expect(output).toEqual([{ text: "Réponse <terminée>.", locale: "fr" }]);
    else {
      expect(polite.textContent).toBe("Réponse <terminée>.");
      expect(polite.querySelector("terminée")).toBeNull();
    }
    expect(document.activeElement?.id).toBe("composer");
    binding.dispose();
    runtime.dispose();
    expect(polite.isConnected).toBe(true);
    expect(clock.pendingCount()).toBe(0);
  },
);
