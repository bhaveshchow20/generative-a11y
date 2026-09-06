import { expect, it } from "vitest";
import { createAnnouncementRecorder, normalizeAdapterAnnouncementCopy } from "@generative-a11y/core";
import { frenchCatalog, frenchAdapterCopy } from "../lib/french-announcements";

it("runs the complete illustrative catalog with independently tagged answer text", () => {
  const recorder = createAnnouncementRecorder({announcementCatalog:frenchCatalog,policy:{minimumGapMs:0,text:{minimumCharacters:1}}});
  recorder.runtime.dispatch({type:"response.started",responseId:"r",locale:"en"});
  recorder.runtime.dispatch({type:"response.text.delta",responseId:"r",delta:"English response. "});
  recorder.runtime.dispatch({type:"response.completed",responseId:"r"});
  recorder.clock.runUntilIdle();
  expect(recorder.transcript()).toMatchObject([{text:"English response.",locale:"en"},{text:"Réponse terminée.",locale:"fr"}]);
  expect(frenchCatalog.messages["citation.available"]({count:1})).toBe("1 source disponible.");
  expect(frenchCatalog.messages["citation.available"]({count:2})).toBe("2 sources disponibles.");
  expect(normalizeAdapterAnnouncementCopy(frenchAdapterCopy)).toEqual(frenchAdapterCopy);
  recorder.runtime.dispose();expect(recorder.clock.pendingCount()).toBe(0);
});
