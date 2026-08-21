import type { Clock, ClockTimer } from "./clock.js";
import type {
  AnnouncementChannel,
  AnnouncementDiagnostic,
  AnnouncementIntent,
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
  locale?: string;
  delayMs?: number;
  scope?: string;
  coalesceKey?: string;
  dedupeKey?: string;
  capacityPriority?: AnnouncementCapacityPriority;
}

interface ScheduledItem extends ScheduleAnnouncement {
  id: string;
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

  function capacityPriorityRank(item: ScheduleAnnouncement): number {
    return item.capacityPriority === "status" ? 0 : 1;
  }

  function diagnostic(
    disposition: AnnouncementDiagnostic["disposition"],
    reason: DiagnosticReason,
    item?: ScheduledItem,
  ): void {
    try {
      options.onDiagnostic?.({
        at: clock.now(),
        disposition,
        reason,
        ...(item
          ? { announcement: toIntent(item), sourceType: item.sourceType }
          : {}),
        ...(item?.sourceEventId ? { sourceEventId: item.sourceEventId } : {}),
        ...(item?.responseId ? { responseId: item.responseId } : {}),
        ...(item?.toolId ? { toolId: item.toolId } : {}),
      });
    } catch {
      // Diagnostic observers are best-effort and cannot alter scheduling.
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
            dueAt: clock.now() + Math.max(0, candidate.delayMs ?? 0),
          };
          queue[existingIndex] = replacement;
          diagnostic("merged", "coalesced", replacement);
          scheduleTimer();
          return queue.includes(replacement) ? replacement.id : undefined;
        }
      }
      const item: ScheduledItem = {
        ...candidate,
        id: `announcement-${nextId++}`,
        dueAt: clock.now() + Math.max(0, candidate.delayMs ?? 0),
        sequence: sequence++,
      };
      let queued = false;
      if (queue.length >= options.maxQueueSize) {
        const capacityCandidates = [...queue, item];
        const hasPoliteCandidate = capacityCandidates.some(
          (candidate) => candidate.channel === "polite",
        );
        const evictionPool = capacityCandidates.filter(
          (candidate) => candidate.channel === "polite" || !hasPoliteCandidate,
        );
        const dropped = evictionPool.sort(
          (left, right) =>
            capacityPriorityRank(left) - capacityPriorityRank(right) ||
            left.sequence - right.sequence,
        )[0];
        if (dropped === item) {
          diagnostic("cancelled", "queue-capacity", item);
          return undefined;
        }
        if (dropped) {
          queue.splice(queue.indexOf(dropped), 1, item);
          queued = true;
          diagnostic("cancelled", "queue-capacity", dropped);
          if (!queue.includes(item)) return undefined;
        }
      }
      if (!queued) queue.push(item);
      diagnostic("queued", "scheduled", item);
      scheduleTimer();
      return queue.includes(item) ? item.id : undefined;
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
    },
    dispose() {
      disposed = true;
      if (timer !== undefined) clock.clearTimeout(timer);
      timer = undefined;
      for (const item of queue)
        diagnostic("cancelled", "runtime-disposed", item);
      queue.length = 0;
      deliveredDedupe.clear();
    },
    pendingCount: () => queue.length,
  };
}
