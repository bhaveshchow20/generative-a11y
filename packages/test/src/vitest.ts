import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
} from "@generative-a11y/core";
import type {} from "vitest";
import { matchesPartial, type TranscriptRecorder } from "./index.js";

type MatcherResult = { pass: boolean; message: () => string };

function recorder(value: unknown): value is TranscriptRecorder {
  return (
    Boolean(value) &&
    typeof (value as TranscriptRecorder).transcript === "function" &&
    typeof (value as TranscriptRecorder).diagnosticTranscript === "function"
  );
}

function transcriptMessage(
  label: string,
  actual: readonly object[],
  expected: readonly object[],
): MatcherResult {
  const pass =
    actual.length === expected.length &&
    expected.every((entry, index) =>
      matchesPartial(actual[index] ?? {}, entry),
    );
  return {
    pass,
    message: () =>
      `${label} mismatch\nExpected: ${JSON.stringify(expected, null, 2)}\nReceived: ${JSON.stringify(actual, null, 2)}`,
  };
}

export function toHaveAnnouncementTranscript(
  received: unknown,
  expected: readonly Partial<AnnouncementIntent>[],
): MatcherResult {
  if (!recorder(received))
    return {
      pass: false,
      message: () => "Expected an announcement recorder",
    };
  return transcriptMessage(
    "Announcement transcript",
    received.transcript(),
    expected,
  );
}

export function toHaveAnnounced(
  received: unknown,
  expected: Partial<AnnouncementIntent>,
): MatcherResult {
  if (!recorder(received))
    return { pass: false, message: () => "Expected an announcement recorder" };
  const actual = received.transcript();
  const pass = actual.some((entry) => matchesPartial(entry, expected));
  return {
    pass,
    message: () =>
      `Expected announcement: ${JSON.stringify(expected)}\nReceived: ${JSON.stringify(actual, null, 2)}`,
  };
}

export function toHaveDiagnostic(
  received: unknown,
  expected: Partial<AnnouncementDiagnostic>,
): MatcherResult {
  if (!recorder(received))
    return { pass: false, message: () => "Expected an announcement recorder" };
  const actual = received.diagnosticTranscript();
  const pass = actual.some((entry) => matchesPartial(entry, expected));
  return {
    pass,
    message: () =>
      `Expected diagnostic: ${JSON.stringify(expected)}\nReceived: ${JSON.stringify(actual, null, 2)}`,
  };
}

export function installVitestMatchers(expect: {
  extend(matchers: Record<string, unknown>): void;
}): void {
  expect.extend({
    toHaveAnnouncementTranscript,
    toHaveAnnounced,
    toHaveDiagnostic,
  });
}

declare module "vitest" {
  // Vitest declares this generic with `any`; declaration merging requires it.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> {
    toHaveAnnouncementTranscript(
      expected: readonly Partial<AnnouncementIntent>[],
    ): T;
    toHaveAnnounced(expected: Partial<AnnouncementIntent>): T;
    toHaveDiagnostic(expected: Partial<AnnouncementDiagnostic>): T;
  }
}
