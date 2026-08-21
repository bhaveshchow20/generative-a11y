import { API_PAGES } from "./api-content";

export interface DocTable {
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface ApiEntry {
  readonly name: string;
  readonly type: string;
  readonly requirement: string;
  readonly defaultValue: string;
  readonly description: string;
}

export interface CodeWalkthroughStep {
  readonly label: string;
  readonly description: string;
}

export interface DocSection {
  readonly id: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly bullets?: readonly string[];
  readonly code?: { readonly language: string; readonly value: string };
  readonly table?: DocTable;
  readonly api?: readonly ApiEntry[];
  readonly walkthrough?: readonly CodeWalkthroughStep[];
  readonly note?: string;
  readonly visual?: "runtime-flow";
}

export interface DocPage {
  readonly path: string;
  readonly group: string;
  readonly title: string;
  readonly description: string;
  readonly keywords: readonly string[];
  readonly sections: readonly DocSection[];
}

const quickStart = `import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const delivery = connectRuntimeToDOM(runtime);

runtime.dispatch({ type: "response.started", responseId: "response-1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "response-1",
  delta: "A complete sentence.",
});
runtime.dispatch({ type: "response.completed", responseId: "response-1" });

delivery.dispose();
runtime.dispose();`;

const reactExample = `import {
  GenerativeA11yProvider,
  useGenerativeA11yBindings,
  useGenerativeA11yRuntime,
} from "@generative-a11y/react";

function ExistingChat() {
  const runtime = useGenerativeA11yRuntime();
  const bindings = useGenerativeA11yBindings();

  return (
    <div {...bindings.conversationProps}>
      <div {...bindings.newestResponseProps}>Latest response</div>
      <textarea {...bindings.composerProps} />
      <button onClick={() => runtime.dispatch({
        type: "response.started",
        responseId: "r1",
      })}>Send</button>
    </div>
  );
}

export function App() {
  return <GenerativeA11yProvider><ExistingChat /></GenerativeA11yProvider>;
}`;

const aiSdkExample = `import { useChat } from "@ai-sdk/react";
import {
  useChatAccessibility,
  useObserveChatAccessibility,
} from "@generative-a11y/ai-sdk/react";

const accessibility = useChatAccessibility({
  runtime,
  scopeId: "support-thread",
  onFinish: hostOnFinish,
  onError: hostOnError,
});
const chat = useChat({ id: "support-thread", ...accessibility.chatCallbacks });
useObserveChatAccessibility({ integration: accessibility, snapshot: chat });`;

const assistantUiExample = `import { bindThreadRuntime } from "@generative-a11y/assistant-ui";

const binding = bindThreadRuntime({
  runtime,
  scopeId: "support-thread",
  thread,
});

// Removes only the subscription it created.
binding.dispose();`;

const agUiExample = `import { bindAgent } from "@generative-a11y/ag-ui";

const binding = bindAgent({
  runtime,
  scopeId: "research-agent",
  agent,
});

// Never disposes the borrowed agent or runtime.
binding.dispose();`;

const copilotKitExample = `const bindingScopeId = useId();
const { agent, isReady } = useAgent({ agentId });

useEffect(() => {
  if (!isReady) return;
  const binding = bindAgent({
    agent,
    runtime,
    scopeId: \`copilotkit:\${bindingScopeId}\`,
  });
  return () => binding.dispose();
}, [agent, isReady, runtime, bindingScopeId]);`;

const pages: DocPage[] = [
  {
    path: "/docs/getting-started",
    group: "Start here",
    title: "Getting started",
    description:
      "Install the framework-independent runtime and DOM delivery layer, then dispatch the lifecycle evidence your application already owns.",
    keywords: ["install", "quick start", "framework neutral", "TypeScript"],
    sections: [
      {
        id: "install",
        title: "Install two small layers",
        body: [
          "Install the browser-independent runtime with the DOM delivery layer. Add a framework adapter only when your host already exposes that framework's lifecycle.",
        ],
        code: {
          language: "shell",
          value: "pnpm add @generative-a11y/core @generative-a11y/dom",
        },
        walkthrough: [
          { label: "Install policy", description: "core owns normalized lifecycle policy and produces announcement intents." },
          { label: "Install delivery", description: "dom turns those intents into observable browser delivery without replacing your interface." },
        ],
      },
      {
        id: "minimal-integration",
        title: "Minimal integration",
        body: [
          "Create one runtime, connect browser delivery, and dispatch append-only response deltas. Always send a terminal event and dispose both resources when the owning session ends.",
        ],
        code: { language: "typescript", value: quickStart },
        walkthrough: [
          { label: "Create one runtime", description: "The runtime owns policy, identity, buffering, scheduling, and diagnostics for this application scope." },
          { label: "Attach browser delivery", description: "connectRuntimeToDOM subscribes to announcement intents and owns its hidden live regions." },
          { label: "Dispatch evidence", description: "Started, append-only delta, and completed events describe what the host can prove happened." },
          { label: "Release ownership", description: "Dispose the binding before the runtime when the owning application session ends." },
        ],
        note: "A live-region mutation is observable DOM behavior. It is not proof that assistive technology spoke the text.",
      },
      {
        id: "choose-an-integration",
        title: "Choose the narrowest integration",
        body: [
          "Use a framework adapter when its documented public lifecycle matches your host. Otherwise dispatch normalized core events directly instead of guessing from rendered text.",
        ],
        table: {
          headers: ["Application", "Package", "Lifecycle coverage"],
          rows: [
            ["Framework-neutral", "@generative-a11y/core + /dom", "Full normalized event model"],
            ["React", "@generative-a11y/react", "Provider, delivery, attention, preferences"],
            ["AI SDK useChat", "@generative-a11y/ai-sdk/react", "Streaming, terminals, tools, approvals, citations"],
            ["assistant-ui", "@generative-a11y/assistant-ui", "Messages, tools, approvals, sources"],
            ["AG-UI / CopilotKit v2", "@generative-a11y/ag-ui", "Protocol text, tools, interrupts"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/architecture",
    group: "Start here",
    title: "Architecture",
    description:
      "Understand the boundary between framework lifecycle state, normalized accessibility events, core policy, browser delivery, and assistive technology.",
    keywords: ["architecture", "policy", "delivery", "assistive technology"],
    sections: [
      {
        id: "flow",
        title: "The five-stage flow",
        body: [
          "AI framework → normalized events → core policy → DOM delivery → assistive technology.",
          "Adapters translate only documented public evidence. Core segments, prioritizes, deduplicates, coalesces, bounds, and schedules. The DOM package attempts delivery without touching the host application's visible UI.",
        ],
        visual: "runtime-flow",
      },
      {
        id: "boundaries",
        title: "Separate evidence from inference",
        body: [
          "Framework state is not itself an accessibility event. A normalized event states what the host can prove happened. An announcement intent is policy output. A DOM result reports a browser delivery action. Assistive-technology output remains outside the library's observable boundary.",
        ],
        bullets: [
          "Core never touches the DOM.",
          "Adapters never own framework actions or application UI.",
          "Ordinary streaming and status changes never steal focus.",
          "Backend errors and tool results are never copied into spoken text by default.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations",
    group: "Start here",
    title: "Choose an integration",
    description:
      "Select the smallest generative-a11y package that matches your application stack, lifecycle evidence, rendering layer, and ownership boundaries.",
    keywords: ["choose", "integration", "package", "AI SDK", "assistant-ui", "AG-UI", "React", "custom"],
    sections: [
      {
        id: "decision-table",
        title: "Start with the boundary you already own",
        body: [
          "Choose an adapter from lifecycle evidence, not from visual resemblance. A chat-shaped interface does not imply a framework integration, and a framework adapter cannot recover events that its public API never exposes.",
        ],
        table: {
          headers: ["Application boundary", "Install", "Choose when", "Lifecycle evidence"],
          rows: [
            ["Custom JavaScript", "core + dom", "Your application already owns lifecycle events", "Complete normalized event model"],
            ["React application", "react", "You want provider, delivery, attention, preferences, and element bindings", "Host-dispatched events"],
            ["AI SDK useChat", "ai-sdk + core", "Your UI uses public useChat state and callbacks", "Responses, tools, approvals, citations, exact callback terminals"],
            ["assistant-ui", "assistant-ui + core", "Your application exposes a public ThreadRuntime", "Messages, tools, approvals, sources, documented terminals"],
            ["AG-UI or CopilotKit v2", "ag-ui + core", "Your agent exposes documented protocol subscribers", "Protocol text, tools, interruptions, and known terminals"],
          ],
        },
      },
      {
        id: "fidelity",
        title: "Prefer evidence fidelity over convenience",
        body: [
          "Every adapter publishes what it can observe exactly, what it can infer conservatively, and what remains unavailable. Unavailable evidence is not reconstructed from rendered text, timing, or private framework fields.",
          "Use the custom core integration when retry identity, connection state, or application-specific interactions matter and your framework does not expose them publicly.",
        ],
        table: {
          headers: ["Question", "Use an adapter", "Dispatch core events"],
          rows: [
            ["Does the framework expose the lifecycle publicly?", "Yes", "No"],
            ["Do you need framework-specific identity translation?", "Yes", "Optional"],
            ["Do you own richer retry or connection evidence?", "Only if exposed", "Yes"],
            ["Can the integration depend on rendered UI text?", "Never", "Never"],
          ],
        },
      },
      {
        id: "installation",
        title: "Install only the layers you use",
        body: [
          "Every framework adapter borrows a core runtime. Browser delivery belongs to the DOM or React layer, not to the adapter. This keeps framework translation independent from how announcement intents are delivered.",
        ],
        bullets: [
          "Custom browser application: @generative-a11y/core and @generative-a11y/dom",
          "React application: @generative-a11y/core and @generative-a11y/react",
          "AI SDK: add @generative-a11y/ai-sdk to the core and delivery layers",
          "assistant-ui: add @generative-a11y/assistant-ui to the core and delivery layers",
          "AG-UI or CopilotKit v2: add @generative-a11y/ag-ui to the core and delivery layers",
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/streaming",
    group: "Lifecycle",
    title: "Streaming without repetition",
    description:
      "Send append-only deltas and let core segmentation announce completed units instead of repeating the entire accumulated response.",
    keywords: ["streaming", "delta", "segment", "sentence", "non-repetition"],
    sections: [
      {
        id: "append-only",
        title: "Dispatch only the new suffix",
        body: [
          "Every response begins with response.started. Each response.text.delta carries only newly received text. Completion flushes the final incomplete fragment; interruption and failure cancel it.",
        ],
        code: {
          language: "typescript",
          value: `runtime.dispatch({ type: "response.started", responseId: "r1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "r1",
  delta: "First complete sentence. ",
});
runtime.dispatch({
  type: "response.text.delta",
  responseId: "r1",
  delta: "Second complete sentence.",
});
runtime.dispatch({ type: "response.completed", responseId: "r1" });`,
        },
        walkthrough: [
          { label: "Start the identity", description: "response.started opens one active response record before any text arrives." },
          { label: "Send suffixes only", description: "Each delta contains only new text, which prevents repeated announcements of accumulated content." },
          { label: "Let policy segment", description: "The runtime buffers and segments useful phrases according to the active text strategy." },
          { label: "Send a terminal", description: "response.completed flushes the final useful fragment and closes the response identity." },
        ],
      },
      {
        id: "segmentation",
        title: "Meaningful units, not tokens",
        body: [
          "The balanced preset uses sentence segmentation, a minimum-character threshold, and a maximum delay. The scheduler announces prepared units once; it does not reread the full response after each chunk.",
        ],
        note: "The Lifecycle Lab shows both the growing host text and the distinct announcement intents produced by the real runtime.",
      },
    ],
  },
  {
    path: "/docs/lifecycle/tools",
    group: "Lifecycle",
    title: "Tool lifecycle",
    description:
      "Represent explicit tool execution, normalized progress, successful completion, and safe failure copy without announcing private arguments or results.",
    keywords: ["tools", "progress", "tool.failed", "tool.completed"],
    sections: [
      {
        id: "events",
        title: "Start, progress, and terminal evidence",
        body: [
          "Tool argument streaming is not tool execution. Emit tool.started only with execution evidence, tool.progress only with an explicit value from 0 to 1, and exactly one completion or failure terminal.",
        ],
        code: {
          language: "typescript",
          value: `runtime.dispatch({
  type: "tool.progress",
  toolId: "report-1",
  label: "Prepare report",
  progress: 0.5,
  message: "Halfway complete",
});`,
        },
        walkthrough: [
          { label: "Use execution identity", description: "toolId connects progress to the same host-owned operation." },
          { label: "Provide localized copy", description: "label and message are short user-facing text, not raw tool arguments or backend output." },
          { label: "Normalize progress", description: "progress uses a value from 0 to 1. Policy decides whether this threshold is worth announcing." },
        ],
      },
      {
        id: "safe-errors",
        title: "Keep backend data out of announcements",
        body: [
          "The error property is diagnostic-only. Provide announcement only when the host owns a short, localized, user-safe phrase. Arbitrary tool results are never spoken automatically.",
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/stop-retry",
    group: "Lifecycle",
    title: "Stop, abort, retry, and stale responses",
    description:
      "Cancel buffered output on interruption, rotate response-instance identity on retry, and suppress late stale response events.",
    keywords: ["stop", "abort", "retry", "regeneration", "stale response", "replacement"],
    sections: [
      {
        id: "interruption",
        title: "Interruption is terminal",
        body: [
          "response.interrupted cancels buffered, unannounced text and emits the policy's interruption status. Adapters must not infer an interruption from a generic ready state.",
        ],
      },
      {
        id: "retry",
        title: "Retries require explicit evidence",
        body: [
          "response.retrying cancels the current response scope. When a logical response ID is reused, nextResponseInstanceId establishes the replacement epoch so late transport events carrying the previous responseInstanceId are suppressed as stale.",
        ],
        code: {
          language: "typescript",
          value: `runtime.dispatch({
  type: "response.retrying",
  responseId: "report",
  responseInstanceId: "attempt-1",
  nextResponseInstanceId: "attempt-2",
  attempt: 2,
});`,
        },
        walkthrough: [
          { label: "Identify the replaced attempt", description: "responseInstanceId names the active attempt that is being cancelled." },
          { label: "Create the replacement epoch", description: "nextResponseInstanceId becomes the only accepted instance for later text and terminal events." },
          { label: "Preserve logical identity", description: "responseId remains stable so the application can treat both attempts as one logical answer." },
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/interactions",
    group: "Lifecycle",
    title: "Interactions and approvals",
    description:
      "Model approval, confirmation, and input-required lifecycles only when the host or protocol exposes reliable request and resolution evidence.",
    keywords: ["interaction", "approval", "confirmation", "input required", "human in the loop"],
    sections: [
      {
        id: "general-events",
        title: "Prefer the general interaction model",
        body: [
          "interaction.requested and interaction.resolved support approval, confirmation, and input. approval.requested and approval.resolved remain a compatibility-specialized subset for frameworks that expose known approval semantics.",
        ],
      },
      {
        id: "focus",
        title: "Announcements do not move focus",
        body: [
          "The accessibility layer can announce that input is required, but it does not focus or open an application-owned dialog. The host remains responsible for semantic controls, focus management, and restoring focus after its own interaction closes.",
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/identity",
    group: "Lifecycle",
    title: "Lifecycle identity",
    description:
      "Correlate responses, attempts, messages, tools, tool runs, interactions, and approvals without using labels or rendered text as identity.",
    keywords: ["identity", "responseId", "responseInstanceId", "toolId", "scopeId", "message"],
    sections: [
      {
        id: "entities",
        title: "Stable IDs define lifecycle scope",
        body: [
          "responseId is the logical response. responseInstanceId distinguishes replacement attempts. toolId identifies a logical tool call and toolInstanceId guards reuse. interactionId and approvalId correlate requested and resolved states.",
        ],
        table: {
          headers: ["Entity", "Identity", "Why it matters"],
          rows: [
            ["Response", "responseId", "Scopes text and terminal state"],
            ["Attempt", "responseInstanceId", "Rejects late replaced output"],
            ["Tool", "toolId + toolInstanceId", "Separates reused execution IDs"],
            ["Interaction", "interactionId", "Pairs request and resolution"],
            ["Adapter mount", "scopeId", "Namespaces framework-owned IDs"],
          ],
        },
      },
      {
        id: "never-labels",
        title: "Labels are copy, not identity",
        body: [
          "Displayed text, tool labels, array positions, and render counts are unstable. Framework adapters preserve stable source IDs and fail closed when identity capacity is exhausted.",
        ],
      },
    ],
  },
  {
    path: "/docs/packages/core",
    group: "Packages",
    title: "@generative-a11y/core",
    description:
      "Reference for the browser-independent runtime, policy presets, scheduler, recorder, segmentation helpers, deterministic clocks, events, intents, and diagnostics.",
    keywords: ["core", "runtime", "scheduler", "ManualClock", "presets", "segmentText", "API"],
    sections: [
      {
        id: "runtime-api",
        title: "Runtime and policy exports",
        body: ["Most applications begin with createGenerativeA11y and dispatch normalized events."],
        bullets: [
          "createGenerativeA11y, GenerativeA11yRuntime, GenerativeA11yOptions",
          "resolvePolicy, presets, PolicyOverrides",
          "createAnnouncementRecorder, AnnouncementRecorder",
          "GenerativeA11yEvent, AnnouncementIntent, AnnouncementDiagnostic",
          "AnnouncementPolicy, ReadonlyAnnouncementPolicy, TextPolicy, ToolPolicy",
        ],
        code: { language: "typescript", value: quickStart },
        walkthrough: [
          { label: "Construct policy", description: "createGenerativeA11y resolves a preset and any explicit policy overrides into one immutable runtime policy." },
          { label: "Subscribe before dispatch", description: "DOM delivery registers an announcement listener before lifecycle events can produce output." },
          { label: "Use stable identity", description: "The same responseId connects start, text, and completion while each delta contains new text only." },
          { label: "Dispose deterministically", description: "The binding removes only its subscription and regions. The runtime then clears timers, queues, and listeners." },
        ],
        api: [
          { name: "preset", type: "PresetName", requirement: "Optional", defaultValue: '"balanced"', description: "Selects a complete baseline policy. Use policy for deliberate overrides instead of recreating a preset property by property." },
          { name: "policy", type: "PolicyOverrides", requirement: "Optional", defaultValue: "{}", description: "Overrides nested text, tool, scheduling, channel, and queue behavior while preserving unspecified preset values." },
          { name: "clock", type: "Clock", requirement: "Optional", defaultValue: "systemClock", description: "Controls time and timers. Supply ManualClock in deterministic tests, not in normal browser integrations." },
          { name: "onAnnouncement", type: "(intent) => void", requirement: "Optional", defaultValue: "undefined", description: "Registers the first announcement listener during construction. Additional listeners can subscribe later." },
          { name: "onDeliveryError", type: "(error, intent) => void", requirement: "Optional", defaultValue: "undefined", description: "Observes listener failures without allowing one listener to prevent delivery to the others." },
          { name: "onDiagnostic", type: "(diagnostic) => void", requirement: "Optional", defaultValue: "undefined", description: "Receives delivered and suppressed decisions for debugging, tests, and observability." },
          { name: "dispatch(event)", type: "boolean", requirement: "Method", defaultValue: "n/a", description: "Returns true when the normalized event is accepted. It returns false after disposal or when a nested dispatch transaction reaches capacity." },
          { name: "getPolicy()", type: "ReadonlyAnnouncementPolicy", requirement: "Method", defaultValue: "n/a", description: "Returns the resolved immutable policy currently used by the runtime." },
          { name: "pendingCount()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Reports queued announcement candidates plus owned response flush timers. It is useful for tests and diagnostics, not application rendering." },
          { name: "subscribeAnnouncements(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Adds an announcement-intent listener and returns its idempotent unsubscribe function." },
          { name: "subscribeDiagnostics(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Adds a delivered and suppressed decision listener and returns its unsubscribe function." },
          { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels timers and queued work and releases listeners. Repeated disposal is safe." },
        ],
      },
      {
        id: "lower-level-api",
        title: "Scheduling, clocks, and segmentation",
        body: ["Lower-level exports support advanced policy hosts and deterministic tests. When a bounded queue is full, status work is evicted before response content so conversational output is preserved when possible."],
        bullets: [
          "createAnnouncementScheduler and scheduler option/types",
          "AnnouncementCapacityPriority and ScheduleAnnouncement.capacityPriority",
          "ManualClock, systemClock, Clock, ClockTimer",
          "segmentText, normalizeAnnouncementText, SegmentationResult",
          "AdapterFidelity, PresetName, TextStrategy, AnnouncementChannel",
        ],
        api: [
          { name: "text.strategy", type: "silent | sentence | paragraph | completion", requirement: "Policy", defaultValue: "preset value", description: "Controls when streaming text becomes eligible for an announcement." },
          { name: "text.minimumCharacters", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Prevents tiny fragments from being announced unless a terminal or maximum-delay flush applies." },
          { name: "text.maximumDelayMs", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Bounds how long useful buffered text can wait for a natural segmentation boundary." },
          { name: "tools.announceStart", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Enables tool-start announcements when execution evidence exists." },
          { name: "tools.announceStartAfterMs", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Delays start copy so fast operations can finish without unnecessary status noise." },
          { name: "tools.announceProgress", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Allows explicit normalized progress values to produce paced status updates." },
          { name: "tools.progressEveryPercent", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Sets the minimum percentage bucket change before another progress update is eligible." },
          { name: "tools.announceCompletion", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls successful tool terminal announcements." },
          { name: "tools.announceFailure", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls safe failure announcements while raw errors remain diagnostic-only." },
          { name: "announceResponseStarted", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls whether a response start produces status copy." },
          { name: "announceResponseCompleted", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls explicit response completion copy after the final buffered text flush." },
          { name: "announceInterruption", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls stop and abort status while interruption still cancels buffered output." },
          { name: "announceRetry", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls retry status when the host provides explicit retry evidence." },
          { name: "announceInteractions", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls request and resolution copy for approvals and other user input." },
          { name: "announceConnections", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls connection lifecycle copy when an adapter has reliable or declared inferred evidence." },
          { name: "announceCitations", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls concise source-availability status without reading every URL." },
          { name: "errorChannel", type: "polite | assertive", requirement: "Policy", defaultValue: "preset value", description: "Selects the announcement channel for failures and urgent error status." },
          { name: "minimumGapMs", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Paces adjacent announcements to reduce interruption and overlap." },
          { name: "dedupeWindowMs", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Suppresses equivalent output within a recent time window." },
          { name: "maxQueueSize", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Bounds pending output so an inactive consumer cannot create unbounded memory growth." },
          { name: "maxActiveEntities", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Bounds tracked responses and tools. The runtime fails closed after capacity instead of replaying unknown identity." },
        ],
      },
    ],
  },
  {
    path: "/docs/packages/dom",
    group: "Packages",
    title: "@generative-a11y/dom",
    description:
      "Reference for live-region and ariaNotify delivery, runtime binding, browser attention signals, focus helpers, and validated preference storage.",
    keywords: ["DOM", "live region", "ariaNotify", "attention", "focus", "preferences", "SSR"],
    sections: [
      {
        id: "delivery",
        title: "Announcement delivery",
        body: [
          "connectRuntimeToDOM subscribes a real runtime to an owned announcer. createDOMAnnouncer can also be used directly. Both are safe to import and construct when no browser document exists.",
        ],
        bullets: [
          "createDOMAnnouncer, connectRuntimeToDOM",
          "DOMAnnouncer, DOMRuntimeBinding, DOMDeliveryResult",
          "DOMAnnouncementMode, DOMLiveRegions, DOMAnnouncerOptions",
        ],
        code: { language: "typescript", value: `const binding = connectRuntimeToDOM(runtime, {
  mode: "auto",
  onDiagnostic(result) {
    console.debug(result.method, result.status);
  },
});

binding.dispose();` },
        walkthrough: [
          { label: "Borrow the runtime", description: "The binding subscribes to an existing runtime but does not own or dispose it." },
          { label: "Select delivery", description: "auto prefers ariaNotify when available and falls back to owned live regions." },
          { label: "Observe the attempt", description: "onDiagnostic reports the browser method and result without claiming assistive-technology output." },
          { label: "Remove owned resources", description: "dispose unsubscribes and removes only live regions created by this binding." },
        ],
        api: [
          { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Required", defaultValue: "none", description: "The runtime whose announcement intents will be delivered. Ownership remains with the caller." },
          { name: "mode", type: "auto | aria-notify | live-region", requirement: "Optional", defaultValue: '"auto"', description: "Chooses delivery preference. auto provides progressive enhancement with a live-region fallback." },
          { name: "document", type: "Document", requirement: "Optional", defaultValue: "global document", description: "Targets a specific document, including an iframe document. Omit for the current browser document." },
          { name: "regions", type: "DOMLiveRegions", requirement: "Optional", defaultValue: "owned hidden regions", description: "Uses caller-owned polite and assertive elements. Supplied regions are configured but never removed by dispose." },
          { name: "onDiagnostic", type: "(result) => void", requirement: "Optional", defaultValue: "undefined", description: "Receives notified, mutated, unavailable, or disposed results for every delivery attempt." },
          { name: "binding.announcer", type: "DOMAnnouncer", requirement: "Return", defaultValue: "n/a", description: "Exposes the announcer created for this binding when direct inspection or delivery is needed." },
          { name: "binding.dispose()", type: "void", requirement: "Return", defaultValue: "n/a", description: "Unsubscribes from the runtime and releases resources owned by the binding." },
        ],
      },
      {
        id: "browser-helpers",
        title: "Attention, focus, and preferences",
        body: [
          "Attention signals are conservative browser evidence, never screen-reader virtual-cursor state. Focus helpers are explicit host actions and are never invoked during ordinary streaming.",
        ],
        bullets: [
          "createAttentionStore and AttentionStore types",
          "captureFocus, focusElement, restoreFocus and result types",
          "createPreferenceStore, normalizePreferences, samePreferences",
          "defaultPreferences and preferencesToCoreConfiguration",
        ],
        api: [
          { name: "createAttentionStore(options)", type: "AttentionStore", requirement: "Function", defaultValue: "browser document", description: "Combines document visibility, window focus, focus area, and newest-response visibility into conservative attention evidence." },
          { name: "captureFocus(document?)", type: "FocusCapture", requirement: "Function", defaultValue: "global document", description: "Captures a restorable active element without moving focus." },
          { name: "focusElement(target, options?)", type: "FocusResult", requirement: "Function", defaultValue: "preventScroll: true", description: "Attempts an explicit focus move and returns focused or a precise skipped reason." },
          { name: "restoreFocus(capture, options?)", type: "FocusResult", requirement: "Function", defaultValue: "no guard", description: "Restores captured focus only when the target remains eligible and any optional focus guard matches." },
          { name: "createPreferenceStore(options)", type: "PreferenceStore", requirement: "Function", defaultValue: "balanced preferences", description: "Creates a validated external store with optional browser persistence and cross-tab events." },
          { name: "preferencesToCoreConfiguration(value)", type: "CorePreferenceConfiguration", requirement: "Function", defaultValue: "n/a", description: "Maps user-facing verbosity preferences to a core preset and minimal policy overrides." },
        ],
      },
    ],
  },
  {
    path: "/docs/packages/react",
    group: "Packages",
    title: "@generative-a11y/react",
    description:
      "Reference for the React provider, runtime and preference hooks, attention signals, and ref-only bindings for an existing interface.",
    keywords: ["React", "provider", "hooks", "bindings", "SSR", "hydration"],
    sections: [
      {
        id: "provider",
        title: "Wrap, do not replace",
        body: [
          "GenerativeA11yProvider creates announcement infrastructure around the existing React tree. Its rendered output is limited to visually hidden delivery regions; it does not style messages, composers, or controls.",
        ],
        code: { language: "tsx", value: reactExample },
        walkthrough: [
          { label: "Place the provider once", description: "The provider creates or borrows the runtime, DOM delivery, attention store, and preference store for its subtree." },
          { label: "Read the runtime", description: "useGenerativeA11yRuntime returns the same runtime so host callbacks can dispatch reliable lifecycle evidence." },
          { label: "Attach refs only", description: "The binding props contain refs, not styling or event handlers, so the existing chat interface remains application-owned." },
          { label: "Keep lifecycle at the host boundary", description: "Dispatch from the callback that proves the event happened instead of inferring state from rendered text." },
        ],
        api: [
          { name: "children", type: "ReactNode", requirement: "Optional", defaultValue: "undefined", description: "The existing application tree. The provider does not replace or restyle it." },
          { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Optional", defaultValue: "provider-created", description: "Supplies a caller-owned runtime. When omitted, the provider creates and disposes one." },
          { name: "dom", type: "false | GenerativeA11yDOMOptions", requirement: "Optional", defaultValue: "{}", description: "Configures DOM delivery or disables it with false for non-browser hosts and tests." },
          { name: "attention", type: "false | AttentionStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures attention observation or disables browser observation with false." },
          { name: "attentionStore", type: "AttentionStore", requirement: "Optional", defaultValue: "provider-created", description: "Supplies a caller-owned attention store. It takes precedence over attention options." },
          { name: "preferences", type: "PreferenceStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures default verbosity, persistence, and preference diagnostics." },
          { name: "preferenceStore", type: "PreferenceStore", requirement: "Optional", defaultValue: "provider-created", description: "Supplies a caller-owned preference store. The provider never disposes borrowed stores." },
          { name: "preset / policy / clock", type: "GenerativeA11yOptions", requirement: "Optional", defaultValue: "core defaults", description: "Forwarded to a provider-created runtime. They do not replace options on a supplied runtime." },
        ],
      },
      {
        id: "exports",
        title: "Public exports",
        body: ["Hooks use the nearest provider and throw clearly when called outside it."],
        bullets: [
          "GenerativeA11yProvider and GenerativeA11yProviderProps",
          "useGenerativeA11y and useGenerativeA11yRuntime",
          "useGenerativeA11yAttention and useGenerativeA11yPreferences",
          "useGenerativeA11yBindings and ref-only binding types",
          "GenerativeA11yDOMOptions, context, preference, and binding result types",
        ],
        api: [
          { name: "useGenerativeA11y()", type: "GenerativeA11yContextValue", requirement: "Hook", defaultValue: "nearest provider", description: "Returns runtime, attentionStore, and preferenceStore together." },
          { name: "useGenerativeA11yRuntime()", type: "GenerativeA11yRuntime", requirement: "Hook", defaultValue: "nearest provider", description: "Returns only the normalized event runtime." },
          { name: "useGenerativeA11yAttention()", type: "AttentionSnapshot", requirement: "Hook", defaultValue: "unknown on server", description: "Subscribes to conservative attention evidence through useSyncExternalStore." },
          { name: "useGenerativeA11yPreferences()", type: "GenerativeA11yPreferencesResult", requirement: "Hook", defaultValue: "store snapshot", description: "Returns validated preferences, a setter, and the underlying store." },
          { name: "useGenerativeA11yBindings()", type: "GenerativeA11yBindings", requirement: "Hook", defaultValue: "stable ref props", description: "Returns composerProps, conversationProps, and newestResponseProps for existing elements." },
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/ai-sdk",
    group: "Integrations",
    title: "AI SDK",
    description:
      "Observe AI SDK 7 and @ai-sdk/react 4 public snapshots with composed finish and error callbacks for the strongest available terminal fidelity.",
    keywords: ["AI SDK", "useChat", "createObserver", "composeChatCallbacks", "approval", "citation"],
    sections: [
      {
        id: "react",
        title: "React integration",
        body: [
          "Create the accessibility integration before useChat so composed callbacks are present at construction, then observe its documented snapshot after useChat runs.",
        ],
        code: { language: "tsx", value: aiSdkExample },
        walkthrough: [
          { label: "Create accessibility first", description: "The hook creates one observer and composed callbacks before useChat captures its initial options." },
          { label: "Preserve host callbacks", description: "onFinish and onError remain application-owned. The integration calls its observer and then the latest host callback." },
          { label: "Construct useChat", description: "Spreading chatCallbacks gives the adapter exact completion, abort, and failure evidence." },
          { label: "Observe public state", description: "The second hook reads only messages, status, and error from the returned useChat helpers." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, dispatch>", requirement: "Required", defaultValue: "none", description: "Receives normalized events. The integration borrows it and never disposes it." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "A stable non-empty namespace for message, tool, approval, and source IDs in this chat instance." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds each identity collection. Invalid values throw and saturation suppresses later unknown identities." },
          { name: "getToolLabel", type: "(context) => string", requirement: "Optional", defaultValue: '"A tool"', description: "Maps public tool identity to short localized copy. It must not expose arguments or raw results." },
          { name: "onFinish", type: "ChatOnFinishCallback", requirement: "Optional", defaultValue: "undefined", description: "Your existing finish callback. It is composed rather than replaced." },
          { name: "onError", type: "ChatOnErrorCallback", requirement: "Optional", defaultValue: "undefined", description: "Your existing error callback. Raw errors are not copied into announcements." },
          { name: "chatCallbacks", type: "{ onFinish, onError }", requirement: "Return", defaultValue: "n/a", description: "Spread into useChat at construction so terminal evidence is available to the adapter." },
          { name: "snapshot", type: "Pick<UseChatHelpers, messages | status | error>", requirement: "Required", defaultValue: "none", description: "The public useChat return object observed after useChat has been invoked." },
        ],
      },
      {
        id: "fidelity",
        title: "Fidelity limits",
        body: [
          "Completion, abort, and error are exact only through composed callbacks. status alone is not terminal evidence. A regenerate call is not a retry event unless the host supplies action evidence, so generic retry fidelity is unavailable. Connection restoration is inferred after later success.",
        ],
        bullets: [
          "Exports CHAT_ADAPTER_METADATA, createObserver, composeChatCallbacks",
          "React subpath exports useChatAccessibility and useObserveChatAccessibility",
          "Tool failure, approvals, and citations use stable public part IDs",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/assistant-ui",
    group: "Integrations",
    title: "assistant-ui",
    description:
      "Bind the documented assistant-ui thread runtime state and subscription boundary while silently baselining existing history.",
    keywords: ["assistant-ui", "bindThreadRuntime", "ThreadRuntime", "approval", "source"],
    sections: [
      {
        id: "bind",
        title: "Bind a borrowed thread runtime",
        body: [
          "The binding reads getState and subscribe only. It never owns the thread, calls its actions, renders UI, or disposes the borrowed core runtime.",
        ],
        code: { language: "typescript", value: assistantUiExample },
        walkthrough: [
          { label: "Pass the public thread", description: "The adapter needs only getState and subscribe, so it cannot invoke composer, message, or run actions." },
          { label: "Namespace framework IDs", description: "scopeId prevents identical message and tool IDs from colliding across mounted threads." },
          { label: "Baseline history", description: "Existing messages are recorded silently when the binding starts so hydration never replays old content." },
          { label: "Dispose the subscription", description: "The returned cleanup stops observation but leaves both the assistant-ui thread and core runtime alive." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, dispatch>", requirement: "Required", defaultValue: "none", description: "The borrowed target for normalized lifecycle events." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "A stable namespace for assistant messages, tools, approvals, and sources in this thread." },
          { name: "thread", type: "Pick<ThreadRuntime, getState | subscribe>", requirement: "Required", defaultValue: "none", description: "The documented assistant-ui public thread boundary. No actions or private state are read." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds tracked response, tool, approval, source, and text-part identities." },
          { name: "dispose()", type: "void", requirement: "Return", defaultValue: "n/a", description: "Unsubscribes and clears adapter records. It never disposes the borrowed thread or runtime." },
        ],
      },
      {
        id: "limits",
        title: "What public state cannot prove",
        body: [
          "Streaming, known terminal statuses, tools, approvals, and sources have usable evidence. Generic retry and connectivity lifecycles do not, so the adapter declares them unavailable rather than guessing.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/ag-ui",
    group: "Integrations",
    title: "AG-UI",
    description:
      "Subscribe to documented AG-UI protocol callbacks and preserve response, tool, and interaction identity without parsing private agent state.",
    keywords: ["AG-UI", "bindAgent", "AgentSubscriber", "interrupt", "protocol"],
    sections: [
      {
        id: "bind-agent",
        title: "Subscribe through the public agent boundary",
        body: [
          "bindAgent observes an AbstractAgent through subscribe callbacks. It does not invoke actions, subscribe to private observables, or mutate agent state.",
        ],
        code: { language: "typescript", value: agUiExample },
        walkthrough: [
          { label: "Borrow the agent", description: "bindAgent uses the documented AgentSubscriber callback boundary and does not invoke agent actions." },
          { label: "Use a stable scope", description: "The scope prefixes protocol message, tool, and interrupt IDs for this mounted agent." },
          { label: "Translate protocol evidence", description: "Text, tool, and interrupt callbacks become normalized events only when their public payload proves the transition." },
          { label: "Clean up locally", description: "dispose removes this subscriber without disposing the AG-UI agent or accessibility runtime." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, dispatch>", requirement: "Required", defaultValue: "none", description: "Receives events translated from documented protocol callbacks." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "Namespaces message, tool, and interrupt identity for one agent binding." },
          { name: "agent", type: "Pick<AbstractAgent, subscribe>", requirement: "Required", defaultValue: "none", description: "A borrowed AG-UI agent exposing the documented subscriber API." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds response, tool, and interaction records and fails closed after saturation." },
          { name: "dispose()", type: "void", requirement: "Return", defaultValue: "n/a", description: "Unsubscribes this binding and clears adapter-owned identity records." },
        ],
      },
      {
        id: "protocol-evidence",
        title: "Protocol evidence and limits",
        body: [
          "Text start/content/end maps to response lifecycle. Tool call start plus result maps to execution. Run interrupts with later resume input map to interactions. Replay, connection recovery, and retry remain unavailable without mandatory cursors or host action evidence.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/copilotkit",
    group: "Integrations",
    title: "CopilotKit v2",
    description:
      "Reuse CopilotKit v2's public AG-UI agent surface after readiness instead of publishing a duplicate framework wrapper.",
    keywords: ["CopilotKit", "useAgent", "AG-UI", "human in the loop"],
    sections: [
      {
        id: "reuse-ag-ui",
        title: "Use the AG-UI adapter",
        body: [
          "CopilotKit v2 exposes an AG-UI agent through useAgent. Bind only after isReady, use a stable scope, and dispose the subscription from the effect cleanup.",
        ],
        code: { language: "tsx", value: copilotKitExample },
        walkthrough: [
          { label: "Create a mount identity", description: "useId supplies a stable namespace that survives normal rerenders." },
          { label: "Wait for readiness", description: "The effect does not subscribe until CopilotKit exposes a ready AG-UI agent." },
          { label: "Reuse the protocol adapter", description: "CopilotKit v2 already exposes the public AG-UI boundary, so no duplicate wrapper is needed." },
          { label: "Return cleanup", description: "React effect cleanup disposes exactly the subscription created by this mount." },
        ],
      },
      {
        id: "no-duplicate-package",
        title: "No @generative-a11y/copilotkit package",
        body: [
          "A duplicate package would add surface area without improving evidence. Host-specific client tools that cannot be identified through generic AG-UI events require explicit integration instead of name heuristics.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/custom",
    group: "Integrations",
    title: "Custom applications",
    description:
      "Translate a custom application's documented lifecycle into normalized events while leaving transport, visual UI, and host actions under application ownership.",
    keywords: ["custom", "framework neutral", "adapter", "normalized event"],
    sections: [
      {
        id: "thin-adapter",
        title: "Keep translation thin",
        body: [
          "Map reliable host lifecycle evidence to serializable events. Preserve source IDs, emit append-only text suffixes, require terminal events, and provide localized labels at the boundary.",
        ],
        code: { language: "typescript", value: quickStart },
        walkthrough: [
          { label: "Translate at the source", description: "Dispatch where transport or application callbacks provide reliable lifecycle evidence." },
          { label: "Preserve stable IDs", description: "Use host response and tool identities instead of labels, array positions, or component render counts." },
          { label: "Deliver separately", description: "The DOM binding consumes policy output, leaving visible rendering and host actions unchanged." },
          { label: "Dispose by ownership", description: "Your adapter cleans up its subscriptions, then the application disposes resources it created." },
        ],
      },
      {
        id: "never-infer",
        title: "Declare missing fidelity",
        body: [
          "Do not infer tool completion from argument streaming, retry from a repeated render, interruption from a ready state, or approval from tool-name conventions. Missing evidence is an integration limitation, not an invitation to guess.",
        ],
      },
    ],
  },
  {
    path: "/docs/api/events",
    group: "API reference",
    title: "Event reference",
    description:
      "Field-level reference for every normalized response, tool, interaction, approval, connection, and citation event accepted by runtime.dispatch.",
    keywords: ["GenerativeA11yEvent", "response", "tool", "interaction", "approval", "event fields"],
    sections: [
      {
        id: "shared-fields",
        title: "Shared metadata and identity",
        body: [
          "Every event is a serializable discriminated union keyed by type. eventId links diagnostics to a source event and locale selects announcement segmentation and DOM language. Neither field is used as lifecycle identity.",
        ],
        table: {
          headers: ["Field", "Type", "Required", "Purpose"],
          rows: [
            ["type", "GenerativeA11yEvent['type']", "Yes", "Selects the event variant and validation rules"],
            ["eventId", "string", "No", "Correlates source evidence with diagnostics"],
            ["locale", "string", "No", "BCP 47 locale for segmentation and delivered language"],
            ["responseId", "string", "Response events", "Stable logical response identity"],
            ["responseInstanceId", "string", "No", "Distinguishes replaced attempts sharing a responseId"],
            ["toolId", "string", "Tool events", "Stable logical tool execution identity"],
            ["toolInstanceId", "string", "No", "Distinguishes reused tool IDs"],
          ],
        },
      },
      {
        id: "response-events",
        title: "Response events",
        body: ["Dispatch started before text, send only append-only suffixes, and send exactly one terminal event per active instance."],
        table: {
          headers: ["Event", "Additional fields", "Runtime behavior"],
          rows: [
            ["response.started", "responseId, responseInstanceId?", "Opens an active response and optional start status"],
            ["response.text.delta", "delta", "Buffers and segments only the new suffix"],
            ["response.completed", "none", "Flushes useful text and closes successfully"],
            ["response.interrupted", "none", "Cancels buffered text and closes as stopped"],
            ["response.failed", "error?, announcement?", "Closes as failed; error remains diagnostic-only"],
            ["response.retrying", "nextResponseInstanceId?, attempt?", "Cancels the old scope and rotates accepted identity"],
          ],
        },
      },
      {
        id: "tool-and-interaction-events",
        title: "Tools, interactions, approvals, and sources",
        body: ["Labels and announcements must be short, localized, user-safe copy. Never place raw arguments, results, stack traces, or secrets in these fields."],
        table: {
          headers: ["Event", "Required fields", "Optional fields"],
          rows: [
            ["tool.started", "toolId, label", "toolInstanceId"],
            ["tool.progress", "toolId, label", "progress, message, toolInstanceId"],
            ["tool.completed", "toolId, label", "summary, toolInstanceId"],
            ["tool.failed", "toolId, label", "error, announcement, toolInstanceId"],
            ["interaction.requested", "interactionId, kind, label", "urgent"],
            ["interaction.resolved", "interactionId, kind, outcome", "label"],
            ["approval.requested", "approvalId, label", "urgent"],
            ["approval.resolved", "approvalId, outcome", "label"],
            ["connection.lost / restored", "none", "label"],
            ["citation.available", "count", "none"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/api/runtime",
    group: "API reference",
    title: "Runtime API",
    description:
      "Construction, methods, listener ownership, disposal behavior, identity capacity, and error isolation for GenerativeA11yRuntime.",
    keywords: ["createGenerativeA11y", "runtime", "dispatch", "subscribe", "dispose"],
    sections: [
      {
        id: "construction",
        title: "createGenerativeA11y(options)",
        body: ["Create one runtime per application or intentionally isolated conversation scope. Register at least one announcement listener before dispatching events that may produce output."],
        code: { language: "typescript", value: `const runtime = createGenerativeA11y({
  preset: "balanced",
  onAnnouncement(intent) {
    deliver(intent);
  },
  onDiagnostic(diagnostic) {
    telemetry.record(diagnostic);
  },
});` },
        walkthrough: [
          { label: "Choose a baseline", description: "A preset supplies a complete policy and keeps configuration reviewable." },
          { label: "Register delivery", description: "onAnnouncement is the initial listener. DOM users normally use connectRuntimeToDOM instead." },
          { label: "Observe decisions", description: "Diagnostics explain queued, merged, suppressed, cancelled, and announced outcomes." },
        ],
      },
      {
        id: "methods",
        title: "Methods and ownership",
        body: ["Listener unsubscribe functions and dispose are idempotent. Listener failures are isolated, reported through onDeliveryError, and do not prevent delivery to later listeners."],
        table: {
          headers: ["Method", "Returns", "Contract"],
          rows: [
            ["dispatch(event)", "boolean", "Returns whether one normalized event was accepted synchronously"],
            ["getPolicy()", "ReadonlyAnnouncementPolicy", "Returns the resolved immutable policy"],
            ["pendingCount()", "number", "Reports scheduler candidates plus owned response flush timers"],
            ["subscribeAnnouncements(listener)", "unsubscribe", "Adds an intent listener"],
            ["subscribeDiagnostics(listener)", "unsubscribe", "Adds a decision listener"],
            ["dispose()", "void", "Cancels timers, queue, entity state, and listeners"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/api/policy",
    group: "API reference",
    title: "Policy and presets",
    description:
      "Complete policy behavior for streaming segmentation, tool verbosity, lifecycle status, channels, pacing, deduplication, queues, and entity capacity.",
    keywords: ["policy", "presets", "balanced", "minimumGapMs", "TextPolicy", "ToolPolicy"],
    sections: [
      {
        id: "presets",
        title: "Start from a preset",
        body: ["Presets are complete, tested baselines. Prefer a preset plus a small override over a large custom policy object."],
        table: {
          headers: ["Preset", "Streaming", "Tools", "Use when"],
          rows: [
            ["minimal", "Restrained", "Terminals", "The interface already exposes strong visible status"],
            ["balanced", "Sentence-paced", "Useful status", "General conversational applications"],
            ["verbose", "More frequent", "Progress enabled", "Detailed operational workflows"],
            ["completion-only", "Terminal flush", "Minimal", "Streaming announcements are undesirable"],
          ],
        },
      },
      {
        id: "override-example",
        title: "Override only intentional differences",
        body: ["Nested overrides merge with the selected preset. Unspecified fields continue using that preset's values."],
        code: { language: "typescript", value: `const runtime = createGenerativeA11y({
  preset: "balanced",
  policy: {
    text: { minimumCharacters: 48, maximumDelayMs: 1800 },
    tools: { announceProgress: false },
    minimumGapMs: 900,
  },
});` },
        walkthrough: [
          { label: "Keep balanced behavior", description: "The preset still controls every property not shown in policy." },
          { label: "Tune text pacing", description: "Longer minimum text and delay values reduce fragmented streaming output." },
          { label: "Reduce operational noise", description: "Tool starts and terminals remain available while incremental progress is disabled." },
        ],
      },
    ],
  },
  {
    path: "/docs/api/diagnostics",
    group: "API reference",
    title: "Intents and diagnostics",
    description:
      "Reference for AnnouncementIntent output, diagnostic dispositions and reasons, delivery correlation, and observability boundaries.",
    keywords: ["AnnouncementIntent", "AnnouncementDiagnostic", "DiagnosticReason", "telemetry"],
    sections: [
      {
        id: "intent",
        title: "AnnouncementIntent",
        body: ["An intent is core policy output, not proof of browser delivery or assistive-technology speech."],
        table: { headers: ["Field", "Type", "Meaning"], rows: [
          ["id", "string", "Unique scheduled output identity"], ["at", "number", "Clock timestamp"], ["channel", "polite | assertive", "Requested urgency"], ["text", "string", "Normalized user-facing copy"], ["sourceType", "event type", "Lifecycle evidence that produced it"], ["responseId / toolId / interactionId", "string?", "Optional source identity"], ["locale", "string?", "Optional delivery language"],
        ] },
      },
      {
        id: "diagnostic",
        title: "AnnouncementDiagnostic",
        body: ["Diagnostics are observational and safe for tests or telemetry. Diagnostic listener failures never alter runtime behavior. Aggregated diagnostics include a count so repeated equivalent decisions remain compact without hiding their frequency."],
        table: { headers: ["Disposition", "Common reasons", "Interpretation"], rows: [
          ["queued", "scheduled", "Output entered the bounded scheduler"], ["merged", "coalesced", "Equivalent pending work was combined"], ["suppressed", "duplicate, policy-silent, stale-response", "Policy or identity intentionally prevented output"], ["cancelled", "scope-cancelled, runtime-disposed", "Pending output was invalidated"], ["announced", "delivered, delivery-error", "Listeners accepted output or all delivery attempts failed"],
        ] },
      },
    ],
  },
  {
    path: "/docs/browser/delivery",
    group: "Browser APIs",
    title: "DOM delivery",
    description:
      "Detailed browser delivery modes, supplied-region ownership, SSR behavior, result statuses, locale handling, and cleanup semantics.",
    keywords: ["DOM", "ariaNotify", "live region", "DOMDeliveryResult", "SSR"],
    sections: [
      { id: "modes", title: "Delivery modes", body: ["auto is the recommended progressive-enhancement mode. Browser delivery is observable, but assistive-technology output is not."], table: { headers: ["Mode", "Behavior", "Fallback"], rows: [["auto", "Try ariaNotify, then mutate live region", "Live region"], ["aria-notify", "Prefer ariaNotify when present", "Live region"], ["live-region", "Always mutate owned or supplied regions", "None"]] } },
      { id: "results", title: "DOMDeliveryResult", body: ["onDiagnostic receives one result per attempt."], table: { headers: ["Status", "Method", "Meaning"], rows: [["notified", "aria-notify", "ariaNotify returned without throwing"], ["mutated", "live-region", "The selected region text was updated"], ["unavailable", "none", "No document or usable region exists"], ["disposed", "none", "announce was called after disposal"]] } },
    ],
  },
  {
    path: "/docs/browser/preferences",
    group: "Browser APIs",
    title: "Preferences and attention",
    description:
      "External-store contracts for verbosity preferences and conservative attention evidence, including persistence, registration, and SSR snapshots.",
    keywords: ["preferences", "attention", "focus", "useSyncExternalStore", "persistence"],
    sections: [
      { id: "preferences", title: "PreferenceStore", body: ["Preferences are versioned, validated, and mapped to core configuration. Invalid persistence data is diagnosed and ignored."], table: { headers: ["Option", "Type", "Default"], rows: [["defaultValue", "PreferenceSchemaV1", "balanced"], ["persistence.key", "string", "library key"], ["persistence.storage", "PreferenceStorage", "localStorage when available"], ["persistence.events", "PreferenceStorageEventSource", "storage events when available"], ["onDiagnostic", "callback", "undefined"]] } },
      { id: "attention", title: "AttentionStore", body: ["Attention is browser evidence only. It does not inspect a screen-reader cursor and never moves focus."], table: { headers: ["Snapshot field", "Values", "Evidence"], rows: [["visibility", "visible, hidden, unknown", "Document visibility"], ["windowFocus", "focused, blurred, unknown", "Window focus"], ["focusArea", "composer, conversation, elsewhere, none, unknown", "Deep active element"], ["newestResponse", "visible, outside, unobserved, unknown", "Intersection observer"], ["mode", "foreground, background, reading-history, away, unknown", "Conservative derived state"]] } },
    ],
  },
  {
    path: "/docs/testing",
    group: "Development",
    title: "Testing integrations",
    description:
      "Deterministic test patterns for event translation, runtime policy, DOM delivery, browser accessibility, and manual assistive-technology evidence.",
    keywords: ["testing", "ManualClock", "Vitest", "Playwright", "screen reader"],
    sections: [
      { id: "test-layers", title: "Test each boundary separately", body: ["A passing runtime transcript cannot prove DOM delivery, and a DOM mutation cannot prove what assistive technology announced."], table: { headers: ["Layer", "Assert", "Do not claim"], rows: [["Adapter", "Normalized events and stable IDs", "Announcements"], ["Core", "Intents, pacing, suppression, cancellation", "DOM behavior"], ["DOM", "Delivery results and mutations", "Screen-reader speech"], ["Browser", "Keyboard, landmarks, focus, live regions", "All AT combinations"], ["Manual AT", "Observed user workflow", "Universal behavior"]] } },
      { id: "browser-matrix", title: "Run the browser matrix", body: ["The accessibility fixture runs in Chromium, Firefox, and WebKit. It checks keyboard operation, focus stability, landmarks, live-region structure, and DOM delivery evidence in each engine."], code: { language: "shell", value: `pnpm exec playwright install chromium firefox webkit
pnpm test:browser` }, walkthrough: [{ label: "Install engines", description: "Playwright supplies pinned Chromium, Firefox, and WebKit binaries for repeatable local and CI runs." }, { label: "Run repository fixtures", description: "The command executes the cross-browser accessibility fixture and the documentation site's browser tests." }, { label: "Read the boundary", description: "A passing engine matrix proves observable browser behavior, not screen-reader speech." }] },
      { id: "at-fixture", title: "Exercise the assistive-technology fixture", body: ["The fixture models a real host surface with streaming output, tool status, interruption, retry, and browser delivery. Assertions stay at the event, intent, focus, and DOM boundaries."], bullets: ["Run the same lifecycle scenarios in all three browser engines.", "Assert ordinary streaming and status changes do not steal focus.", "Correlate normalized events, announcement intents, and DOM delivery results.", "Keep application controls and visible status semantically usable without the library."] },
      { id: "manual-evidence", title: "Record manual assistive-technology evidence", body: ["Release evidence records a dated browser, operating system, assistive technology, version, workflow, expected result, observed result, and outcome. The repository validator checks that required observations are complete before release."], note: "Manual evidence describes one tested environment and workflow. It is not a universal compatibility guarantee." },
      { id: "clock", title: "Use ManualClock for time-dependent policy", body: ["Advance deterministic time instead of waiting for real timers. Assert diagnostics when behavior is intentionally suppressed."], code: { language: "typescript", value: `const recorder = createAnnouncementRecorder({ preset: "balanced" });
const runtime = recorder.runtime;
const clock = recorder.clock;

runtime.dispatch(started);
runtime.dispatch(delta);
clock.advanceBy(2_000);

expect(recorder.transcript()).toHaveLength(1);` }, walkthrough: [{ label: "Create the harness", description: "The recorder supplies a runtime and ManualClock configured for deterministic capture." }, { label: "Dispatch evidence", description: "Use the same normalized events your integration produces in the application." }, { label: "Advance explicitly", description: "Tests remain fast and deterministic while exercising delay behavior." }] },
    ],
  },
  {
    path: "/docs/troubleshooting",
    group: "Development",
    title: "Troubleshooting",
    description:
      "Diagnose missing, repeated, stale, delayed, or noisy accessibility output by following lifecycle evidence through adapter, policy, scheduler, and delivery boundaries.",
    keywords: ["troubleshooting", "nothing announced", "duplicate", "stale", "diagnostics", "SSR", "delivery"],
    sections: [
      {
        id: "nothing-announced",
        title: "Nothing is announced",
        body: [
          "First verify that the runtime receives a started event, append-only text deltas, and a terminal event using one stable response identity. Then inspect core diagnostics and the DOM delivery result separately.",
        ],
        bullets: [
          "Confirm the announcement listener or DOM binding is attached before dispatch.",
          "Complete a sentence or dispatch response.completed so buffered text can flush.",
          "Check for policy-silent, empty-text, unknown-response, or runtime-disposed diagnostics.",
          "Check DOMDeliveryResult for unavailable or disposed delivery.",
          "Do not treat a successful DOM mutation as proof of assistive-technology speech.",
        ],
      },
      {
        id: "repeated-output",
        title: "Output repeats or arrives too often",
        body: [
          "response.text.delta must contain only the new suffix. Sending the complete accumulated response on every update makes repeated content look new before scheduler deduplication can help.",
        ],
        bullets: [
          "Dispatch append-only deltas rather than accumulated message text.",
          "Keep responseId and responseInstanceId stable for one active attempt.",
          "Increase text.minimumCharacters or minimumGapMs when valid updates are too granular.",
          "Inspect duplicate and coalesced diagnostics before changing policy.",
        ],
      },
      {
        id: "stale-output",
        title: "Old output appears after retry",
        body: [
          "A retry must replace the active response instance explicitly. Late events from the previous instance are diagnosed as stale-response and must not become announcement intents.",
        ],
        bullets: [
          "Send response.retrying with the replaced and next response instance IDs.",
          "Attach the new responseInstanceId to every later delta and terminal event.",
          "Do not reuse a completed or interrupted response instance.",
          "If the framework lacks retry identity, dispatch host-owned core events instead of inferring it.",
        ],
      },
      {
        id: "tool-noise",
        title: "Tool progress is too noisy",
        body: [
          "Tool announcements are policy decisions. Keep tool identity stable, provide short localized labels, and tune start delay and progress thresholds rather than filtering rendered announcements downstream.",
        ],
        bullets: [
          "Delay tool starts with tools.announceStartAfterMs so fast operations can finish quietly.",
          "Raise tools.progressEveryPercent or disable progress announcements.",
          "Never copy raw arguments, results, or backend errors into user-facing labels.",
        ],
      },
      {
        id: "diagnostics",
        title: "Read diagnostics from left to right",
        body: [
          "Each diagnostic records a disposition and reason. Start at the first unexpected decision instead of debugging only the final DOM surface.",
        ],
        table: {
          headers: ["Reason", "Meaning", "First check"],
          rows: [
            ["policy-silent", "The active policy suppresses this lifecycle event", "Preset and explicit policy overrides"],
            ["unknown-response or unknown-tool", "No active matching identity exists", "Started event order and IDs"],
            ["stale-response or stale-tool", "The event belongs to a replaced execution", "Instance identity propagation"],
            ["progress-threshold", "Progress did not cross the configured bucket", "progressEveryPercent"],
            ["queue-capacity", "The bounded scheduler rejected additional work", "Producer rate and maxQueueSize"],
            ["delivery-error", "Every announcement listener failed", "Listener exceptions and onDeliveryError"],
            ["delivered", "Listeners accepted the announcement intent", "DOM result, then manual AT observation"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/compatibility",
    group: "Reference",
    title: "Compatibility",
    description:
      "Review browser, SSR, React, framework peer ranges, delivery modes, and the exact dependency versions covered by the current repository tests.",
    keywords: ["browser", "SSR", "React 18", "React 19", "peer dependency", "compatibility"],
    sections: [
      {
        id: "runtime",
        title: "Browser and server boundaries",
        body: [
          "Core is browser-independent. DOM constructors are inert without a document. React renders stable hidden regions during SSR and connects after commit. Adapter root entries do not read browser globals at import time.",
        ],
      },
      {
        id: "browser-matrix",
        title: "Browser evidence is engine-specific",
        body: [
          "Repository browser fixtures run in Chromium, Firefox, and WebKit. WebKit is not Safari: it provides valuable engine coverage, while shipping Safari and assistive-technology combinations still require dated manual observation.",
        ],
        table: {
          headers: ["Engine", "Automated evidence", "What remains manual"],
          rows: [
            ["Chromium", "Keyboard, focus, structure, DOM delivery", "Named browser and AT workflow"],
            ["Firefox", "Keyboard, focus, structure, DOM delivery", "Named browser and AT workflow"],
            ["WebKit", "Keyboard, focus, structure, DOM delivery", "Safari and platform AT workflow"],
          ],
        },
      },
      {
        id: "matrix",
        title: "Tested integration matrix",
        body: ["Declared ranges are deliberately narrow and must be retested before publication."],
        table: {
          headers: ["Integration", "Peer range", "Tested version"],
          rows: [
            ["React", "^18.2.0 or ^19.0.0", "19.2.8"],
            ["AI SDK", "ai >=7.0.0 <7.1.0 / @ai-sdk/react >=4.0.0 <4.1.0", "7.0.66 / 4.0.69"],
            ["assistant-ui", "@assistant-ui/core >=0.3.13 <0.4.0", "0.3.13"],
            ["AG-UI", "@ag-ui/client >=0.0.57 <0.0.59", "0.0.58"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/stability",
    group: "Reference",
    title: "Stability and migrations",
    description:
      "Understand package versioning, public API guarantees, peer dependency boundaries, deprecation policy, and the migration workflow for generative-a11y releases.",
    keywords: ["stability", "SemVer", "versioning", "migration", "deprecation", "changeset", "peer dependency"],
    sections: [
      {
        id: "versioning",
        title: "Public packages follow semantic versioning",
        body: [
          "Published package versions describe the public exports, event contracts, and documented behavior of that package. Patch releases preserve compatible behavior and minor releases add compatible capability. Before 1.0, a documented minor release may include a breaking public API change; after 1.0, breaking public API changes require a major release.",
          "Internal implementation details, private framework state, and undocumented deep imports are not compatibility surfaces.",
        ],
      },
      {
        id: "compatibility",
        title: "Adapter stability includes peer ranges",
        body: [
          "Framework adapters are stable only inside their declared peer dependency ranges. A new upstream framework version can change public lifecycle evidence even when generative-a11y itself has not changed.",
        ],
        bullets: [
          "Review the compatibility matrix before upgrading a framework peer.",
          "Pin framework versions when an application depends on exact adapter fidelity.",
          "Use the custom event boundary when an upstream framework cannot expose required evidence.",
        ],
      },
      {
        id: "package-contracts",
        title: "Package contracts are checked before publication",
        body: [
          "Release validation inspects package exports, declaration files, provenance-ready metadata, packed contents, dependency boundaries, and installability. Public entry points must resolve from the package consumers actually receive.",
        ],
        bullets: [
          "Every exported API has tests and documentation.",
          "Package manifests expose only supported public entry points.",
          "Packed artifacts are inspected instead of trusting the source tree.",
          "Framework adapters stay within their declared peer ranges.",
        ],
      },
      {
        id: "release-gates",
        title: "Release gates combine different forms of evidence",
        body: [
          "A release runs repository checks, the Chromium, Firefox, and WebKit fixture, package validation, and the manual assistive-technology evidence validator. Each gate answers a different question and none substitutes for the others.",
        ],
        table: {
          headers: ["Gate", "Evidence", "Boundary"],
          rows: [
            ["Repository check", "Types, builds, unit behavior, rendered docs", "Source and deterministic runtime"],
            ["Browser matrix", "Keyboard, focus, semantics, DOM delivery", "Observable browser behavior"],
            ["Package validation", "Exports, tarballs, installability", "Published consumer surface"],
            ["Manual AT record", "Dated observed workflow", "One named user environment"],
          ],
        },
      },
      {
        id: "migration-checklist",
        title: "Migration checklist",
        body: [
          "Upgrade one boundary at a time and verify behavior with deterministic transcripts before browser and assistive-technology checks.",
        ],
        bullets: [
          "Read the package release notes and peer dependency changes.",
          "Update one generative-a11y package family to a consistent version set.",
          "Run type checking and adapter translation tests.",
          "Compare diagnostics for suppression, cancellation, and delivery changes.",
          "Exercise stop, retry, tool failure, and approval workflows in a browser.",
          "Repeat the application's documented assistive-technology smoke test.",
        ],
      },
      {
        id: "deprecations",
        title: "Deprecations stay observable",
        body: [
          "Deprecated exports remain documented with their replacement and migration path until a major release removes them. Release notes identify changed defaults, event semantics, ownership rules, and peer dependency ranges.",
        ],
      },
    ],
  },
  {
    path: "/docs/limitations",
    group: "Reference",
    title: "Limitations and honest claims",
    description:
      "Distinguish observable policy and delivery behavior from unavailable framework evidence, unsupported inference, and real assistive-technology validation.",
    keywords: ["limitations", "unsupported", "screen reader spoke", "planned", "experimental"],
    sections: [
      {
        id: "what-tests-prove",
        title: "What automated tests prove",
        body: [
          "Core tests prove deterministic event-policy output. Adapter tests prove normalized translation from modeled public evidence. DOM and browser tests prove structural mutations and delivery results. None of these prove that a specific screen reader spoke, how it queued speech, or what a user heard.",
        ],
        note: "Real browser and assistive-technology testing remains a separate release requirement.",
      },
      {
        id: "unsupported",
        title: "Unsupported by design",
        body: [
          "The project does not replace semantic HTML, keyboard interaction, focus management, visible status, or application-owned dialogs. It does not parse private framework state, execute remote code, guarantee speech, or infer missing lifecycle events from UI text.",
        ],
        bullets: [
          "No generic assistant-ui retry or connectivity evidence",
          "No generic AI SDK retry event without host action evidence",
          "No AG-UI replay deduplication without a mandatory cursor",
          "No duplicate CopilotKit adapter package",
        ],
      },
    ],
  },
  {
    path: "/project/overview",
    group: "Project",
    title: "Project overview",
    description:
      "Explore the focused package family behind generative-a11y and the engineering principles that keep accessibility policy portable and observable.",
    keywords: ["project", "packages", "architecture", "validation", "overview"],
    sections: [
      {
        id: "packages",
        title: "A focused package family",
        body: [
          "Each package owns one boundary: event policy, browser delivery, React integration, or framework translation. Applications install only the layers that match their host.",
        ],
        table: {
          headers: ["Package", "Purpose", "Boundary"],
          rows: [
            ["core", "Policy, scheduling, segmentation", "No DOM or framework dependency"],
            ["dom", "Browser delivery, focus, attention, preferences", "No React or AI framework dependency"],
            ["react", "Provider and host-element bindings", "Leaves the visual interface unchanged"],
            ["ai-sdk", "useChat lifecycle translation", "Public state and callbacks only"],
            ["assistant-ui", "Thread runtime translation", "getState and subscribe only"],
            ["ag-ui", "Protocol lifecycle translation", "Documented subscriber callbacks only"],
          ],
        },
      },
      {
        id: "validation",
        title: "Evidence-led validation",
        body: [
          "Deterministic runtime tests, adapter translation tests, DOM delivery tests, browser checks, and manual assistive-technology sessions answer different questions. The project keeps those forms of evidence separate so no automated transcript is mistaken for what a user heard.",
        ],
      },
    ],
  },
  {
    path: "/project/contributing",
    group: "Project",
    title: "Contributing",
    description:
      "Contribute focused changes that preserve package boundaries, event serializability, deterministic timing, honest adapter fidelity, and complete documentation.",
    keywords: ["contributing", "development", "tests", "pull request", "pnpm check"],
    sections: [
      {
        id: "workflow",
        title: "Development workflow",
        body: [
          "Use the Node version in .nvmrc, install from the pnpm lockfile, add tests for exported behavior, and run the full repository check before requesting review.",
        ],
        code: {
          language: "shell",
          value: "corepack enable\npnpm install --frozen-lockfile\npnpm check\npnpm exec playwright install chromium firefox webkit\npnpm test:browser",
        },
        walkthrough: [
          { label: "Install exactly", description: "frozen-lockfile verifies the repository dependency graph without silently rewriting versions." },
          { label: "Run deterministic checks", description: "pnpm check covers formatting, lint, types, package builds, unit behavior, and rendered documentation." },
          { label: "Install browser engines", description: "Playwright uses pinned Chromium, Firefox, and WebKit binaries for repeatable fixtures." },
          { label: "Run browser checks", description: "pnpm test:browser verifies observable keyboard, focus, structure, and delivery behavior separately." },
        ],
      },
      {
        id: "review",
        title: "Review expectations",
        body: [
          "Keep core independent of browsers, DOM independent of React and AI frameworks, and adapters thin. Never add claims that deterministic transcripts or DOM tests prove real assistive-technology behavior.",
        ],
        bullets: [
          "Every exported API requires tests and documentation.",
          "Every owned timer and subscription must be disposed.",
          "All queues and tracked identities remain bounded.",
          "Security reports follow SECURITY.md rather than public issues.",
        ],
      },
    ],
  },
];

const guidePages = pages.filter(
  (page) =>
    !page.path.startsWith("/docs/packages/") &&
    !page.path.startsWith("/docs/api/") &&
    !page.path.startsWith("/docs/browser/"),
);

export const DOC_PAGES: readonly DocPage[] = Object.freeze([
  ...guidePages,
  ...API_PAGES,
]);

const pagesByPath = new Map(DOC_PAGES.map((page) => [page.path, page]));

export function getDocPage(path: string): DocPage | undefined {
  return pagesByPath.get(path);
}

export interface SearchResult {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly group: string;
}

export function searchDocumentation(query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return DOC_PAGES.slice(0, 8);
  const tokens = normalized.split(/\s+/u);

  return DOC_PAGES.map((page) => {
    const title = page.title.toLocaleLowerCase();
    const keywords = page.keywords.join(" ").toLocaleLowerCase();
    const body = `${page.description} ${page.sections
      .flatMap((section) => [
        section.title,
        ...section.body,
        ...(section.bullets ?? []),
        section.code?.value ?? "",
      ])
      .join(" ")}`.toLocaleLowerCase();
    let score = 0;
    if (title.includes(normalized)) score += 80;
    if (keywords.includes(normalized)) score += 70;
    if (body.includes(normalized)) score += 40;
    for (const token of tokens) {
      if (title.includes(token)) score += 12;
      if (keywords.includes(token)) score += 9;
      if (body.includes(token)) score += 2;
    }
    return { page, score };
  })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .map(({ page }) => ({
      path: page.path,
      title: page.title,
      description: page.description,
      group: page.group,
    }));
}

function navigationGroups(source: readonly DocPage[]) {
  return Object.freeze(
    [...new Set(source.map((page) => page.group))].map((group) => ({
      group,
      pages: source.filter((page) => page.group === group),
    })),
  );
}

export const DOC_NAV_GROUPS = navigationGroups(
  DOC_PAGES.filter((page) => !page.path.startsWith("/api")),
);

export const API_NAV_GROUPS = navigationGroups(
  DOC_PAGES.filter((page) => page.path.startsWith("/api")),
);

export const NAV_GROUPS = Object.freeze(
  [...new Set(DOC_PAGES.map((page) => page.group))].map((group) => ({
    group,
    pages: DOC_PAGES.filter((page) => page.group === group),
  })),
);
