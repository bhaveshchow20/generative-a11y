import type { Clock, ClockTimer } from "./clock.js";
import { systemClock } from "./clock.js";
import { resolvePolicy, type PolicyOverrides } from "./policy.js";
import {
  createAnnouncementScheduler,
  type AnnouncementScheduler,
} from "./scheduler.js";
import { normalizeAnnouncementText, segmentText } from "./segmenter.js";
import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
  GenerativeA11yEvent,
  PresetName,
  ReadonlyAnnouncementPolicy,
} from "./types.js";

interface ResponseState {
  epoch: number;
  instanceId?: string;
  status: "active" | "completed" | "interrupted" | "failed";
  buffer: string;
  ready: string[];
  fullText: string;
  locale?: string;
  flushTimer?: ClockTimer;
}

interface ToolState {
  instanceId?: string;
  locale?: string;
  status: "active" | "completed" | "failed";
  lastProgressBucket: number;
}

type ResponseEvent = Extract<GenerativeA11yEvent, { responseId: string }>;
type ToolEvent = Extract<GenerativeA11yEvent, { toolId: string }>;

export interface GenerativeA11yOptions {
  preset?: PresetName;
  policy?: PolicyOverrides;
  clock?: Clock;
  onAnnouncement: (announcement: AnnouncementIntent) => void;
  onDeliveryError?: (error: unknown, announcement: AnnouncementIntent) => void;
  onDiagnostic?: (diagnostic: AnnouncementDiagnostic) => void;
}

export interface GenerativeA11yRuntime {
  dispatch(event: GenerativeA11yEvent): void;
  getPolicy(): ReadonlyAnnouncementPolicy;
  pendingCount(): number;
  dispose(): void;
}

function eventContext(event: GenerativeA11yEvent) {
  return {
    sourceType: event.type,
    ...(event.eventId ? { sourceEventId: event.eventId } : {}),
    ...(event.locale ? { locale: event.locale } : {}),
  };
}

function ensureTerminalPunctuation(label: string): string {
  return /[.!?。！？…]\s*$/u.test(label) ? label : `${label}.`;
}

export function createGenerativeA11y(
  options: GenerativeA11yOptions,
): GenerativeA11yRuntime {
  const clock = options.clock ?? systemClock;
  const policy = resolvePolicy(options.preset, options.policy);
  const responses = new Map<string, ResponseState>();
  const tools = new Map<string, ToolState>();
  let nextResponseEpoch = 1;
  let disposed = false;

  const scheduler: AnnouncementScheduler = createAnnouncementScheduler({
    clock,
    minimumGapMs: policy.minimumGapMs,
    dedupeWindowMs: policy.dedupeWindowMs,
    maxQueueSize: policy.maxQueueSize,
    onAnnouncement: options.onAnnouncement,
    ...(options.onDeliveryError
      ? { onDeliveryError: options.onDeliveryError }
      : {}),
    ...(options.onDiagnostic ? { onDiagnostic: options.onDiagnostic } : {}),
  });

  function diagnose(
    event: GenerativeA11yEvent,
    reason: AnnouncementDiagnostic["reason"],
  ): void {
    options.onDiagnostic?.({
      at: clock.now(),
      disposition: "suppressed",
      reason,
      sourceType: event.type,
      ...(event.eventId ? { sourceEventId: event.eventId } : {}),
      ...("responseId" in event ? { responseId: event.responseId } : {}),
      ...("toolId" in event ? { toolId: event.toolId } : {}),
    });
  }

  function announce(
    event: GenerativeA11yEvent,
    text: string,
    channel: "polite" | "assertive" = "polite",
    extra: {
      delayMs?: number;
      scope?: string;
      coalesceKey?: string;
      dedupeKey?: string;
      responseId?: string;
      toolId?: string;
      interactionId?: string;
      locale?: string;
    } = {},
  ): void {
    const normalized = normalizeAnnouncementText(text);
    if (!normalized) {
      diagnose(event, "empty-text");
      return;
    }
    scheduler.schedule({
      ...eventContext(event),
      text: normalized,
      channel,
      ...extra,
    });
  }

  function clearFlushTimer(state: ResponseState): void {
    if (state.flushTimer !== undefined) clock.clearTimeout(state.flushTimer);
    state.flushTimer = undefined;
  }

  function responseScope(responseId: string, epoch: number): string {
    return `response:${responseId}:${epoch}`;
  }

  function responseLifecycleScope(responseId: string): string {
    return `response-lifecycle:${responseId}`;
  }

  function toolLifecycleScope(toolId: string): string {
    return `tool-lifecycle:${toolId}`;
  }

  function retainTerminalState<T extends { status: string }>(
    states: Map<string, T>,
    id: string,
    state: T,
  ): void {
    states.delete(id);
    states.set(id, state);
    let terminalCount = [...states.values()].filter(
      (value) => value.status !== "active",
    ).length;
    if (terminalCount <= policy.maxQueueSize) return;
    for (const [candidateId, candidate] of states) {
      if (candidate.status !== "active") {
        states.delete(candidateId);
        terminalCount -= 1;
        if (terminalCount <= policy.maxQueueSize) break;
      }
    }
  }

  function flushReady(
    event: ResponseEvent,
    state: ResponseState,
    force = false,
  ): void {
    if (force && state.buffer) {
      state.ready.push(state.buffer);
      state.buffer = "";
    }
    const text = normalizeAnnouncementText(state.ready.join(" "));
    if (!text) return;
    if (!force && text.length < policy.text.minimumCharacters) return;
    state.ready.length = 0;
    announce(event, text, "polite", {
      responseId: event.responseId,
      scope: responseScope(event.responseId, state.epoch),
      ...(state.locale ? { locale: state.locale } : {}),
    });
  }

  function scheduleMaximumDelay(
    event: ResponseEvent,
    state: ResponseState,
  ): void {
    if (state.flushTimer !== undefined) return;
    if (policy.text.maximumDelayMs <= 0) return;
    const epoch = state.epoch;
    state.flushTimer = clock.setTimeout(() => {
      state.flushTimer = undefined;
      const current = responses.get(event.responseId);
      if (!current || current.epoch !== epoch || current.status !== "active")
        return;
      if (current.buffer) {
        current.ready.push(current.buffer);
        current.buffer = "";
      }
      flushReady(event, current, true);
    }, policy.text.maximumDelayMs);
  }

  function activeResponse(event: ResponseEvent): ResponseState | undefined {
    const state = responses.get(event.responseId);
    if (!state) {
      diagnose(event, "unknown-response");
      return undefined;
    }
    if (state.status !== "active") {
      diagnose(event, "terminal-response");
      return undefined;
    }
    if (
      (state.instanceId !== undefined ||
        event.responseInstanceId !== undefined) &&
      event.responseInstanceId !== state.instanceId
    ) {
      diagnose(event, "stale-response");
      return undefined;
    }
    return state;
  }

  function dispatchResponse(event: ResponseEvent): void {
    if (event.type === "response.started") {
      const previous = responses.get(event.responseId);
      if (
        previous?.status !== "active" &&
        [...responses.values()].filter(({ status }) => status === "active")
          .length >= policy.maxActiveEntities
      ) {
        diagnose(event, "invalid-event");
        return;
      }
      scheduler.cancelScope(responseLifecycleScope(event.responseId));
      if (previous) {
        clearFlushTimer(previous);
        scheduler.cancelScope(responseScope(event.responseId, previous.epoch));
      }
      const epoch = nextResponseEpoch++;
      responses.set(event.responseId, {
        epoch,
        status: "active",
        buffer: "",
        ready: [],
        fullText: "",
        ...(event.responseInstanceId
          ? { instanceId: event.responseInstanceId }
          : {}),
        ...(event.locale ? { locale: event.locale } : {}),
      });
      if (policy.announceResponseStarted) {
        announce(event, "Assistant is responding.", "polite", {
          responseId: event.responseId,
          scope: responseLifecycleScope(event.responseId),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      return;
    }

    const state = activeResponse(event);
    if (!state) return;

    if (event.type === "response.text.delta") {
      if (!event.delta) return;
      if (policy.text.strategy === "completion") state.fullText += event.delta;
      if (policy.text.strategy === "silent") {
        diagnose(event, "policy-silent");
        return;
      }
      if (policy.text.strategy === "completion") return;
      state.buffer += event.delta;
      const result = segmentText(
        state.buffer,
        policy.text.strategy,
        event.locale ?? state.locale,
      );
      state.buffer = result.remainder;
      state.ready.push(...result.complete);
      flushReady(event, state);
      if (state.buffer || state.ready.length)
        scheduleMaximumDelay(event, state);
      else clearFlushTimer(state);
      return;
    }

    clearFlushTimer(state);
    const scope = responseScope(event.responseId, state.epoch);

    if (event.type === "response.completed") {
      if (policy.text.strategy === "completion") {
        announce(event, state.fullText, "polite", {
          responseId: event.responseId,
          scope,
          ...(state.locale ? { locale: state.locale } : {}),
        });
      } else if (policy.text.strategy !== "silent") {
        flushReady(event, state, true);
      }
      state.status = "completed";
      if (policy.announceResponseCompleted) {
        announce(event, "Response complete.", "polite", {
          responseId: event.responseId,
          scope: responseLifecycleScope(event.responseId),
          ...(state.locale ? { locale: state.locale } : {}),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      state.buffer = "";
      state.ready.length = 0;
      state.fullText = "";
      retainTerminalState(responses, event.responseId, state);
      return;
    }

    scheduler.cancelScope(scope);
    scheduler.cancelScope(responseLifecycleScope(event.responseId));
    state.buffer = "";
    state.ready.length = 0;

    if (event.type === "response.interrupted") {
      state.status = "interrupted";
      if (policy.announceInterruption) {
        announce(event, "Response stopped.", "polite", {
          responseId: event.responseId,
          scope: responseLifecycleScope(event.responseId),
          ...(state.locale ? { locale: state.locale } : {}),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      state.fullText = "";
      retainTerminalState(responses, event.responseId, state);
    } else if (event.type === "response.failed") {
      state.status = "failed";
      announce(
        event,
        event.announcement ?? "Response failed.",
        policy.errorChannel,
        {
          responseId: event.responseId,
          scope: responseLifecycleScope(event.responseId),
          ...(state.locale ? { locale: state.locale } : {}),
        },
      );
      state.fullText = "";
      retainTerminalState(responses, event.responseId, state);
    } else {
      state.epoch = nextResponseEpoch++;
      if (event.nextResponseInstanceId) {
        state.instanceId = event.nextResponseInstanceId;
      } else {
        delete state.instanceId;
      }
      state.fullText = "";
      if (policy.announceRetry) {
        announce(
          event,
          event.attempt
            ? `Retrying response. Attempt ${event.attempt}.`
            : "Retrying response.",
          "polite",
          {
            responseId: event.responseId,
            scope: responseLifecycleScope(event.responseId),
            ...(state.locale ? { locale: state.locale } : {}),
          },
        );
      } else {
        diagnose(event, "policy-silent");
      }
    }
  }

  function dispatchTool(event: ToolEvent): void {
    const startScope = `tool-start:${event.toolId}`;
    const progressScope = `tool-progress:${event.toolId}`;
    if (event.type === "tool.started") {
      const previous = tools.get(event.toolId);
      if (
        previous?.status !== "active" &&
        [...tools.values()].filter(({ status }) => status === "active")
          .length >= policy.maxActiveEntities
      ) {
        diagnose(event, "invalid-event");
        return;
      }
      scheduler.cancelScope(startScope);
      scheduler.cancelScope(progressScope);
      scheduler.cancelScope(toolLifecycleScope(event.toolId));
      tools.set(event.toolId, {
        status: "active",
        lastProgressBucket: -1,
        ...(event.toolInstanceId ? { instanceId: event.toolInstanceId } : {}),
        ...(event.locale ? { locale: event.locale } : {}),
      });
      if (policy.tools.announceStart) {
        announce(event, ensureTerminalPunctuation(event.label), "polite", {
          toolId: event.toolId,
          delayMs: policy.tools.announceStartAfterMs,
          scope: startScope,
          coalesceKey: startScope,
        });
      } else {
        diagnose(event, "policy-silent");
      }
      return;
    }

    const state = tools.get(event.toolId);
    if (!state) {
      diagnose(event, "unknown-tool");
      return;
    }
    if (state.status !== "active") {
      diagnose(event, "terminal-tool");
      return;
    }
    if (
      (state.instanceId !== undefined || event.toolInstanceId !== undefined) &&
      event.toolInstanceId !== state.instanceId
    ) {
      diagnose(event, "stale-tool");
      return;
    }

    if (event.type === "tool.progress") {
      if (!policy.tools.announceProgress) {
        diagnose(event, "policy-silent");
        return;
      }
      if (event.progress !== undefined) {
        if (
          !Number.isFinite(event.progress) ||
          event.progress < 0 ||
          event.progress > 1
        ) {
          diagnose(event, "invalid-event");
          return;
        }
        const progress = event.progress;
        const percent = progress * 100;
        const bucket = Math.floor(percent / policy.tools.progressEveryPercent);
        if (state.lastProgressBucket >= bucket) {
          diagnose(event, "progress-threshold");
          return;
        }
        state.lastProgressBucket = bucket;
      }
      const progressText =
        event.message ??
        (event.progress === undefined
          ? `${event.label} in progress.`
          : `${event.label} ${Math.round(event.progress * 100)} percent.`);
      announce(event, progressText, "polite", {
        toolId: event.toolId,
        delayMs: policy.minimumGapMs,
        scope: progressScope,
        coalesceKey: progressScope,
      });
      return;
    }
    scheduler.cancelScope(startScope);
    scheduler.cancelScope(progressScope);
    scheduler.cancelScope(toolLifecycleScope(event.toolId));
    if (event.type === "tool.completed" && policy.tools.announceCompletion) {
      announce(event, event.summary ?? `${event.label} complete.`, "polite", {
        toolId: event.toolId,
        scope: toolLifecycleScope(event.toolId),
        ...(state.locale ? { locale: state.locale } : {}),
      });
    } else if (
      event.type === "tool.completed" &&
      !policy.tools.announceCompletion
    ) {
      diagnose(event, "policy-silent");
    }
    if (event.type === "tool.failed" && policy.tools.announceFailure) {
      announce(
        event,
        event.announcement ?? `${event.label} failed.`,
        "polite",
        {
          toolId: event.toolId,
          scope: toolLifecycleScope(event.toolId),
          ...(state.locale ? { locale: state.locale } : {}),
        },
      );
    } else if (event.type === "tool.failed" && !policy.tools.announceFailure) {
      diagnose(event, "policy-silent");
    }
    state.status = event.type === "tool.completed" ? "completed" : "failed";
    retainTerminalState(tools, event.toolId, state);
  }

  function dispatchOther(
    event: Exclude<
      GenerativeA11yEvent,
      { responseId: string } | { toolId: string }
    >,
  ): void {
    if (event.type === "interaction.requested") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label, event.urgent ? "assertive" : "polite", {
        interactionId: event.interactionId,
      });
      return;
    }
    if (event.type === "interaction.resolved") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(
        event,
        event.label ?? `${event.kind} ${event.outcome}.`,
        "polite",
        {
          interactionId: event.interactionId,
        },
      );
      return;
    }
    if (event.type === "approval.requested") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label, event.urgent ? "assertive" : "polite", {
        interactionId: event.approvalId,
      });
      return;
    }
    if (event.type === "approval.resolved") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label ?? `Approval ${event.outcome}.`, "polite", {
        interactionId: event.approvalId,
      });
      return;
    }
    if (event.type === "connection.lost") {
      if (!policy.announceConnections) return diagnose(event, "policy-silent");
      announce(
        event,
        event.label ?? "Connection lost. Reconnecting.",
        "polite",
      );
      return;
    }
    if (event.type === "connection.restored") {
      if (!policy.announceConnections) return diagnose(event, "policy-silent");
      announce(event, event.label ?? "Connection restored.", "polite");
      return;
    }
    if (!policy.announceCitations) return diagnose(event, "policy-silent");
    if (!Number.isInteger(event.count) || event.count < 0) {
      diagnose(event, "invalid-event");
      return;
    }
    announce(
      event,
      `${event.count} ${event.count === 1 ? "source" : "sources"} available.`,
      "polite",
      { dedupeKey: `citation-count:${event.count}` },
    );
  }

  return {
    dispatch(event) {
      if (disposed)
        throw new Error(
          "Cannot dispatch to a disposed generative-a11y runtime",
        );
      if ("responseId" in event) dispatchResponse(event);
      else if ("toolId" in event) dispatchTool(event);
      else dispatchOther(event);
    },
    getPolicy: () => policy,
    pendingCount: () =>
      scheduler.pendingCount() +
      [...responses.values()].filter(
        (response) => response.flushTimer !== undefined,
      ).length,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const response of responses.values()) clearFlushTimer(response);
      scheduler.dispose();
      responses.clear();
      tools.clear();
    },
  };
}
