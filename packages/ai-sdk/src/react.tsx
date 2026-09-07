import type { Runtime } from "@generative-a11y/core";
import type { AdapterCopy } from "@generative-a11y/core/messages";
import type { UseChatHelpers } from "@ai-sdk/react";
import type { ChatOnErrorCallback, ChatOnFinishCallback, UIMessage } from "ai";
import { useEffect, useMemo, useRef } from "react";

import {
  composeChatCallbacks,
  createChatObserver,
  type ChatObserver,
  type ToolLabelContext,
} from "./index.js";

/** The documented public state returned from `useChat()` that this hook reads. */
export type UseChatSnapshot<UI_MESSAGE extends UIMessage = UIMessage> = Pick<
  UseChatHelpers<UI_MESSAGE>,
  "messages" | "status" | "error"
>;

export interface UseChatAccessibilityOptions<
  UI_MESSAGE extends UIMessage = UIMessage,
> {
  readonly runtime: Pick<Runtime, "dispatch">;
  readonly scopeId: string;
  /** Captured with the observer; replace its scope/runtime to change language. */
  readonly copy?: AdapterCopy;
  readonly maxTrackedEntities?: number;
  readonly getToolLabel?: (context: ToolLabelContext) => string;
  readonly onFinish?: ChatOnFinishCallback<UI_MESSAGE>;
  readonly onError?: ChatOnErrorCallback;
}

export interface ChatIntegration<UI_MESSAGE extends UIMessage = UIMessage> {
  readonly observer: ChatObserver;
  readonly chatCallbacks: {
    readonly onFinish: ChatOnFinishCallback<UI_MESSAGE>;
    readonly onError: ChatOnErrorCallback;
  };
}

export interface UseObserveChatAccessibilityOptions<
  UI_MESSAGE extends UIMessage = UIMessage,
> {
  readonly integration: ChatIntegration<UI_MESSAGE>;
  readonly snapshot: UseChatSnapshot<UI_MESSAGE>;
}

/**
 * Creates an observer and the callbacks that must be passed to `useChat()`.
 * Invoke this hook before `useChat()` in the same component.
 */
export function useChatAccessibility<UI_MESSAGE extends UIMessage>(
  options: UseChatAccessibilityOptions<UI_MESSAGE>,
): ChatIntegration<UI_MESSAGE> {
  const latestOptions = useRef(options);
  latestOptions.current = options;
  const integration = useMemo<ChatIntegration<UI_MESSAGE>>(() => {
    const copy = latestOptions.current.copy;
    const defaultLabel = copy?.toolLabel ?? "A tool";
    const observer = createChatObserver({
      runtime: options.runtime,
      scopeId: options.scopeId,
      ...(copy === undefined ? {} : { copy }),
      ...(options.maxTrackedEntities === undefined
        ? {}
        : { maxTrackedEntities: options.maxTrackedEntities }),
      getToolLabel: (context) =>
        latestOptions.current.getToolLabel?.(context) ?? defaultLabel,
    });
    return {
      observer,
      chatCallbacks: composeChatCallbacks({
        observer,
        onFinish: (event) => latestOptions.current.onFinish?.(event),
        onError: (error) => latestOptions.current.onError?.(error),
      }),
    };
  }, [options.runtime, options.scopeId, options.maxTrackedEntities]);
  const cleanupGenerations = useRef(new WeakMap<ChatObserver, number>());

  useEffect(() => {
    const observer = integration.observer;
    const generations = cleanupGenerations.current;
    generations.set(observer, (generations.get(observer) ?? 0) + 1);
    return () => {
      const generation = (generations.get(observer) ?? 0) + 1;
      generations.set(observer, generation);
      queueMicrotask(() => {
        if (generations.get(observer) === generation) {
          observer.dispose();
          generations.delete(observer);
        }
      });
    };
  }, [integration]);

  return integration;
}

/**
 * Observes a public `useChat()` snapshot after `useChat()` has been invoked.
 * It borrows the integration and deliberately never disposes its observer.
 */
export function useObserveChatAccessibility<UI_MESSAGE extends UIMessage>(
  options: UseObserveChatAccessibilityOptions<UI_MESSAGE>,
): void {
  useEffect(() => {
    options.integration.observer.observe(options.snapshot);
  }, [options.integration, options.snapshot]);
}
