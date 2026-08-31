import type { Clock, ClockTimer } from "./clock.js";
import type {
  AnnouncementChannel,
  AnnouncementDiagnostic,
  AnnouncementIntent,
  DiagnosticPendingAnnouncement,
  DiagnosticReason,
  GenerativeA11yEvent,
} from "./types.js";

export type AnnouncementCapacityPriority = "status" | "content";

export interface ScheduleAnnouncement {
  channel: AnnouncementChannel;
  text: string;
  sourceType: GenerativeA11yEvent["type"];
  sourceEventId?: string;
  responseId?: string;
  toolId?: string;
  interactionId?: string;
  runId?: string;
  runInstanceId?: string;
  stepId?: string;
  stepInstanceId?: string;
  locale?: string;
  delayMs?: number;
  scope?: string;
  coalesceKey?: string;
  dedupeKey?: string;
  capacityPriority?: AnnouncementCapacityPriority;
}

interface ScheduledItem extends ScheduleAnnouncement {
  id: string;
  scheduledAt: number;
  dueAt: number;
  sequence: number;
}

export interface AnnouncementSchedulerOptions {
  clock: Clock;
  minimumGapMs: number;
  dedupeWindowMs: number;
  maxQueueSize: number;
  onAnnouncement: (announcement: AnnouncementIntent) => void;
  onDeliveryError?: (error: unknown, announcement: AnnouncementIntent) => void;
  onDiagnostic?: (diagnostic: AnnouncementDiagnostic) => void;
}

export interface AnnouncementScheduler {
  schedule(candidate: ScheduleAnnouncement): string | undefined;
  cancelScope(scope: string): void;
  dispose(): void;
  pendingCount(): number;
  getDiagnosticSnapshot(): readonly DiagnosticPendingAnnouncement[];
}

export function createAnnouncementScheduler(
  options: AnnouncementSchedulerOptions,
): AnnouncementScheduler {
  for (const [name, value] of [
    ["minimumGapMs", options.minimumGapMs],
    ["dedupeWindowMs", options.dedupeWindowMs],
  ] as const) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${name} must be a finite non-negative number`);
    }
  }
  if (!Number.isInteger(options.maxQueueSize) || options.maxQueueSize <= 0) {
    throw new RangeError("maxQueueSize must be a positive integer");
  }
  const { clock } = options;
  let sequence = 0;
  let nextId = 1;
  let timer: ClockTimer | undefined;
  let lastDeliveredAt = Number.NEGATIVE_INFINITY;
  let disposed = false;
  const queue: ScheduledItem[] = [];
  const deliveredDedupe = new Map<string, number>();
  const diagnosticQueue: AnnouncementDiagnostic[] = [];
  const diagnosticDrainBudget = Math.max(16, options.maxQueueSize * 4);
  let suppressedDiagnosticCount = 0;
  let reportingDiagnostics = false;
  let suppressDiagnosticEnqueue = false;

  function capacityPriorityRank(item: ScheduleAnnouncement): number {
    return item.capacityPriority === "status" ? 0 : 1;
  }

  function diagnostic(
    disposition: AnnouncementDiagnostic["disposition"],
    reason: DiagnosticReason,
    item?: ScheduledItem,
  ): void {
    if (!options.onDiagnostic || suppressDiagnosticEnqueue) return;
    const value: AnnouncementDiagnostic = {
      at: clock.now(),
      disposition,
      reason,
      ...(item
        ? { announcement: toIntent(item), sourceType: item.sourceType }
        : {}),
      ...(item?.sourceEventId ? { sourceEventId: item.sourceEventId } : {}),
      ...(item?.responseId ? { responseId: item.responseId } : {}),
      ...(item?.toolId ? { toolId: item.toolId } : {}),
      ...(item?.interactionId ? { interactionId: item.interactionId } : {}),
      ...(item?.runId ? { runId: item.runId } : {}),
      ...(item?.runInstanceId ? { runInstanceId: item.runInstanceId } : {}),
      ...(item?.stepId ? { stepId: item.stepId } : {}),
      ...(item?.stepInstanceId ? { stepInstanceId: item.stepInstanceId } : {}),
      ...(item
        ? {
            scheduledAt: item.scheduledAt,
            dueAt: item.dueAt,
            delayMs: item.delayMs ?? 0,
            queueSequence: item.sequence,
          }
        : {}),
    };
    if (diagnosticQueue.length >= diagnosticDrainBudget) {
      suppressedDiagnosticCount += 1;
      return;
    }
    diagnosticQueue.push(value);
  }

  function drainDiagnostics(): void {
    if (reportingDiagnostics || !options.onDiagnostic) return;
    reportingDiagnostics = true;
    let delivered = 0;
    try {
      while (diagnosticQueue.length > 0 && delivered < diagnosticDrainBudget) {
        const next = diagnosticQueue.shift();
        if (!next) break;
        delivered += 1;
        try {
          options.onDiagnostic(next);
        } catch {
          // Diagnostic observers are best-effort and cannot alter scheduling.
        }
      }
      const aggregatedCount =
        diagnosticQueue.length + suppressedDiagnosticCount;
      diagnosticQueue.length = 0;
      suppressedDiagnosticCount = 0;
      if (aggregatedCount > 0) {
        suppressDiagnosticEnqueue = true;
        try {
          options.onDiagnostic({
            at: clock.now(),
            disposition: "suppressed",
            reason: "queue-capacity",
            count: aggregatedCount,
          });
        } catch {
          // Diagnostic observers are best-effort and cannot alter scheduling.
        } finally {
          suppressDiagnosticEnqueue = false;
        }
      }
    } finally {
      reportingDiagnostics = false;
    }
  }

  function toIntent(item: ScheduledItem): AnnouncementIntent {
    return {
      id: item.id,
      at: clock.now(),
      channel: item.channel,
      text: item.text,
      sourceType: item.sourceType,
      ...(item.sourceEventId ? { sourceEventId: item.sourceEventId } : {}),
      ...(item.responseId ? { responseId: item.responseId } : {}),
      ...(item.toolId ? { toolId: item.toolId } : {}),
      ...(item.interactionId ? { interactionId: item.interactionId } : {}),
      ...(item.runId ? { runId: item.runId } : {}),
      ...(item.runInstanceId ? { runInstanceId: item.runInstanceId } : {}),
      ...(item.stepId ? { stepId: item.stepId } : {}),
      ...(item.stepInstanceId ? { stepInstanceId: item.stepInstanceId } : {}),
      ...(item.locale ? { locale: item.locale } : {}),
    };
  }

  function pruneDedupe(now: number): void {
    for (const [key, deliveredAt] of deliveredDedupe) {
      if (now - deliveredAt > options.dedupeWindowMs)
        deliveredDedupe.delete(key);
    }
  }

  function scheduleTimer(): void {
    if (disposed) return;
    if (timer !== undefined) clock.clearTimeout(timer);
    timer = undefined;
    const next = selectNext(false);
    if (!next) return;
    timer = clock.setTimeout(pump, Math.max(0, eligibleAt(next) - clock.now()));
  }

  function eligibleAt(item: ScheduledItem): number {
    return item.channel === "assertive"
      ? item.dueAt
      : Math.max(item.dueAt, lastDeliveredAt + options.minimumGapMs);
  }

  function selectNext(onlyEligible: boolean): ScheduledItem | undefined {
    const now = clock.now();
    return [...queue]
      .filter((item) => !onlyEligible || eligibleAt(item) <= now)
      .sort((left, right) => {
        if (onlyEligible && left.channel !== right.channel) {
          return left.channel === "assertive" ? -1 : 1;
        }
        return (
          eligibleAt(left) - eligibleAt(right) ||
          left.dueAt - right.dueAt ||
          left.sequence - right.sequence
        );
      })[0];
  }

  function pump(): void {
    timer = undefined;
    if (disposed) return;
    const item = selectNext(true);
    if (!item) {
      scheduleTimer();
      return;
    }
    queue.splice(queue.indexOf(item), 1);
    const entityKey =
      item.responseId ??
      item.toolId ??
      item.interactionId ??
      item.scope ??
      "global";
    const dedupeKey =
      item.dedupeKey ??
      `${item.sourceType}:${entityKey}:${item.channel}:${item.text}`;
    pruneDedupe(clock.now());
    const duplicateAt = deliveredDedupe.get(dedupeKey);
    if (
      duplicateAt !== undefined &&
      clock.now() - duplicateAt <= options.dedupeWindowMs
    ) {
      diagnostic("suppressed", "duplicate", item);
    } else {
      const intent = toIntent(item);
      try {
        options.onAnnouncement(intent);
        deliveredDedupe.set(dedupeKey, clock.now());
        while (deliveredDedupe.size > options.maxQueueSize) {
          const oldestKey = deliveredDedupe.keys().next().value as
            string | undefined;
          if (oldestKey === undefined) break;
          deliveredDedupe.delete(oldestKey);
        }
        lastDeliveredAt = clock.now();
        diagnostic("announced", "delivered", item);
      } catch (error) {
        diagnostic("suppressed", "delivery-error", item);
        try {
          options.onDeliveryError?.(error, intent);
        } catch {
          // Delivery error observers must not strand the remaining queue.
        }
      }
    }
    scheduleTimer();
    drainDiagnostics();
  }

  return {
    schedule(candidate) {
      if (disposed || !candidate.text.trim()) return undefined;
      if (
        !Number.isFinite(candidate.delayMs ?? 0) ||
        (candidate.delayMs ?? 0) < 0
      ) {
        throw new RangeError("delayMs must be a finite non-negative number");
      }
      if (candidate.coalesceKey) {
        const existingIndex = queue.findIndex(
          (item) => item.coalesceKey === candidate.coalesceKey,
        );
        const existing = queue[existingIndex];
        if (existing) {
          const replacement: ScheduledItem = {
            ...candidate,
            id: existing.id,
            sequence: existing.sequence,
            scheduledAt: clock.now(),
            dueAt: clock.now() + Math.max(0, candidate.delayMs ?? 0),
          };
          queue[existingIndex] = replacement;
          diagnostic("merged", "coalesced", replacement);
          scheduleTimer();
          drainDiagnostics();
          return replacement.id;
        }
      }
      const item: ScheduledItem = {
        ...candidate,
        id: `announcement-${nextId++}`,
        scheduledAt: clock.now(),
        dueAt: clock.now() + Math.max(0, candidate.delayMs ?? 0),
        sequence: sequence++,
      };
      let queued = false;
      if (queue.length >= options.maxQueueSize) {
        const capacityCandidates = [...queue, item];
        const hasPoliteCandidate = capacityCandidates.some(
          (entry) => entry.channel === "polite",
        );
        const evictionPool = capacityCandidates.filter(
          (entry) => entry.channel === "polite" || !hasPoliteCandidate,
        );
        const dropped = evictionPool.sort(
          (left, right) =>
            capacityPriorityRank(left) - capacityPriorityRank(right) ||
            left.sequence - right.sequence,
        )[0];
        if (dropped === item) {
          diagnostic("cancelled", "queue-capacity", item);
          drainDiagnostics();
          return undefined;
        }
        if (dropped) {
          queue.splice(queue.indexOf(dropped), 1, item);
          queued = true;
          diagnostic("cancelled", "queue-capacity", dropped);
        }
      }
      if (!queued) queue.push(item);
      diagnostic("queued", "scheduled", item);
      scheduleTimer();
      drainDiagnostics();
      return item.id;
    },
    cancelScope(scope) {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const item = queue[index];
        if (item?.scope === scope) {
          queue.splice(index, 1);
          diagnostic("cancelled", "scope-cancelled", item);
        }
      }
      scheduleTimer();
      drainDiagnostics();
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clock.clearTimeout(timer);
      timer = undefined;
      for (const item of queue)
        diagnostic("cancelled", "runtime-disposed", item);
      queue.length = 0;
      deliveredDedupe.clear();
      drainDiagnostics();
    },
    pendingCount: () => queue.length,
    getDiagnosticSnapshot() {
      return Object.freeze(
        queue
          .map((item): DiagnosticPendingAnnouncement =>
            Object.freeze({
              id: item.id,
              channel: item.channel,
              sourceType: item.sourceType,
              ...(item.sourceEventId
                ? { sourceEventId: item.sourceEventId }
                : {}),
              ...(item.responseId ? { responseId: item.responseId } : {}),
              ...(item.toolId ? { toolId: item.toolId } : {}),
              ...(item.interactionId
                ? { interactionId: item.interactionId }
                : {}),
              ...(item.runId ? { runId: item.runId } : {}),
              ...(item.runInstanceId
                ? { runInstanceId: item.runInstanceId }
                : {}),
              ...(item.stepId ? { stepId: item.stepId } : {}),
              ...(item.stepInstanceId
                ? { stepInstanceId: item.stepInstanceId }
                : {}),
              ...(item.locale ? { locale: item.locale } : {}),
              scheduledAt: item.scheduledAt,
              dueAt: item.dueAt,
              delayMs: item.delayMs ?? 0,
              sequence: item.sequence,
            }),
          )
          .sort(
            (left, right) =>
              left.dueAt - right.dueAt || left.sequence - right.sequence,
          ),
      );
    },
  };
}
