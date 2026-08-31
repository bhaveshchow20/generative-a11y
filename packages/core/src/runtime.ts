import type { Clock, ClockTimer } from "./clock.js";
import { systemClock } from "./clock.js";
import { resolvePolicy, type PolicyOverrides } from "./policy.js";
import {
  createAnnouncementScheduler,
  type AnnouncementCapacityPriority,
  type AnnouncementScheduler,
} from "./scheduler.js";
import { normalizeAnnouncementText, segmentText } from "./segmenter.js";
import type {
  AnnouncementDiagnostic,
  AnnouncementIntent,
  DiagnosticResponseSnapshot,
  DiagnosticRunSnapshot,
  DiagnosticStepSnapshot,
  DiagnosticToolSnapshot,
  GenerativeA11yEvent,
  PresetName,
  ReadonlyAnnouncementPolicy,
  RuntimeDiagnosticEventV1,
  RuntimeDiagnosticSnapshotV1,
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
  flushDueAt?: number;
  runId?: string;
  runInstanceId?: string;
  stepId?: string;
  stepInstanceId?: string;
}

interface ToolState {
  instanceId?: string;
  locale?: string;
  status: "active" | "completed" | "failed";
  lastProgressBucket: number;
  runId?: string;
  runInstanceId?: string;
  stepId?: string;
  stepInstanceId?: string;
}

interface RunState {
  instanceId?: string;
  status: "active" | "completed" | "interrupted" | "failed";
  parentRunId?: string;
  parentRunInstanceId?: string;
  parentToolId?: string;
  parentResponseId?: string;
  completedSteps: number;
  failedSteps: number;
}

interface StepState {
  runId: string;
  runInstanceId?: string;
  instanceId?: string;
  parentStepId?: string;
  parentStepInstanceId?: string;
  status: "active" | "completed" | "interrupted" | "failed";
  label: string;
  startedAt: number;
  lastProgressBucket: number;
}

type ResponseEvent = Extract<GenerativeA11yEvent, { responseId: string }>;
type ToolEvent = Extract<GenerativeA11yEvent, { toolId: string }>;
type RunEvent = Extract<GenerativeA11yEvent, { type: `run.${string}` }>;
type StepEvent = Extract<GenerativeA11yEvent, { type: `step.${string}` }>;

export interface GenerativeA11yOptions {
  preset?: PresetName;
  policy?: PolicyOverrides;
  clock?: Clock;
  onAnnouncement?: (announcement: AnnouncementIntent) => void;
  onDeliveryError?: (error: unknown, announcement: AnnouncementIntent) => void;
  onDiagnostic?: (diagnostic: AnnouncementDiagnostic) => void;
}

export type AnnouncementListener = (announcement: AnnouncementIntent) => void;
export type DiagnosticListener = (diagnostic: AnnouncementDiagnostic) => void;
export type RuntimeDiagnosticListener = (
  event: RuntimeDiagnosticEventV1,
) => void;

export interface GenerativeA11yRuntime {
  dispatch(event: GenerativeA11yEvent): boolean;
  getPolicy(): ReadonlyAnnouncementPolicy;
  pendingCount(): number;
  subscribeAnnouncements(listener: AnnouncementListener): () => void;
  subscribeDiagnostics(listener: DiagnosticListener): () => void;
  subscribeDiagnosticEvents(listener: RuntimeDiagnosticListener): () => void;
  getDiagnosticSnapshot(): RuntimeDiagnosticSnapshotV1;
  dispose(): void;
}

function eventContext(event: GenerativeA11yEvent) {
  return {
    sourceType: event.type,
    ...(event.eventId ? { sourceEventId: event.eventId } : {}),
    ...(event.locale ? { locale: event.locale } : {}),
    ...("runId" in event && event.runId ? { runId: event.runId } : {}),
    ...("runInstanceId" in event && event.runInstanceId
      ? { runInstanceId: event.runInstanceId }
      : {}),
    ...("stepId" in event && event.stepId ? { stepId: event.stepId } : {}),
    ...("stepInstanceId" in event && event.stepInstanceId
      ? { stepInstanceId: event.stepInstanceId }
      : {}),
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
  const runs = new Map<string, RunState>();
  const steps = new Map<string, StepState>();
  const announcementListeners = new Map<number, AnnouncementListener>();
  if (options.onAnnouncement)
    announcementListeners.set(0, options.onAnnouncement);
  const diagnosticListeners = new Map<number, DiagnosticListener>();
  if (options.onDiagnostic) diagnosticListeners.set(0, options.onDiagnostic);
  let nextAnnouncementListenerId = 1;
  let nextDiagnosticListenerId = 1;
  const diagnosticEventListeners = new Map<number, RuntimeDiagnosticListener>();
  let nextDiagnosticEventListenerId = 1;
  let diagnosticSequence = 0;
  let nextResponseEpoch = 1;
  let disposed = false;
  let dispatching = false;
  let reportingDispatchOverflow = false;
  let nestedDispatchCount = 0;
  const dispatchQueue: GenerativeA11yEvent[] = [];
  const dispatchOverflowQueue: GenerativeA11yEvent[] = [];
  let dispatchOverflowAggregateCount = 0;
  let announcementEmissionDepth = 0;
  let clearListenersAfterDeliveryDiagnostic = false;

  function clearListeners(): void {
    announcementListeners.clear();
    diagnosticListeners.clear();
    diagnosticEventListeners.clear();
    clearListenersAfterDeliveryDiagnostic = false;
  }

  function reportDeliveryError(
    error: unknown,
    announcement: AnnouncementIntent,
  ): void {
    try {
      options.onDeliveryError?.(error, announcement);
    } catch {
      // Delivery error observers cannot alter output fan-out.
    }
  }

  function emitAnnouncement(announcement: AnnouncementIntent): void {
    if (announcementListeners.size === 0) {
      throw new Error("No announcement listeners are registered");
    }
    let delivered = false;
    let failed = false;
    let firstError: unknown;
    announcementEmissionDepth += 1;
    try {
      for (const listener of [...announcementListeners.values()]) {
        try {
          listener(announcement);
          delivered = true;
        } catch (error) {
          if (!failed) firstError = error;
          failed = true;
          reportDeliveryError(error, announcement);
        }
      }
    } finally {
      announcementEmissionDepth -= 1;
      if (
        announcementEmissionDepth === 0 &&
        clearListenersAfterDeliveryDiagnostic
      ) {
        // Preserve diagnostic observers until the scheduler reports the
        // terminal delivery result, but release announcement callbacks as soon
        // as a reentrant dispose has finished unwinding.
        announcementListeners.clear();
      }
    }
    if (!delivered && failed) throw firstError;
  }

  function emitDiagnostic(diagnostic: AnnouncementDiagnostic): void {
    for (const listener of [...diagnosticListeners.values()]) {
      try {
        listener(diagnostic);
      } catch {
        // Diagnostic observers are best-effort and cannot alter scheduling.
      }
    }
    emitDiagnosticEvent({
      schemaVersion: 1,
      sequence: diagnosticSequence++,
      at: clock.now(),
      kind: "decision",
      decision: Object.freeze({ ...diagnostic }),
    });
    if (
      clearListenersAfterDeliveryDiagnostic &&
      announcementEmissionDepth === 0 &&
      (diagnostic.reason === "delivered" ||
        diagnostic.reason === "delivery-error")
    ) {
      clearListeners();
    }
  }

  function emitDiagnosticEvent(event: RuntimeDiagnosticEventV1): void {
    for (const listener of [...diagnosticEventListeners.values()]) {
      try {
        listener(event);
      } catch {
        // Diagnostic observers are best-effort and cannot alter scheduling.
      }
    }
  }

  function observeEvent(event: GenerativeA11yEvent): void {
    emitDiagnosticEvent({
      schemaVersion: 1,
      sequence: diagnosticSequence++,
      at: clock.now(),
      kind: "event-observed",
      event: Object.freeze({ ...event }) as GenerativeA11yEvent,
    });
  }

  const scheduler: AnnouncementScheduler = createAnnouncementScheduler({
    clock,
    minimumGapMs: policy.minimumGapMs,
    dedupeWindowMs: policy.dedupeWindowMs,
    maxQueueSize: policy.maxQueueSize,
    onAnnouncement: emitAnnouncement,
    onDiagnostic: emitDiagnostic,
  });

  function diagnose(
    event: GenerativeA11yEvent,
    reason: AnnouncementDiagnostic["reason"],
  ): void {
    emitDiagnostic({
      at: clock.now(),
      disposition: "suppressed",
      reason,
      sourceType: event.type,
      ...(event.eventId ? { sourceEventId: event.eventId } : {}),
      ...("responseId" in event ? { responseId: event.responseId } : {}),
      ...("toolId" in event ? { toolId: event.toolId } : {}),
      ...("runId" in event && event.runId ? { runId: event.runId } : {}),
      ...("runInstanceId" in event && event.runInstanceId
        ? { runInstanceId: event.runInstanceId }
        : {}),
      ...("stepId" in event && event.stepId ? { stepId: event.stepId } : {}),
      ...("stepInstanceId" in event && event.stepInstanceId
        ? { stepInstanceId: event.stepInstanceId }
        : {}),
    });
  }

  function diagnoseCapacityAggregate(count: number): void {
    emitDiagnostic({
      at: clock.now(),
      disposition: "suppressed",
      reason: "queue-capacity",
      count,
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
      runId?: string;
      runInstanceId?: string;
      stepId?: string;
      stepInstanceId?: string;
      locale?: string;
      capacityPriority?: AnnouncementCapacityPriority;
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
    delete state.flushDueAt;
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

  function workflowScope(parts: readonly (string | undefined)[]): string {
    return `workflow:${JSON.stringify(parts)}`;
  }

  function runLifecycleScope(runId: string, instanceId?: string): string {
    return workflowScope(["run", runId, instanceId]);
  }

  function stepKey(runId: string, stepId: string): string {
    return JSON.stringify([runId, stepId]);
  }

  function stepLifecycleScope(
    runId: string,
    stepId: string,
    instanceId?: string,
  ): string {
    return workflowScope(["step", runId, stepId, instanceId]);
  }

  function instancesMatch(
    current: string | undefined,
    received: string | undefined,
  ): boolean {
    return (
      (current === undefined && received === undefined) || current === received
    );
  }

  function activeRun(
    event: { runId: string; runInstanceId?: string },
    diagnosticEvent?: GenerativeA11yEvent,
  ): RunState | undefined {
    const source = diagnosticEvent ?? (event as GenerativeA11yEvent);
    const state = runs.get(event.runId);
    if (!state) {
      diagnose(source, "unknown-run");
      return undefined;
    }
    if (state.status !== "active") {
      diagnose(source, "terminal-run");
      return undefined;
    }
    if (!instancesMatch(state.instanceId, event.runInstanceId)) {
      diagnose(source, "stale-run");
      return undefined;
    }
    return state;
  }

  function activeStep(
    event: {
      runId: string;
      stepId?: string;
      stepInstanceId?: string;
    },
    diagnosticEvent?: GenerativeA11yEvent,
  ): StepState | undefined {
    const source = diagnosticEvent ?? (event as GenerativeA11yEvent);
    if (!event.stepId) {
      diagnose(source, "partial-identity");
      return undefined;
    }
    const state = steps.get(stepKey(event.runId, event.stepId));
    if (!state) {
      diagnose(source, "unknown-step");
      return undefined;
    }
    if (state.status !== "active") {
      diagnose(source, "terminal-step");
      return undefined;
    }
    if (!instancesMatch(state.instanceId, event.stepInstanceId)) {
      diagnose(source, "stale-step");
      return undefined;
    }
    return state;
  }

  function validateWorkflowContext(event: GenerativeA11yEvent): boolean {
    if (
      ("runInstanceId" in event &&
        event.runInstanceId !== undefined &&
        (!("runId" in event) || !event.runId)) ||
      ("stepInstanceId" in event &&
        event.stepInstanceId !== undefined &&
        (!("stepId" in event) || !event.stepId))
    ) {
      diagnose(event, "invalid-event");
      return false;
    }
    if (event.type.startsWith("run.") || event.type.startsWith("step."))
      return true;
    if (!("runId" in event) || !event.runId) {
      if ("stepId" in event && event.stepId) {
        diagnose(event, "invalid-event");
        return false;
      }
      return true;
    }
    const runContext = {
      runId: event.runId,
      ...("runInstanceId" in event && event.runInstanceId
        ? { runInstanceId: event.runInstanceId }
        : {}),
    };
    if (!activeRun(runContext, event)) return false;
    if ("stepId" in event && event.stepId) {
      const stepContext = {
        runId: event.runId,
        stepId: event.stepId,
        ...(event.stepInstanceId
          ? { stepInstanceId: event.stepInstanceId }
          : {}),
      };
      if (!activeStep(stepContext, event)) return false;
    }
    return true;
  }

  function cancelStepScope(state: StepState, stepId: string): void {
    scheduler.cancelScope(
      stepLifecycleScope(state.runId, stepId, state.instanceId),
    );
    scheduler.cancelScope(
      workflowScope(["step-progress", state.runId, stepId, state.instanceId]),
    );
  }

  function cancelStepDescendants(
    runId: string,
    rootStepId: string,
    includeRootAssociations = true,
  ): void {
    const cancelled = new Set<string>(
      includeRootAssociations ? [rootStepId] : [],
    );
    let changed = true;
    while (changed) {
      changed = false;
      for (const [key, state] of steps) {
        if (
          state.runId !== runId ||
          state.status !== "active" ||
          !state.parentStepId ||
          !cancelled.has(state.parentStepId)
        )
          continue;
        const [, stepId] = JSON.parse(key) as [string, string];
        if (!cancelled.has(stepId)) {
          cancelled.add(stepId);
          state.status = "interrupted";
          cancelStepScope(state, stepId);
          changed = true;
        }
      }
    }
    for (const [responseId, state] of responses) {
      if (
        state.runId !== runId ||
        !state.stepId ||
        !cancelled.has(state.stepId)
      )
        continue;
      clearFlushTimer(state);
      scheduler.cancelScope(responseScope(responseId, state.epoch));
      scheduler.cancelScope(responseLifecycleScope(responseId));
      if (state.status === "active") state.status = "interrupted";
    }
    for (const [toolId, state] of tools) {
      if (
        state.runId !== runId ||
        !state.stepId ||
        !cancelled.has(state.stepId)
      )
        continue;
      scheduler.cancelScope(`tool-start:${toolId}`);
      scheduler.cancelScope(`tool-progress:${toolId}`);
      scheduler.cancelScope(toolLifecycleScope(toolId));
      if (state.status === "active") state.status = "failed";
    }
  }

  function cancelRunDescendants(runId: string): void {
    const cancelledRuns = new Set([runId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const [candidateId, state] of runs) {
        if (
          state.status === "active" &&
          state.parentRunId &&
          cancelledRuns.has(state.parentRunId) &&
          !cancelledRuns.has(candidateId)
        ) {
          cancelledRuns.add(candidateId);
          state.status = "interrupted";
          scheduler.cancelScope(
            runLifecycleScope(candidateId, state.instanceId),
          );
          changed = true;
        }
      }
    }
    for (const [key, state] of steps) {
      if (!cancelledRuns.has(state.runId) || state.status !== "active")
        continue;
      const [, stepId] = JSON.parse(key) as [string, string];
      state.status = "interrupted";
      cancelStepScope(state, stepId);
    }
    for (const [responseId, state] of responses) {
      if (!state.runId || !cancelledRuns.has(state.runId)) continue;
      clearFlushTimer(state);
      scheduler.cancelScope(responseScope(responseId, state.epoch));
      scheduler.cancelScope(responseLifecycleScope(responseId));
      if (state.status === "active") state.status = "interrupted";
    }
    for (const [toolId, state] of tools) {
      if (!state.runId || !cancelledRuns.has(state.runId)) continue;
      scheduler.cancelScope(`tool-start:${toolId}`);
      scheduler.cancelScope(`tool-progress:${toolId}`);
      scheduler.cancelScope(toolLifecycleScope(toolId));
      if (state.status === "active") state.status = "failed";
    }
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
      capacityPriority: "content",
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
    state.flushDueAt = clock.now() + policy.text.maximumDelayMs;
    state.flushTimer = clock.setTimeout(() => {
      state.flushTimer = undefined;
      delete state.flushDueAt;
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

  function activeEntityCount(): number {
    return (
      [...responses.values()].filter(({ status }) => status === "active")
        .length +
      [...tools.values()].filter(({ status }) => status === "active").length +
      [...runs.values()].filter(({ status }) => status === "active").length +
      [...steps.values()].filter(({ status }) => status === "active").length
    );
  }

  function dispatchResponse(event: ResponseEvent): void {
    if (event.type === "response.started") {
      const previous = responses.get(event.responseId);
      if (
        previous?.status !== "active" &&
        activeEntityCount() >= policy.maxActiveEntities
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
        ...(event.runId ? { runId: event.runId } : {}),
        ...(event.runInstanceId ? { runInstanceId: event.runInstanceId } : {}),
        ...(event.stepId ? { stepId: event.stepId } : {}),
        ...(event.stepInstanceId
          ? { stepInstanceId: event.stepInstanceId }
          : {}),
      });
      if (policy.announceResponseStarted) {
        announce(event, "Assistant is responding.", "polite", {
          responseId: event.responseId,
          scope: responseLifecycleScope(event.responseId),
          capacityPriority: "status",
          ...(event.locale ? { locale: event.locale } : {}),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      return;
    }

    const state = activeResponse(event);
    if (!state) return;

    if (event.type === "response.text.delta") {
      if (event.locale) state.locale = event.locale;
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
    if (event.locale) state.locale = event.locale;
    const scope = responseScope(event.responseId, state.epoch);

    if (event.type === "response.completed") {
      if (policy.text.strategy === "completion") {
        announce(event, state.fullText, "polite", {
          responseId: event.responseId,
          scope,
          capacityPriority: "content",
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
          capacityPriority: "status",
          ...(state.locale ? { locale: state.locale } : {}),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      state.buffer = "";
      state.ready.length = 0;
      state.fullText = "";
      if (disposed) return;
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
          capacityPriority: "status",
          ...(state.locale ? { locale: state.locale } : {}),
        });
      } else {
        diagnose(event, "policy-silent");
      }
      state.fullText = "";
      if (disposed) return;
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
          capacityPriority: "content",
          ...(state.locale ? { locale: state.locale } : {}),
        },
      );
      state.fullText = "";
      if (disposed) return;
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
            capacityPriority: "status",
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
        activeEntityCount() >= policy.maxActiveEntities
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
        ...(event.runId ? { runId: event.runId } : {}),
        ...(event.runInstanceId ? { runInstanceId: event.runInstanceId } : {}),
        ...(event.stepId ? { stepId: event.stepId } : {}),
        ...(event.stepInstanceId
          ? { stepInstanceId: event.stepInstanceId }
          : {}),
      });
      if (policy.tools.announceStart) {
        announce(event, ensureTerminalPunctuation(event.label), "polite", {
          toolId: event.toolId,
          delayMs: policy.tools.announceStartAfterMs,
          scope: startScope,
          coalesceKey: startScope,
          capacityPriority: "status",
          ...(event.locale ? { locale: event.locale } : {}),
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
      }
      if (event.locale) state.locale = event.locale;
      if (event.progress !== undefined) {
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
        capacityPriority: "status",
        ...(state.locale ? { locale: state.locale } : {}),
      });
      return;
    }
    if (event.locale) state.locale = event.locale;
    scheduler.cancelScope(startScope);
    scheduler.cancelScope(progressScope);
    scheduler.cancelScope(toolLifecycleScope(event.toolId));
    if (event.type === "tool.completed" && policy.tools.announceCompletion) {
      announce(event, event.summary ?? `${event.label} complete.`, "polite", {
        toolId: event.toolId,
        scope: toolLifecycleScope(event.toolId),
        capacityPriority: "status",
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
          capacityPriority: "content",
          ...(state.locale ? { locale: state.locale } : {}),
        },
      );
    } else if (event.type === "tool.failed" && !policy.tools.announceFailure) {
      diagnose(event, "policy-silent");
    }
    if (disposed) return;
    state.status = event.type === "tool.completed" ? "completed" : "failed";
    retainTerminalState(tools, event.toolId, state);
  }

  function runSummary(state: RunState): string {
    const parts: string[] = [];
    if (state.completedSteps > 0)
      parts.push(
        `${state.completedSteps} ${state.completedSteps === 1 ? "step" : "steps"} completed`,
      );
    if (state.failedSteps > 0)
      parts.push(
        `${state.failedSteps} ${state.failedSteps === 1 ? "step" : "steps"} failed`,
      );
    return parts.length === 0
      ? "Run complete."
      : `Run complete. ${parts.join(", ")}.`;
  }

  function dispatchRun(event: RunEvent): void {
    if (typeof event.runId !== "string" || !event.runId.trim())
      return diagnose(event, "invalid-event");
    if (event.type === "run.started") {
      if (event.parentRunId) {
        const parent = runs.get(event.parentRunId);
        if (
          !parent ||
          parent.status !== "active" ||
          !instancesMatch(parent.instanceId, event.parentRunInstanceId)
        )
          return diagnose(event, "unknown-parent");
      }
      const previous = runs.get(event.runId);
      if (
        previous?.status === "active" &&
        previous.instanceId === event.runInstanceId
      )
        return diagnose(event, "duplicate");
      if (
        previous?.status !== "active" &&
        activeEntityCount() >= policy.maxActiveEntities
      )
        return diagnose(event, "invalid-event");
      if (previous) {
        cancelRunDescendants(event.runId);
        scheduler.cancelScope(
          runLifecycleScope(event.runId, previous.instanceId),
        );
      }
      const state: RunState = {
        status: "active",
        completedSteps: 0,
        failedSteps: 0,
        ...(event.runInstanceId ? { instanceId: event.runInstanceId } : {}),
        ...(event.parentRunId ? { parentRunId: event.parentRunId } : {}),
        ...(event.parentRunInstanceId
          ? { parentRunInstanceId: event.parentRunInstanceId }
          : {}),
        ...(event.parentToolId ? { parentToolId: event.parentToolId } : {}),
        ...(event.parentResponseId
          ? { parentResponseId: event.parentResponseId }
          : {}),
      };
      runs.set(event.runId, state);
      if (policy.workflows.runs === "all") {
        announce(
          event,
          ensureTerminalPunctuation(`${event.label ?? "Run"} started`),
          "polite",
          {
            runId: event.runId,
            ...(event.runInstanceId
              ? { runInstanceId: event.runInstanceId }
              : {}),
            scope: runLifecycleScope(event.runId, event.runInstanceId),
            capacityPriority: "status",
          },
        );
      } else diagnose(event, "policy-silent");
      return;
    }

    const state = activeRun(event);
    if (!state) return;
    if (event.type === "run.retrying") {
      cancelRunDescendants(event.runId);
      scheduler.cancelScope(runLifecycleScope(event.runId, state.instanceId));
      if (event.nextRunInstanceId) state.instanceId = event.nextRunInstanceId;
      else delete state.instanceId;
      state.completedSteps = 0;
      state.failedSteps = 0;
      if (policy.announceRetry && policy.workflows.runs !== "silent") {
        announce(
          event,
          event.attempt
            ? `Retrying run. Attempt ${event.attempt}.`
            : "Retrying run.",
          "polite",
          {
            runId: event.runId,
            ...(state.instanceId ? { runInstanceId: state.instanceId } : {}),
            scope: runLifecycleScope(event.runId, state.instanceId),
            capacityPriority: "status",
          },
        );
      } else diagnose(event, "policy-silent");
      return;
    }

    const hasOpenChildren =
      [...steps.values()].some(
        (step) => step.runId === event.runId && step.status === "active",
      ) ||
      [...runs.values()].some(
        (run) => run.parentRunId === event.runId && run.status === "active",
      );
    if (event.type === "run.completed" && hasOpenChildren)
      return diagnose(event, "open-children");

    scheduler.cancelScope(runLifecycleScope(event.runId, state.instanceId));
    if (event.type !== "run.completed") cancelRunDescendants(event.runId);
    state.status =
      event.type === "run.completed"
        ? "completed"
        : event.type === "run.interrupted"
          ? "interrupted"
          : "failed";
    const repeatsResponseBoundary =
      event.type === "run.completed" &&
      event.announcement === undefined &&
      policy.workflows.runs === "terminal" &&
      policy.announceResponseCompleted &&
      state.completedSteps === 0 &&
      state.failedSteps === 0 &&
      [...responses.values()].some(
        (response) =>
          response.runId === event.runId && response.status === "completed",
      );
    if (policy.workflows.runs === "silent" || repeatsResponseBoundary) {
      diagnose(event, "policy-silent");
    } else if (event.type === "run.completed") {
      announce(event, event.announcement ?? runSummary(state), "polite", {
        runId: event.runId,
        ...(state.instanceId ? { runInstanceId: state.instanceId } : {}),
        scope: runLifecycleScope(event.runId, state.instanceId),
        capacityPriority: "status",
      });
    } else if (event.type === "run.interrupted") {
      announce(event, event.announcement ?? "Run stopped.", "polite", {
        runId: event.runId,
        ...(state.instanceId ? { runInstanceId: state.instanceId } : {}),
        scope: runLifecycleScope(event.runId, state.instanceId),
        capacityPriority: "status",
      });
    } else {
      announce(
        event,
        event.announcement ?? "Run failed.",
        policy.errorChannel,
        {
          runId: event.runId,
          ...(state.instanceId ? { runInstanceId: state.instanceId } : {}),
          scope: runLifecycleScope(event.runId, state.instanceId),
          capacityPriority: "content",
        },
      );
    }
    if (!disposed) retainTerminalState(runs, event.runId, state);
  }

  function shouldAnnounceStep(state: StepState): boolean {
    if (policy.workflows.steps === "silent") return false;
    if (state.parentStepId && !policy.workflows.announceNestedSteps)
      return false;
    return true;
  }

  function dispatchStep(event: StepEvent): void {
    if (typeof event.runId !== "string" || !event.runId.trim())
      return diagnose(event, "invalid-event");
    const run = activeRun(event);
    if (!run) return;
    if (!event.stepId) return diagnose(event, "partial-identity");
    const key = stepKey(event.runId, event.stepId);

    if (event.type === "step.started") {
      if (!event.stepId.trim() || !event.label.trim())
        return diagnose(event, "invalid-event");
      if (event.parentStepId) {
        const parent = steps.get(stepKey(event.runId, event.parentStepId));
        if (
          !parent ||
          parent.status !== "active" ||
          !instancesMatch(parent.instanceId, event.parentStepInstanceId)
        )
          return diagnose(event, "unknown-parent");
      }
      const previous = steps.get(key);
      if (
        previous?.status !== "active" &&
        activeEntityCount() >= policy.maxActiveEntities
      )
        return diagnose(event, "invalid-event");
      if (previous) {
        cancelStepScope(previous, event.stepId);
        cancelStepDescendants(event.runId, event.stepId);
      }
      const state: StepState = {
        runId: event.runId,
        ...(event.runInstanceId ? { runInstanceId: event.runInstanceId } : {}),
        ...(event.stepInstanceId ? { instanceId: event.stepInstanceId } : {}),
        ...(event.parentStepId ? { parentStepId: event.parentStepId } : {}),
        ...(event.parentStepInstanceId
          ? { parentStepInstanceId: event.parentStepInstanceId }
          : {}),
        status: "active",
        label: event.label,
        startedAt: clock.now(),
        lastProgressBucket: -1,
      };
      steps.set(key, state);
      if (shouldAnnounceStep(state)) {
        const delayMs =
          policy.workflows.steps === "long-running"
            ? policy.workflows.announceStepAfterMs
            : 0;
        announce(
          event,
          ensureTerminalPunctuation(`${event.label} started`),
          "polite",
          {
            runId: event.runId,
            ...(event.runInstanceId
              ? { runInstanceId: event.runInstanceId }
              : {}),
            stepId: event.stepId,
            ...(event.stepInstanceId
              ? { stepInstanceId: event.stepInstanceId }
              : {}),
            delayMs,
            scope: stepLifecycleScope(
              event.runId,
              event.stepId,
              event.stepInstanceId,
            ),
            coalesceKey: workflowScope([
              "step-start",
              event.runId,
              event.stepId,
              event.stepInstanceId,
            ]),
            capacityPriority: "status",
          },
        );
      } else diagnose(event, "policy-silent");
      return;
    }

    const state = activeStep(event);
    if (!state) return;
    if (event.type === "step.progress") {
      if (!policy.workflows.announceProgress || !shouldAnnounceStep(state))
        return diagnose(event, "policy-silent");
      if (
        event.progress !== undefined &&
        (!Number.isFinite(event.progress) ||
          event.progress < 0 ||
          event.progress > 1)
      )
        return diagnose(event, "invalid-event");
      if (event.progress !== undefined) {
        const bucket = Math.floor(event.progress * 4);
        if (bucket <= state.lastProgressBucket)
          return diagnose(event, "progress-threshold");
        state.lastProgressBucket = bucket;
      }
      announce(
        event,
        event.message ??
          (event.progress === undefined
            ? `${event.label} in progress.`
            : `${event.label} ${Math.round(event.progress * 100)} percent.`),
        "polite",
        {
          runId: event.runId,
          ...(event.runInstanceId
            ? { runInstanceId: event.runInstanceId }
            : {}),
          stepId: event.stepId,
          ...(event.stepInstanceId
            ? { stepInstanceId: event.stepInstanceId }
            : {}),
          scope: workflowScope([
            "step-progress",
            event.runId,
            event.stepId,
            event.stepInstanceId,
          ]),
          coalesceKey: workflowScope([
            "step-progress",
            event.runId,
            event.stepId,
            event.stepInstanceId,
          ]),
          capacityPriority: "status",
        },
      );
      return;
    }

    if (
      event.type === "step.completed" &&
      [...steps.values()].some(
        (candidate) =>
          candidate.runId === event.runId &&
          candidate.parentStepId === event.stepId &&
          candidate.status === "active",
      )
    )
      return diagnose(event, "open-children");

    cancelStepScope(state, event.stepId);
    if (event.type === "step.retrying") {
      cancelStepDescendants(event.runId, event.stepId);
      if (event.nextStepInstanceId) state.instanceId = event.nextStepInstanceId;
      else delete state.instanceId;
      state.startedAt = clock.now();
      state.lastProgressBucket = -1;
      if (shouldAnnounceStep(state)) {
        announce(
          event,
          event.attempt
            ? `Retrying ${event.label}. Attempt ${event.attempt}.`
            : `Retrying ${event.label}.`,
          "polite",
          {
            runId: event.runId,
            ...(event.runInstanceId
              ? { runInstanceId: event.runInstanceId }
              : {}),
            stepId: event.stepId,
            ...(state.instanceId ? { stepInstanceId: state.instanceId } : {}),
            scope: stepLifecycleScope(
              event.runId,
              event.stepId,
              state.instanceId,
            ),
            capacityPriority: "status",
          },
        );
      } else diagnose(event, "policy-silent");
      return;
    }

    if (event.type !== "step.completed")
      cancelStepDescendants(event.runId, event.stepId);
    state.status =
      event.type === "step.completed"
        ? "completed"
        : event.type === "step.interrupted"
          ? "interrupted"
          : "failed";
    if (event.type === "step.completed") run.completedSteps += 1;
    if (event.type === "step.failed") run.failedSteps += 1;
    const duration = clock.now() - state.startedAt;
    const announceTerminal =
      shouldAnnounceStep(state) &&
      (event.type === "step.failed" ||
        policy.workflows.steps === "all" ||
        duration >= policy.workflows.announceStepAfterMs);
    if (!announceTerminal) {
      diagnose(event, "policy-silent");
    } else if (event.type === "step.completed") {
      announce(event, `${event.label} complete.`, "polite", {
        runId: event.runId,
        ...(event.runInstanceId ? { runInstanceId: event.runInstanceId } : {}),
        stepId: event.stepId,
        ...(event.stepInstanceId
          ? { stepInstanceId: event.stepInstanceId }
          : {}),
        scope: stepLifecycleScope(
          event.runId,
          event.stepId,
          event.stepInstanceId,
        ),
        capacityPriority: "status",
      });
    } else if (event.type === "step.interrupted") {
      announce(
        event,
        event.announcement ?? `${event.label} stopped.`,
        "polite",
        {
          runId: event.runId,
          stepId: event.stepId,
          scope: stepLifecycleScope(
            event.runId,
            event.stepId,
            state.instanceId,
          ),
          capacityPriority: "status",
        },
      );
    } else {
      announce(
        event,
        event.announcement ?? `${event.label} failed.`,
        policy.errorChannel,
        {
          runId: event.runId,
          stepId: event.stepId,
          scope: stepLifecycleScope(
            event.runId,
            event.stepId,
            state.instanceId,
          ),
          capacityPriority: "content",
        },
      );
    }
    if (!disposed) retainTerminalState(steps, key, state);
  }

  function dispatchOther(
    event: Exclude<
      GenerativeA11yEvent,
      | { responseId: string }
      | { toolId: string }
      | { type: `run.${string}` }
      | { type: `step.${string}` }
    >,
  ): void {
    if (event.type === "interaction.requested") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label, event.urgent ? "assertive" : "polite", {
        interactionId: event.interactionId,
        capacityPriority: "content",
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
          capacityPriority: "content",
        },
      );
      return;
    }
    if (event.type === "approval.requested") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label, event.urgent ? "assertive" : "polite", {
        interactionId: event.approvalId,
        capacityPriority: "content",
      });
      return;
    }
    if (event.type === "approval.resolved") {
      if (!policy.announceInteractions) return diagnose(event, "policy-silent");
      announce(event, event.label ?? `Approval ${event.outcome}.`, "polite", {
        interactionId: event.approvalId,
        capacityPriority: "content",
      });
      return;
    }
    if (event.type === "connection.lost") {
      if (!policy.announceConnections) return diagnose(event, "policy-silent");
      announce(
        event,
        event.label ?? "Connection lost. Reconnecting.",
        "polite",
        { capacityPriority: "status" },
      );
      return;
    }
    if (event.type === "connection.restored") {
      if (!policy.announceConnections) return diagnose(event, "policy-silent");
      announce(event, event.label ?? "Connection restored.", "polite", {
        capacityPriority: "status",
      });
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
      {
        dedupeKey: `citation-count:${event.count}`,
        capacityPriority: "status",
      },
    );
  }

  function dispatchOne(event: GenerativeA11yEvent): void {
    if (!validateWorkflowContext(event)) return;
    if (event.type.startsWith("run.")) dispatchRun(event as RunEvent);
    else if (event.type.startsWith("step.")) dispatchStep(event as StepEvent);
    else if ("responseId" in event) dispatchResponse(event);
    else if ("toolId" in event) dispatchTool(event);
    else dispatchOther(event as Parameters<typeof dispatchOther>[0]);
  }

  return {
    dispatch(event) {
      if (disposed) return false;
      if (dispatching) {
        if (reportingDispatchOverflow) return false;
        if (nestedDispatchCount >= policy.maxQueueSize) {
          if (dispatchOverflowQueue.length < policy.maxQueueSize) {
            dispatchOverflowQueue.push(event);
          } else {
            dispatchOverflowAggregateCount += 1;
          }
          return false;
        }
        nestedDispatchCount += 1;
        dispatchQueue.push(event);
        return true;
      }
      dispatchQueue.push(event);
      dispatching = true;
      nestedDispatchCount = 0;
      try {
        while (!disposed) {
          const next = dispatchQueue.shift();
          if (!next) break;
          observeEvent(next);
          if (disposed) break;
          dispatchOne(next);
        }
        reportingDispatchOverflow = true;
        while (!disposed) {
          const overflow = dispatchOverflowQueue.shift();
          if (!overflow) break;
          diagnose(overflow, "queue-capacity");
        }
        if (!disposed && dispatchOverflowAggregateCount > 0) {
          const aggregateCount = dispatchOverflowAggregateCount;
          dispatchOverflowAggregateCount = 0;
          diagnoseCapacityAggregate(aggregateCount);
        }
      } finally {
        reportingDispatchOverflow = false;
        nestedDispatchCount = 0;
        dispatchQueue.length = 0;
        dispatchOverflowQueue.length = 0;
        dispatchOverflowAggregateCount = 0;
        dispatching = false;
      }
      return true;
    },
    getPolicy: () => policy,
    pendingCount: () =>
      scheduler.pendingCount() +
      [...responses.values()].filter(
        (response) => response.flushTimer !== undefined,
      ).length,
    subscribeAnnouncements(listener) {
      if (disposed)
        throw new Error(
          "Cannot subscribe to a disposed generative-a11y runtime",
        );
      const listenerId = nextAnnouncementListenerId++;
      announcementListeners.set(listenerId, listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        announcementListeners.delete(listenerId);
      };
    },
    subscribeDiagnostics(listener) {
      if (disposed)
        throw new Error(
          "Cannot subscribe to a disposed generative-a11y runtime",
        );
      const listenerId = nextDiagnosticListenerId++;
      diagnosticListeners.set(listenerId, listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        diagnosticListeners.delete(listenerId);
      };
    },
    subscribeDiagnosticEvents(listener) {
      if (disposed)
        throw new Error(
          "Cannot subscribe to a disposed generative-a11y runtime",
        );
      const listenerId = nextDiagnosticEventListenerId++;
      diagnosticEventListeners.set(listenerId, listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        diagnosticEventListeners.delete(listenerId);
      };
    },
    getDiagnosticSnapshot() {
      const responsesSnapshot = [...responses.entries()]
        .map(([responseId, state]): DiagnosticResponseSnapshot =>
          Object.freeze({
            responseId,
            epoch: state.epoch,
            ...(state.instanceId ? { instanceId: state.instanceId } : {}),
            status: state.status,
            ...(state.locale ? { locale: state.locale } : {}),
          }),
        )
        .sort((left, right) => left.responseId.localeCompare(right.responseId));
      const toolsSnapshot = [...tools.entries()]
        .map(([toolId, state]): DiagnosticToolSnapshot =>
          Object.freeze({
            toolId,
            ...(state.instanceId ? { instanceId: state.instanceId } : {}),
            status: state.status,
            ...(state.locale ? { locale: state.locale } : {}),
            lastProgressBucket: state.lastProgressBucket,
          }),
        )
        .sort((left, right) => left.toolId.localeCompare(right.toolId));
      const runsSnapshot = [...runs.entries()]
        .map(([runId, state]): DiagnosticRunSnapshot =>
          Object.freeze({
            runId,
            ...(state.instanceId ? { instanceId: state.instanceId } : {}),
            ...(state.parentRunId ? { parentRunId: state.parentRunId } : {}),
            ...(state.parentRunInstanceId
              ? { parentRunInstanceId: state.parentRunInstanceId }
              : {}),
            ...(state.parentToolId ? { parentToolId: state.parentToolId } : {}),
            ...(state.parentResponseId
              ? { parentResponseId: state.parentResponseId }
              : {}),
            status: state.status,
            completedSteps: state.completedSteps,
            failedSteps: state.failedSteps,
          }),
        )
        .sort((left, right) => left.runId.localeCompare(right.runId));
      const stepsSnapshot = [...steps.entries()]
        .map(([key, state]): DiagnosticStepSnapshot => {
          const [, stepId] = JSON.parse(key) as [string, string];
          return Object.freeze({
            runId: state.runId,
            ...(state.runInstanceId
              ? { runInstanceId: state.runInstanceId }
              : {}),
            stepId,
            ...(state.instanceId ? { instanceId: state.instanceId } : {}),
            ...(state.parentStepId ? { parentStepId: state.parentStepId } : {}),
            ...(state.parentStepInstanceId
              ? { parentStepInstanceId: state.parentStepInstanceId }
              : {}),
            status: state.status,
            startedAt: state.startedAt,
            lastProgressBucket: state.lastProgressBucket,
          });
        })
        .sort(
          (left, right) =>
            left.runId.localeCompare(right.runId) ||
            left.stepId.localeCompare(right.stepId),
        );
      const flushes = [...responses.entries()]
        .flatMap(([responseId, state]) =>
          state.flushDueAt === undefined
            ? []
            : [
                Object.freeze({
                  responseId,
                  epoch: state.epoch,
                  dueAt: state.flushDueAt,
                }),
              ],
        )
        .sort(
          (left, right) =>
            left.dueAt - right.dueAt ||
            left.responseId.localeCompare(right.responseId),
        );
      const announcements = scheduler.getDiagnosticSnapshot();
      return Object.freeze({
        schemaVersion: 1 as const,
        at: clock.now(),
        policy,
        pending: Object.freeze({
          announcements,
          flushes: Object.freeze(flushes),
        }),
        responses: Object.freeze(responsesSnapshot),
        tools: Object.freeze(toolsSnapshot),
        runs: Object.freeze(runsSnapshot),
        steps: Object.freeze(stepsSnapshot),
        pendingCount: announcements.length + flushes.length,
      });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      dispatchQueue.length = 0;
      dispatchOverflowQueue.length = 0;
      dispatchOverflowAggregateCount = 0;
      for (const response of responses.values()) clearFlushTimer(response);
      scheduler.dispose();
      responses.clear();
      tools.clear();
      runs.clear();
      steps.clear();
      if (announcementEmissionDepth > 0)
        clearListenersAfterDeliveryDiagnostic = true;
      else clearListeners();
    },
  };
}
