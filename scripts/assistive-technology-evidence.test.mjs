/* global structuredClone */

import { describe, expect, it } from "vitest";

import {
  REQUIRED_AT_MATRIX,
  REQUIRED_AT_SCENARIOS,
  validateAssistiveTechnologyEvidence,
} from "./assistive-technology-evidence.mjs";

const sourceCommit = "0123456789abcdef0123456789abcdef01234567";

function createValidEvidence() {
  return {
    schemaVersion: 1,
    sourceCommit,
    completedAt: "2026-08-20T23:30:00.000Z",
    results: REQUIRED_AT_MATRIX.map((combination, index) => ({
      ...combination,
      testedAt: `2026-08-20T${String(19 + index).padStart(2, "0")}:00:00.000Z`,
      tester: `Tester ${index + 1}`,
      hardware:
        combination.platform === "macos"
          ? "MacBook Pro M4"
          : "Surface Laptop 7",
      osVersion:
        combination.platform === "macos"
          ? "macOS 26.0 build 25A123"
          : "Windows 11 24H2 build 26100.4946",
      browserVersion: `${combination.browser} 140.0.7339.81`,
      assistiveTechnologyVersion: `${combination.assistiveTechnology} 2026.1`,
      settings: "Speech on; default verbosity; documented navigation mode",
      paths: ["auto", "live-region"].map((deliveryPath) => ({
        deliveryPath,
        scenarios: REQUIRED_AT_SCENARIOS.map((scenario) => ({
          scenario,
          status: "pass",
          notes:
            "Observed expected output and focus behavior with synthetic fixture content.",
        })),
      })),
    })),
  };
}

describe("validateAssistiveTechnologyEvidence", () => {
  it("accepts complete evidence for the exact release commit", () => {
    expect(
      validateAssistiveTechnologyEvidence(createValidEvidence(), {
        sourceCommit,
        now: new Date("2026-08-21T00:00:00.000Z"),
      }),
    ).toEqual([]);
  });

  it("rejects evidence from a different commit", () => {
    const errors = validateAssistiveTechnologyEvidence(createValidEvidence(), {
      sourceCommit: "fedcba9876543210fedcba9876543210fedcba98",
    });

    expect(errors).toContain(
      "sourceCommit must match fedcba9876543210fedcba9876543210fedcba98",
    );
  });

  it("rejects a missing required matrix row", () => {
    const evidence = createValidEvidence();
    evidence.results.pop();

    expect(
      validateAssistiveTechnologyEvidence(evidence, { sourceCommit }),
    ).toContain("missing required result: windows/firefox/nvda");
  });

  it("rejects partial paths and non-passing scenarios", () => {
    const evidence = createValidEvidence();
    evidence.results[0].paths.pop();
    evidence.results[1].paths[0].scenarios[0].status = "blocked";

    const errors = validateAssistiveTechnologyEvidence(evidence, {
      sourceCommit,
    });

    expect(errors).toContain(
      "macos/safari/voiceover: missing delivery path live-region",
    );
    expect(errors).toContain(
      "macos/chrome/voiceover auto polite-and-repeated-text: status must be pass",
    );
  });

  it("rejects duplicate rows and placeholder metadata", () => {
    const evidence = createValidEvidence();
    evidence.results.push(structuredClone(evidence.results[0]));
    evidence.results[0].tester = "TODO";

    const errors = validateAssistiveTechnologyEvidence(evidence, {
      sourceCommit,
    });

    expect(errors).toContain("duplicate result: macos/safari/voiceover");
    expect(errors).toContain(
      "macos/safari/voiceover: tester must be a real, non-placeholder value",
    );
  });

  it("rejects non-version metadata and trivial observation notes", () => {
    const evidence = createValidEvidence();
    evidence.results[0].browserVersion = "unknown browser";
    evidence.results[0].paths[0].scenarios[0].notes = "yes";

    const errors = validateAssistiveTechnologyEvidence(evidence, {
      sourceCommit,
    });

    expect(errors).toContain(
      "macos/safari/voiceover: browserVersion must be a real, non-placeholder value",
    );
    expect(errors).toContain(
      "macos/safari/voiceover auto polite-and-repeated-text: notes must be a real, non-placeholder observation",
    );
  });

  it("rejects stale evidence", () => {
    const errors = validateAssistiveTechnologyEvidence(createValidEvidence(), {
      sourceCommit,
      now: new Date("2026-09-21T00:00:00.000Z"),
    });

    expect(errors).toContain("completedAt must be no more than 30 days old");
  });

  it("rejects non-canonical timestamps and stale or future matrix rows", () => {
    const evidence = createValidEvidence();
    evidence.completedAt = "August 20, 2026";
    evidence.results[0].testedAt = "2001-01-01T00:00:00.000Z";
    evidence.results[1].testedAt = "2026-08-21T00:10:00.000Z";

    const errors = validateAssistiveTechnologyEvidence(evidence, {
      sourceCommit,
      now: new Date("2026-08-21T00:00:00.000Z"),
    });

    expect(errors).toContain(
      "completedAt must be a canonical UTC ISO timestamp",
    );
    expect(errors).toContain(
      "macos/safari/voiceover: testedAt must be no more than 30 days old",
    );
    expect(errors).toContain(
      "macos/chrome/voiceover: testedAt must not be in the future",
    );
  });

  it("rejects rows recorded after the matrix completion time", () => {
    const evidence = createValidEvidence();
    evidence.results[0].testedAt = "2026-08-20T23:45:00.000Z";

    expect(
      validateAssistiveTechnologyEvidence(evidence, {
        sourceCommit,
        now: new Date("2026-08-21T00:00:00.000Z"),
      }),
    ).toContain(
      "macos/safari/voiceover: testedAt must not be after completedAt",
    );
  });
});
