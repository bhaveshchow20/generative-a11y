import type { Clock, ClockTimer } from "./clock.js";
import type {
  AnnouncementChannel,
  AnnouncementDiagnostic,
  AnnouncementIntent,
  DiagnosticReason,
  GenerativeA11yEvent,
} from "./types.js";

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
    const gapAt =
      next.channel === "assertive"
        ? next.dueAt
        : Math.max(next.dueAt, lastDeliveredAt + options.minimumGapMs);
    timer = clock.setTimeout(pump, Math.max(0, gapAt - clock.now()));
  }

  function selectNext(onlyDue: boolean): ScheduledItem | undefined {
    const now = clock.now();
    return [...queue]
      .filter((item) => !onlyDue || item.dueAt <= now)
      .sort((left, right) => {
        const leftDue = left.dueAt <= now;
        const rightDue = right.dueAt <= now;
        if (leftDue && rightDue && left.channel !== right.channel) {
          return left.channel === "assertive" ? -1 : 1;
        }
        return left.dueAt - right.dueAt || left.sequence - right.sequence;
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
    if (
      item.channel === "polite" &&
      clock.now() < lastDeliveredAt + options.minimumGapMs
    ) {
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
          return replacement.id;
        }
      }
      const item: ScheduledItem = {
        ...candidate,
        id: `announcement-${nextId++}`,
        dueAt: clock.now() + Math.max(0, candidate.delayMs ?? 0),
        sequence: sequence++,
      };
      if (queue.length >= options.maxQueueSize) {
        const dropped = queue.find((queued) => queued.channel === "polite");
        if (!dropped && item.channel === "polite") {
          diagnostic("cancelled", "queue-capacity", item);
          return undefined;
        }
        const displaced = dropped ?? queue[0];
        if (displaced) {
          queue.splice(queue.indexOf(displaced), 1);
          diagnostic("cancelled", "queue-capacity", displaced);
        }
      }
      queue.push(item);
      diagnostic("queued", "scheduled", item);
      scheduleTimer();
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
