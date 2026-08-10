import { ManualClock } from "./clock.js";
import { createGenerativeA11y, type GenerativeA11yOptions } from "./runtime.js";
import type { AnnouncementDiagnostic, AnnouncementIntent } from "./types.js";

export interface AnnouncementRecorder {
  runtime: ReturnType<typeof createGenerativeA11y>;
  clock: ManualClock;
  transcript(): AnnouncementIntent[];
  diagnosticTranscript(): AnnouncementDiagnostic[];
  clear(): void;
}

export function createAnnouncementRecorder(
  options: Omit<
    GenerativeA11yOptions,
    "clock" | "onAnnouncement" | "onDiagnostic"
  > & {
    startAt?: number;
  } = {},
): AnnouncementRecorder {
  const { startAt, ...runtimeOptions } = options;
  const clock = new ManualClock(startAt);
  const announcements: AnnouncementIntent[] = [];
  const diagnostics: AnnouncementDiagnostic[] = [];
  const runtime = createGenerativeA11y({
    ...runtimeOptions,
    clock,
    onAnnouncement: (announcement) => announcements.push(announcement),
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  return {
    runtime,
    clock,
    transcript: () => announcements.map((item) => ({ ...item })),
    diagnosticTranscript: () => diagnostics.map((item) => ({ ...item })),
    clear() {
      announcements.length = 0;
      diagnostics.length = 0;
    },
  };
}
