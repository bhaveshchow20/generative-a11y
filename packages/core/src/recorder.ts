import { ManualClock } from "./clock.js";
import { createRuntime, type RuntimeOptions } from "./runtime.js";
import type { AnnouncementDiagnostic, AnnouncementIntent } from "./types.js";

export interface Recorder {
  runtime: ReturnType<typeof createRuntime>;
  clock: ManualClock;
  transcript(): AnnouncementIntent[];
  diagnosticTranscript(): AnnouncementDiagnostic[];
  clear(): void;
}

export function createRecorder(
  options: Omit<RuntimeOptions, "clock" | "onAnnouncement" | "onDiagnostic"> & {
    startAt?: number;
  } = {},
): Recorder {
  const { startAt, ...runtimeOptions } = options;
  const clock = new ManualClock(startAt);
  const announcements: AnnouncementIntent[] = [];
  const diagnostics: AnnouncementDiagnostic[] = [];
  const runtime = createRuntime({
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
