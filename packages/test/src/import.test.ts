import { expect, test } from "vitest";

import { createReplayFixture, recordRuntime, replayEvents } from "./index.js";

test("root entry is safe to import without installing matcher side effects", () => {
  expect(typeof createReplayFixture).toBe("function");
  expect(typeof recordRuntime).toBe("function");
  expect(typeof replayEvents).toBe("function");
});
