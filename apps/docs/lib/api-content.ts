import type { ApiEntry, DocPage } from "./content";

const runtimeMethods: readonly ApiEntry[] = [
  { name: "dispatch(event)", type: "boolean", requirement: "Method", defaultValue: "n/a", description: "Processes one serializable GenerativeA11yEvent synchronously. Returns false after disposal or when a nested dispatch transaction reaches capacity." },
  { name: "getPolicy()", type: "ReadonlyAnnouncementPolicy", requirement: "Method", defaultValue: "n/a", description: "Returns the resolved immutable policy used by this runtime." },
  { name: "pendingCount()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Counts scheduler candidates and owned response flush timers. Use it for tests and diagnostics, not application rendering." },
  { name: "subscribeAnnouncements(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Registers an AnnouncementIntent listener and returns an idempotent unsubscribe function." },
  { name: "subscribeDiagnostics(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Registers an AnnouncementDiagnostic listener and returns an idempotent unsubscribe function." },
  { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels every owned timer, clears bounded state and queued work, then releases listeners. Repeated calls are safe." },
];

const pages: DocPage[] = [
  {
    path: "/api",
    group: "API overview",
    title: "API reference",
    description: "Package and symbol-level reference for every public generative-a11y runtime, browser, React, and framework adapter contract.",
    keywords: ["API", "reference", "exports", "packages", "TypeScript"],
    sections: [
      {
        id: "packages",
        title: "Choose the boundary you need",
        body: ["Each package owns one narrow boundary. Start with core, add one delivery layer, then add a framework adapter only when its public lifecycle matches your host application."],
        table: { headers: ["Package", "Primary exports", "Use for"], rows: [
          ["@generative-a11y/core", "createGenerativeA11y, events, policy, scheduler", "Framework-independent policy"],
          ["@generative-a11y/dom", "announcer, runtime binding, focus, attention, preferences", "Observable browser behavior"],
          ["@generative-a11y/react", "provider and hooks", "React ownership and host element bindings"],
          ["@generative-a11y/ai-sdk", "observer, callbacks, React hooks", "AI SDK useChat public state"],
          ["@generative-a11y/assistant-ui", "bindThreadRuntime", "assistant-ui ThreadRuntime"],
          ["@generative-a11y/ag-ui", "bindAgent", "AG-UI AgentSubscriber callbacks"],
        ] },
      },
      {
        id: "reference-conventions",
        title: "How to read this reference",
        body: ["Every symbol page identifies the import path, exact signature, parameters, return value, defaults, ownership rules, and related APIs. Examples use only public exports from the installed workspace packages."],
        bullets: ["Method return values describe observable library behavior.", "Ownership notes identify which timers, subscriptions, DOM nodes, or framework objects are released by dispose().", "Evidence notes distinguish deterministic intents and DOM results from manual assistive-technology observation.", "Deep links remain stable for sharing in issues and code review."],
      },
    ],
  },
  {
    path: "/api/core",
    group: "Core",
    title: "@generative-a11y/core",
    description: "Browser-independent event policy, streaming segmentation, bounded scheduling, diagnostics, deterministic clocks, and test recording.",
    keywords: ["core", "exports", "runtime", "events", "scheduler"],
    sections: [
      {
        id: "install",
        title: "Install and import",
        body: ["Core has no DOM, React, or AI framework dependency. It accepts normalized lifecycle evidence and emits AnnouncementIntent values."],
        code: { language: "shell", value: "npm install @generative-a11y/core" },
        walkthrough: [{ label: "Install policy only", description: "Use core in any JavaScript runtime, including deterministic tests without a document." }, { label: "Add delivery separately", description: "Browser applications normally pair core with @generative-a11y/dom or @generative-a11y/react." }],
      },
      {
        id: "exports",
        title: "Public export map",
        body: ["Use the narrowest public export for the behavior you own."],
        table: { headers: ["Category", "Exports", "Reference"], rows: [
          ["Runtime", "createGenerativeA11y, GenerativeA11yRuntime", "/api/core/create-generative-a11y"],
          ["Events", "GenerativeA11yEvent and lifecycle types", "/api/core/events"],
          ["Policy", "presets, resolvePolicy, PolicyOverrides", "/api/core/policy"],
          ["Scheduler", "createAnnouncementScheduler and scheduler types", "/api/core/scheduler"],
          ["Testing", "ManualClock, createAnnouncementRecorder", "/api/core/testing"],
          ["Diagnostics", "AnnouncementIntent, AnnouncementDiagnostic", "/api/core/diagnostics"],
        ] },
      },
    ],
  },
  {
    path: "/api/core/create-generative-a11y",
    group: "Core",
    title: "createGenerativeA11y",
    description: "Create and own the framework-independent runtime that turns normalized lifecycle events into paced announcement intents and diagnostics.",
    keywords: ["createGenerativeA11y", "GenerativeA11yRuntime", "dispatch", "dispose"],
    sections: [
      {
        id: "signature",
        title: "Signature and import",
        body: ["Create one runtime per application or intentionally isolated conversation scope. Register delivery before dispatching events that can produce output."],
        code: { language: "typescript", value: `import { createGenerativeA11y } from "@generative-a11y/core";

const runtime = createGenerativeA11y({
  preset: "balanced",
  onAnnouncement(intent) {
    deliver(intent);
  },
});` },
        walkthrough: [{ label: "Import the public constructor", description: "The package root is the supported import path." }, { label: "Resolve one policy", description: "A preset supplies a complete baseline before explicit overrides are applied." }, { label: "Attach output", description: "onAnnouncement is the first listener. Browser integrations usually use connectRuntimeToDOM instead." }],
        api: [
          { name: "options", type: "GenerativeA11yOptions", requirement: "Required", defaultValue: "{} is not implicit", description: "Construction options for policy, time, announcement delivery, delivery errors, and diagnostics." },
          { name: "return", type: "GenerativeA11yRuntime", requirement: "Return", defaultValue: "n/a", description: "An owned runtime with synchronous dispatch, subscriptions, policy inspection, pending work inspection, and disposal." },
        ],
      },
      {
        id: "options",
        title: "GenerativeA11yOptions",
        body: ["Options are read during construction. Nested policy overrides merge with the selected preset."],
        api: [
          { name: "preset", type: "PresetName", requirement: "Optional", defaultValue: '"balanced"', description: "Selects a complete baseline policy: minimal, balanced, verbose, or completion-only behavior." },
          { name: "policy", type: "PolicyOverrides", requirement: "Optional", defaultValue: "{}", description: "Overrides only intentional text, tool, status, pacing, channel, and capacity differences." },
          { name: "clock", type: "Clock", requirement: "Optional", defaultValue: "systemClock", description: "Injects time and timers. Use ManualClock for deterministic tests." },
          { name: "onAnnouncement", type: "AnnouncementListener", requirement: "Optional", defaultValue: "undefined", description: "Registers the first intent listener. Dispatch that produces output requires at least one listener." },
          { name: "onDeliveryError", type: "(error, intent) => void", requirement: "Optional", defaultValue: "undefined", description: "Observes listener failures while delivery continues to later listeners." },
          { name: "onDiagnostic", type: "DiagnosticListener", requirement: "Optional", defaultValue: "undefined", description: "Observes queued, merged, suppressed, cancelled, announced, and delivery-error decisions." },
        ],
      },
      {
        id: "runtime-methods",
        title: "GenerativeA11yRuntime methods",
        body: ["Runtime methods are synchronous. Unsubscribe functions and dispose are idempotent."],
        api: runtimeMethods,
      },
      {
        id: "complete-lifecycle",
        title: "Complete response lifecycle",
        body: ["Deltas contain only the new suffix. A terminal event flushes eligible buffered text and closes the response identity."],
        code: { language: "typescript", value: `const accepted = runtime.dispatch({
  type: "response.started",
  responseId: "report-1",
});

runtime.dispatch({
  type: "response.text.delta",
  responseId: "report-1",
  delta: "The migration completed successfully.",
});

runtime.dispatch({
  type: "response.completed",
  responseId: "report-1",
});

console.log({ accepted, pending: runtime.pendingCount() });
runtime.dispose();` },
        walkthrough: [{ label: "Open stable identity", description: "response.started must precede text and terminal events for this responseId." }, { label: "Dispatch append-only text", description: "The runtime segments the new suffix without rereading accumulated content." }, { label: "Close the lifecycle", description: "Completion flushes useful buffered text and cancels owned response timers." }, { label: "Release ownership", description: "Dispose when the application scope that owns the runtime ends." }],
        note: "AnnouncementIntent delivery is deterministic policy output. It does not prove what assistive technology spoke.",
      },
    ],
  },
  {
    path: "/api/core/events",
    group: "Core",
    title: "GenerativeA11yEvent",
    description: "Serializable normalized event union for responses, tools, interactions, approvals, connections, and citations.",
    keywords: ["GenerativeA11yEvent", "response.started", "tool.started", "interaction.requested"],
    sections: [
      { id: "families", title: "Event families", body: ["Events report host-owned evidence. They do not contain rendered components or private framework state."], table: { headers: ["Family", "Events", "Required identity"], rows: [
        ["Response", "started, text.delta, completed, interrupted, failed, retrying", "responseId"],
        ["Tool", "started, progress, completed, failed", "toolId"],
        ["Interaction", "requested, resolved", "interactionId"],
        ["Approval", "requested, resolved", "approvalId"],
        ["Connection", "lost, restored", "none"],
        ["Citation", "available", "responseId"],
      ] } },
      { id: "response-example", title: "Response replacement example", body: ["Use responseInstanceId when one logical response can be replaced. Late events from the old instance are suppressed as stale."], code: { language: "typescript", value: `runtime.dispatch({
  type: "response.retrying",
  responseId: "report",
  responseInstanceId: "attempt-1",
  nextResponseInstanceId: "attempt-2",
  attempt: 2,
});` }, walkthrough: [{ label: "Keep logical identity", description: "responseId continues to identify the answer being regenerated." }, { label: "Replace the epoch", description: "nextResponseInstanceId becomes the accepted attempt for later deltas and terminals." }] },
      { id: "common-fields", title: "Common fields", body: ["Identity fields define lifecycle scope; labels and messages remain localized user-facing copy."], api: [
        { name: "type", type: "string literal", requirement: "Required", defaultValue: "n/a", description: "Selects one member of the discriminated event union." },
        { name: "eventId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Correlates a normalized event with host telemetry without becoming lifecycle identity." },
        { name: "locale", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Carries the language for user-facing text into intents and DOM delivery." },
        { name: "label / message / announcement", type: "string", requirement: "Event-specific", defaultValue: "undefined", description: "Short localized copy owned by the host. Never pass raw arguments, results, or backend errors." },
      ] },
    ],
  },
  {
    path: "/api/core/policy",
    group: "Core",
    title: "Policy and presets",
    description: "Resolved policy contracts for streaming segmentation, tool verbosity, lifecycle status, channels, pacing, and bounded capacity.",
    keywords: ["presets", "resolvePolicy", "PolicyOverrides", "minimumGapMs"],
    sections: [
      { id: "presets", title: "PresetName", body: ["Presets are complete immutable baselines."], table: { headers: ["Preset", "Streaming", "Operational status"], rows: [["minimal", "Restrained", "Terminals"], ["balanced", "Sentence-paced", "Useful status"], ["verbose", "More frequent", "Progress enabled"], ["completion-only", "Terminal flush", "Minimal"]] } },
      { id: "override", title: "PolicyOverrides", body: ["Nested overrides merge with the selected preset. Unspecified values remain controlled by that preset."], code: { language: "typescript", value: `const runtime = createGenerativeA11y({
  preset: "balanced",
  policy: {
    text: { minimumCharacters: 48, maximumDelayMs: 1_800 },
    tools: { announceProgress: false },
    minimumGapMs: 900,
    maxQueueSize: 64,
  },
});` }, walkthrough: [{ label: "Keep a tested baseline", description: "balanced continues to supply every property not shown." }, { label: "Tune useful differences", description: "Text becomes less fragmented and tool progress remains quiet." }, { label: "Keep work bounded", description: "maxQueueSize prevents an inactive consumer from creating unlimited pending output." }], api: [
        { name: "text.strategy", type: "TextStrategy", requirement: "Optional", defaultValue: "preset value", description: "Selects silent, sentence, paragraph, or completion segmentation." },
        { name: "text.minimumCharacters", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Avoids tiny fragments except when a terminal or maximum-delay flush applies." },
        { name: "text.maximumDelayMs", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Bounds how long useful buffered text waits for a natural boundary." },
        { name: "minimumGapMs", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Paces adjacent intents to reduce interruption and overlap." },
        { name: "dedupeWindowMs", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Suppresses equivalent recent output." },
        { name: "maxQueueSize", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Bounds scheduler candidates and favors content over status during eviction." },
        { name: "maxActiveEntities", type: "number", requirement: "Optional", defaultValue: "preset value", description: "Bounds response and tool identity state and fails closed after capacity." },
      ] },
    ],
  },
  {
    path: "/api/core/scheduler",
    group: "Core",
    title: "createAnnouncementScheduler",
    description: "Low-level bounded scheduler for pacing, deduplication, coalescing, cancellation, capacity priority, and deterministic delivery.",
    keywords: ["createAnnouncementScheduler", "ScheduleAnnouncement", "capacityPriority", "cancelScope"],
    sections: [
      { id: "signature", title: "Signature and ownership", body: ["Most applications should use createGenerativeA11y. Use the scheduler directly only when the host already owns equivalent lifecycle policy."], code: { language: "typescript", value: `const scheduler = createAnnouncementScheduler({
  clock,
  minimumGapMs: 750,
  dedupeWindowMs: 4_000,
  maxQueueSize: 64,
  onAnnouncement: deliver,
  onDiagnostic: recordDiagnostic,
});

scheduler.schedule({
  channel: "polite",
  text: "The report is ready.",
  sourceType: "response.completed",
  scope: "response:report-1",
  capacityPriority: "content",
});` }, walkthrough: [{ label: "Inject the clock", description: "All scheduling time comes from the supplied Clock, which keeps tests deterministic." }, { label: "Bound the queue", description: "maxQueueSize prevents unlimited pending output." }, { label: "Classify capacity", description: "Content can evict status candidates when the queue is full." }, { label: "Scope cancellation", description: "Use the same scope to cancel pending work when its lifecycle terminates." }], api: [
        { name: "options", type: "AnnouncementSchedulerOptions", requirement: "Required", defaultValue: "n/a", description: "Clock, pacing, capacity, announcement listener, and optional diagnostic callbacks." },
        { name: "return", type: "AnnouncementScheduler", requirement: "Return", defaultValue: "n/a", description: "Owned scheduler with schedule, cancelScope, pendingCount, and dispose methods." },
      ] },
      { id: "candidate", title: "ScheduleAnnouncement", body: ["A candidate describes prepared user-facing output. It must not contain raw backend data."], api: [
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Requested announcement urgency." },
        { name: "text", type: "string", requirement: "Required", defaultValue: "n/a", description: "Normalized localized user-facing copy." },
        { name: "sourceType", type: "GenerativeA11yEvent['type']", requirement: "Required", defaultValue: "n/a", description: "Lifecycle evidence that produced the candidate." },
        { name: "delayMs", type: "number", requirement: "Optional", defaultValue: "0", description: "Additional eligibility delay measured by the injected clock." },
        { name: "scope", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Cancellation key for pending work owned by one lifecycle." },
        { name: "coalesceKey", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Replaces equivalent pending work with the newest candidate." },
        { name: "dedupeKey", type: "string", requirement: "Optional", defaultValue: "normalized text", description: "Suppresses equivalent recent delivery within the dedupe window." },
        { name: "capacityPriority", type: "status | content", requirement: "Optional", defaultValue: '"content"', description: "Allows content to displace status work when bounded capacity is exhausted." },
      ] },
      { id: "methods", title: "AnnouncementScheduler methods", body: ["Dispose cancels the owned timer and pending queue."], api: [
        { name: "schedule(candidate)", type: "string | undefined", requirement: "Method", defaultValue: "n/a", description: "Returns a scheduled ID, or undefined when the candidate is merged, deduplicated, rejected, or the scheduler is disposed." },
        { name: "cancelScope(scope)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels every pending candidate with the matching scope." },
        { name: "pendingCount()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Returns the current bounded queue length." },
        { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels the timer and queue. Repeated calls are safe." },
      ] },
    ],
  },
  {
    path: "/api/core/testing",
    group: "Core",
    title: "Testing utilities",
    description: "Deterministic ManualClock and AnnouncementRecorder contracts for testing event policy without browser or real-time waits.",
    keywords: ["ManualClock", "createAnnouncementRecorder", "transcript", "testing"],
    sections: [
      { id: "recorder", title: "createAnnouncementRecorder", body: ["The recorder creates a runtime, ManualClock, announcement transcript, and diagnostic transcript as one test harness."], code: { language: "typescript", value: `const recorder = createAnnouncementRecorder({
  preset: "balanced",
  startAt: 10_000,
});

recorder.runtime.dispatch({
  type: "response.started",
  responseId: "r1",
});
recorder.runtime.dispatch({
  type: "response.text.delta",
  responseId: "r1",
  delta: "A complete sentence.",
});
recorder.clock.advanceBy(2_000);

expect(recorder.transcript()).toHaveLength(1);` }, walkthrough: [{ label: "Create one harness", description: "The recorder wires deterministic time and both output channels into a real runtime." }, { label: "Dispatch production events", description: "Tests exercise the same normalized event contract used by the application." }, { label: "Advance time explicitly", description: "No test waits for global timers or wall-clock time." }], api: [
        { name: "options", type: "Recorder options", requirement: "Optional", defaultValue: "{}", description: "Accepts runtime preset, policy, error handling, and an optional startAt timestamp. Clock and listeners are owned by the recorder." },
        { name: "return", type: "AnnouncementRecorder", requirement: "Return", defaultValue: "n/a", description: "Provides runtime, clock, transcript(), diagnosticTranscript(), and clear()." },
      ] },
      { id: "manual-clock", title: "ManualClock", body: ["ManualClock implements Clock with deterministic timer ordering."], api: [
        { name: "new ManualClock(startAt)", type: "ManualClock", requirement: "Constructor", defaultValue: "0", description: "Creates deterministic time at the supplied timestamp." },
        { name: "now()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Returns the current manual timestamp." },
        { name: "setTimeout(callback, delayMs)", type: "ClockTimer", requirement: "Method", defaultValue: "n/a", description: "Registers an owned deterministic callback." },
        { name: "clearTimeout(timer)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels a registered timer." },
        { name: "advanceBy(ms)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Advances time and runs due callbacks in deterministic order." },
      ] },
    ],
  },
  {
    path: "/api/core/diagnostics",
    group: "Core",
    title: "Intents and diagnostics",
    description: "AnnouncementIntent output and AnnouncementDiagnostic decisions for delivery, tests, telemetry, and bounded failure analysis.",
    keywords: ["AnnouncementIntent", "AnnouncementDiagnostic", "DiagnosticReason", "count"],
    sections: [
      { id: "intent", title: "AnnouncementIntent", body: ["An intent is immutable core policy output. It is not proof of DOM delivery or assistive-technology speech."], api: [
        { name: "id", type: "string", requirement: "Required", defaultValue: "n/a", description: "Unique scheduled output identity." },
        { name: "at", type: "number", requirement: "Required", defaultValue: "n/a", description: "Injected clock timestamp at delivery." },
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Requested urgency for the delivery layer." },
        { name: "text", type: "string", requirement: "Required", defaultValue: "n/a", description: "Normalized localized copy." },
        { name: "sourceType", type: "event type", requirement: "Required", defaultValue: "n/a", description: "Normalized lifecycle evidence that produced this intent." },
        { name: "responseId / toolId / interactionId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Optional source lifecycle correlation." },
      ] },
      { id: "diagnostic", title: "AnnouncementDiagnostic", body: ["Diagnostics are observational. Listener failures never alter runtime behavior, and repeated equivalent overflow decisions can be aggregated with count."], table: { headers: ["Disposition", "Typical reasons", "Meaning"], rows: [["queued", "scheduled", "Candidate entered the scheduler"], ["merged", "coalesced", "Pending equivalent work was replaced"], ["suppressed", "duplicate, policy-silent, stale-response", "Policy or identity prevented output"], ["cancelled", "scope-cancelled, runtime-disposed", "Pending work became invalid"], ["announced", "delivered, delivery-error", "Listeners accepted output or every attempt failed"]] }, api: [
        { name: "disposition", type: "DiagnosticDisposition", requirement: "Required", defaultValue: "n/a", description: "High-level outcome category." },
        { name: "reason", type: "DiagnosticReason", requirement: "Required", defaultValue: "n/a", description: "Stable machine-readable explanation for the decision." },
        { name: "count", type: "number", requirement: "Optional", defaultValue: "undefined", description: "Number of equivalent decisions represented by an aggregated diagnostic." },
      ] },
    ],
  },
  {
    path: "/api/dom",
    group: "DOM",
    title: "@generative-a11y/dom",
    description: "Browser delivery, runtime binding, conservative focus helpers, attention evidence, and validated preference storage.",
    keywords: ["DOM", "ariaNotify", "live region", "focus", "preferences"],
    sections: [
      { id: "install", title: "Install browser delivery", body: ["The DOM package depends on core and remains independent of React and AI frameworks."], code: { language: "shell", value: "npm install @generative-a11y/core @generative-a11y/dom" }, walkthrough: [{ label: "Keep policy separate", description: "Core produces intents without browser globals." }, { label: "Add observable delivery", description: "DOM converts those intents into ariaNotify attempts or stable live-region mutations." }] },
      { id: "exports", title: "Public export map", body: ["Choose direct announcing or bind an existing runtime."], table: { headers: ["Category", "Exports", "Reference"], rows: [["Delivery", "createDOMAnnouncer", "/api/dom/create-dom-announcer"], ["Runtime binding", "connectRuntimeToDOM", "/api/dom/connect-runtime-to-dom"], ["Focus", "captureFocus, focusElement, restoreFocus", "/api/dom/focus"], ["Attention", "createAttentionStore", "/api/dom/attention"], ["Preferences", "createPreferenceStore and mapping helpers", "/api/dom/preferences"]] } },
    ],
  },
  {
    path: "/api/dom/create-dom-announcer",
    group: "DOM",
    title: "createDOMAnnouncer",
    description: "Create an owned browser announcer with progressive ariaNotify delivery, stable live-region fallback, diagnostics, and cleanup.",
    keywords: ["createDOMAnnouncer", "DOMAnnouncerOptions", "DOMDeliveryResult", "live region"],
    sections: [
      { id: "signature", title: "Signature and import", body: ["auto mode attempts ariaNotify when available, then falls back to the selected polite or assertive live region."], code: { language: "typescript", value: `import { createDOMAnnouncer } from "@generative-a11y/dom";

const announcer = createDOMAnnouncer({
  mode: "auto",
  onDiagnostic(result) {
    console.log(result.status, result.method);
  },
});

const result = announcer.announce(intent);
announcer.dispose();` }, walkthrough: [{ label: "Use progressive delivery", description: "auto keeps the fallback available when ariaNotify is absent or throws." }, { label: "Observe the attempt", description: "DOMDeliveryResult reports the browser action without making a speech claim." }, { label: "Release owned nodes", description: "Dispose removes only live regions created by this announcer." }], api: [
        { name: "options", type: "DOMAnnouncerOptions", requirement: "Optional", defaultValue: "{}", description: "Selects document, delivery mode, supplied regions, and diagnostic observation." },
        { name: "return", type: "DOMAnnouncer", requirement: "Return", defaultValue: "n/a", description: "Owned announcer with announce, getRegions, and dispose methods." },
      ] },
      { id: "options", title: "DOMAnnouncerOptions", body: ["Supplying regions transfers neither node ownership nor removal responsibility to the library."], api: [
        { name: "document", type: "Document", requirement: "Optional", defaultValue: "global document", description: "Document used to create live regions. Without a document, the announcer remains inert and reports unavailable." },
        { name: "mode", type: "auto | aria-notify | live-region", requirement: "Optional", defaultValue: '"auto"', description: "Selects progressive enhancement or a forced test path." },
        { name: "regions", type: "DOMLiveRegions", requirement: "Optional", defaultValue: "owned regions", description: "Supplies stable polite and assertive elements. Both must belong to the same document." },
        { name: "onDiagnostic", type: "(result) => void", requirement: "Optional", defaultValue: "undefined", description: "Observes each delivery attempt. Callback failures cannot alter delivery." },
      ] },
      { id: "result", title: "DOMDeliveryResult", body: ["announce returns one result synchronously."], table: { headers: ["Status", "Method", "Meaning"], rows: [["notified", "aria-notify", "ariaNotify returned without throwing"], ["mutated", "live-region", "The selected stable region text changed"], ["unavailable", "none", "No usable document or region exists"], ["disposed", "none", "announce was called after disposal"]] }, api: [
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Intent channel selected for this attempt." },
        { name: "error", type: "{ name, message }", requirement: "Optional", defaultValue: "undefined", description: "Serializable ariaNotify failure information when fallback was needed." },
      ], note: "A notified or mutated result proves an observable browser action. It does not prove a screen reader spoke." },
    ],
  },
  {
    path: "/api/dom/connect-runtime-to-dom",
    group: "DOM",
    title: "connectRuntimeToDOM",
    description: "Subscribe an existing core runtime to a DOMAnnouncer while preserving separate runtime and browser ownership.",
    keywords: ["connectRuntimeToDOM", "DOMRuntimeBinding", "dispose"],
    sections: [
      { id: "signature", title: "Signature and import", body: ["The binding borrows the runtime. Disposing it removes only its subscription and announcer resources."], code: { language: "typescript", value: `import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const delivery = connectRuntimeToDOM(runtime, { mode: "auto" });

runtime.dispatch(event);

delivery.dispose();
runtime.dispose();` }, walkthrough: [{ label: "Create policy", description: "The application owns the core runtime." }, { label: "Attach browser delivery", description: "The binding subscribes before lifecycle events are dispatched." }, { label: "Dispose inside out", description: "Release the borrowed binding before the runtime it observes." }], api: [
        { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Required", defaultValue: "n/a", description: "Borrowed runtime that supplies announcement intents." },
        { name: "options", type: "DOMAnnouncerOptions", requirement: "Optional", defaultValue: "{}", description: "Forwarded to the owned DOM announcer." },
        { name: "return", type: "DOMRuntimeBinding", requirement: "Return", defaultValue: "n/a", description: "Provides the announcer and an idempotent dispose function." },
      ] },
      { id: "ownership", title: "DOMRuntimeBinding", body: ["The binding never disposes a borrowed runtime or application-supplied live regions."], api: [
        { name: "announcer", type: "DOMAnnouncer", requirement: "Property", defaultValue: "n/a", description: "Owned announcer used for every runtime intent." },
        { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Unsubscribes from the runtime and disposes the owned announcer." },
      ] },
    ],
  },
  {
    path: "/api/dom/focus",
    group: "DOM",
    title: "Focus helpers",
    description: "Conservative capture, focus, and restoration helpers for application-owned interaction workflows.",
    keywords: ["captureFocus", "focusElement", "restoreFocus", "FocusResult"],
    sections: [
      { id: "workflow", title: "Capture and restore application focus", body: ["Use focus helpers only for application-owned dialogs and interactions. Streaming and routine status must never move focus."], code: { language: "typescript", value: `const capture = captureFocus(document);
const opened = focusElement(dialogHeading, { preventScroll: true });

// After the application-owned interaction closes:
const restored = restoreFocus(capture, {
  onlyIfFocusWithin: dialog,
});` }, walkthrough: [{ label: "Capture before opening", description: "The returned value records a connected element without changing focus." }, { label: "Focus the interaction", description: "The host decides which semantic target receives focus." }, { label: "Restore conservatively", description: "onlyIfFocusWithin prevents restoration after the user intentionally moved elsewhere." }], api: [
        { name: "captureFocus(document)", type: "FocusCapture", requirement: "Function", defaultValue: "global document", description: "Captures the deep active element from the supplied document." },
        { name: "focusElement(element, options)", type: "FocusResult", requirement: "Function", defaultValue: "preventScroll: true", description: "Attempts focus and reports focused or a stable skipped reason." },
        { name: "restoreFocus(capture, options)", type: "FocusResult", requirement: "Function", defaultValue: "n/a", description: "Restores only when the captured target remains eligible and optional guards still match." },
      ] },
      { id: "results", title: "FocusResult", body: ["Results are explicit so applications can test focus workflows without guessing."], table: { headers: ["Status", "Meaning", "Application response"], rows: [["focused", "The target became active", "Continue the workflow"], ["skipped", "A documented eligibility check, browser failure, or restoration guard prevented focus", "Preserve current focus and inspect reason"]] } },
    ],
  },
  {
    path: "/api/dom/attention",
    group: "DOM",
    title: "createAttentionStore",
    description: "External store for conservative browser attention evidence from visibility, window focus, deep focus area, and newest-response intersection.",
    keywords: ["createAttentionStore", "AttentionStore", "AttentionSnapshot", "registerComposer"],
    sections: [
      { id: "signature", title: "Create and register host elements", body: ["Attention is browser evidence only. It does not inspect a screen-reader cursor and never moves focus."], code: { language: "typescript", value: `const attention = createAttentionStore({ document });

const unregisterComposer = attention.registerComposer(composer);
const unregisterConversation = attention.registerConversation(conversation);
const unregisterNewest = attention.registerNewestResponse(latestResponse);

const unsubscribe = attention.subscribe(() => {
  console.log(attention.getSnapshot());
});

unsubscribe();
unregisterNewest();
unregisterConversation();
unregisterComposer();
attention.dispose();` }, walkthrough: [{ label: "Create browser evidence", description: "The store observes only public document, window, focus, and intersection signals." }, { label: "Register semantic areas", description: "Element identity lets the store classify composer, conversation history, and newest response." }, { label: "Release registrations", description: "Each registration and subscription has independent cleanup." }], api: [
        { name: "options", type: "AttentionStoreOptions", requirement: "Optional", defaultValue: "browser document", description: "Injects the document, intersection observer factory, and observer configuration." },
        { name: "return", type: "AttentionStore", requirement: "Return", defaultValue: "n/a", description: "External store with snapshots, registrations, subscriptions, and disposal." },
      ] },
      { id: "snapshot", title: "AttentionSnapshot", body: ["unknown is preserved when evidence is unavailable rather than inferred."], table: { headers: ["Field", "Values", "Evidence"], rows: [["visibility", "visible, hidden, unknown", "Document visibility"], ["windowFocus", "focused, blurred, unknown", "Window focus"], ["focusArea", "composer, conversation, elsewhere, none, unknown", "Deep active element"], ["newestResponse", "visible, outside, unobserved, unknown", "Intersection observer"], ["mode", "foreground, background, reading-history, away, unknown", "Conservative derivation"]] } },
    ],
  },
  {
    path: "/api/dom/preferences",
    group: "DOM",
    title: "PreferenceStore",
    description: "Validated, versioned external store for user-controlled streaming and tool verbosity with optional persistence.",
    keywords: ["createPreferenceStore", "PreferenceSchemaV1", "preferencesToCoreConfiguration", "storage"],
    sections: [
      { id: "store", title: "createPreferenceStore", body: ["The store validates loaded and assigned values before exposing a stable snapshot."], code: { language: "typescript", value: `const store = createPreferenceStore({
  defaultValue: defaultPreferences,
  persistence: {
    key: "chat:a11y-preferences",
    storage: window.localStorage,
    events: {
      subscribe(listener) {
        const handle = (event: StorageEvent) => listener(event);
        window.addEventListener("storage", handle);
        return () => window.removeEventListener("storage", handle);
      },
    },
  },
});

const unsubscribe = store.subscribe(() => {
  const preferences = store.getSnapshot();
  const configuration = preferencesToCoreConfiguration(preferences);
  applyConfiguration(configuration);
});

store.setPreferences({
  version: 1,
  preset: "balanced",
  streaming: "sentence",
  tools: "status",
});` }, walkthrough: [{ label: "Supply persistence explicitly", description: "Injected storage keeps SSR and tests deterministic." }, { label: "Subscribe as an external store", description: "getSnapshot returns validated versioned preferences." }, { label: "Map to core", description: "The helper converts user-facing verbosity into a core preset and policy override." }], api: [
        { name: "defaultValue", type: "PreferenceSchemaV1", requirement: "Optional", defaultValue: "defaultPreferences", description: "Validated snapshot used when persistence is missing or invalid." },
        { name: "persistence.key", type: "string", requirement: "Optional", defaultValue: "library key", description: "Storage key for the serialized versioned schema." },
        { name: "persistence.storage", type: "PreferenceStorage", requirement: "Optional", defaultValue: "localStorage when available", description: "Injected getItem and setItem surface." },
        { name: "persistence.events", type: "PreferenceStorageEventSource", requirement: "Optional", defaultValue: "storage events when available", description: "Synchronizes validated changes from other documents." },
        { name: "onDiagnostic", type: "callback", requirement: "Optional", defaultValue: "undefined", description: "Observes invalid, unavailable, read, write, and event-source outcomes." },
      ] },
      { id: "schema", title: "PreferenceSchemaV1 and helpers", body: ["The version field makes persistence migrations explicit."], api: [
        { name: "defaultPreferences", type: "PreferenceSchemaV1", requirement: "Constant", defaultValue: "balanced", description: "Frozen balanced user preference snapshot." },
        { name: "normalizePreferences(value)", type: "PreferenceSchemaV1", requirement: "Function", defaultValue: "n/a", description: "Validates and freezes a schema value. Invalid fields or unsupported versions throw TypeError." },
        { name: "samePreferences(left, right)", type: "boolean", requirement: "Function", defaultValue: "n/a", description: "Compares the supported schema fields." },
        { name: "preferencesToCoreConfiguration(value)", type: "CorePreferenceConfiguration", requirement: "Function", defaultValue: "n/a", description: "Maps user verbosity to a core preset and policy overrides." },
      ] },
    ],
  },
  {
    path: "/api/react",
    group: "React",
    title: "@generative-a11y/react",
    description: "React provider, DOM delivery, attention, preferences, and ref bindings that preserve the host application's visual interface.",
    keywords: ["React", "GenerativeA11yProvider", "hooks", "bindings"],
    sections: [
      { id: "provider", title: "GenerativeA11yProvider", body: ["The provider can own a runtime or borrow one supplied by the application. It renders only stable hidden delivery regions and leaves visible UI unchanged."], code: { language: "tsx", value: `import { GenerativeA11yProvider } from "@generative-a11y/react";

export function App() {
  return (
    <GenerativeA11yProvider
      preset="balanced"
      dom={{ mode: "auto" }}
    >
      <ExistingChat />
    </GenerativeA11yProvider>
  );
}` }, walkthrough: [{ label: "Place one owner", description: "Mount the provider around the application scope that owns accessibility policy." }, { label: "Keep delivery progressive", description: "The DOM option controls hidden browser delivery without replacing visible components." }, { label: "Preserve the host", description: "ExistingChat remains responsible for semantics, keyboard behavior, and application focus." }], api: [
        { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Optional", defaultValue: "owned runtime", description: "Borrows an existing runtime when provided. The provider does not dispose borrowed ownership." },
        { name: "dom", type: "false | GenerativeA11yDOMOptions", requirement: "Optional", defaultValue: "{}", description: "Configures hidden DOM delivery or disables it." },
        { name: "attention", type: "false | AttentionStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures an owned conservative attention store or disables collection." },
        { name: "attentionStore", type: "AttentionStore", requirement: "Optional", defaultValue: "owned store", description: "Borrows an application-supplied attention store." },
        { name: "preferences", type: "PreferenceStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures an owned preference store." },
        { name: "preferenceStore", type: "PreferenceStore", requirement: "Optional", defaultValue: "owned store", description: "Borrows an application-supplied preference store." },
      ] },
      { id: "ownership", title: "Provider ownership", body: ["Owned runtime, DOM binding, stores, timers, subscriptions, and regions are released on unmount. Borrowed resources remain application-owned."], bullets: ["Provider context is unavailable outside the provider.", "SSR uses stable hidden structure and unknown attention evidence.", "Routine announcements never move focus.", "Preference changes update owned policy without replacing host components."] },
    ],
  },
  {
    path: "/api/react/hooks",
    group: "React",
    title: "React hooks",
    description: "Context, runtime, attention, preference, and host-element binding hooks exported by @generative-a11y/react.",
    keywords: ["useGenerativeA11y", "useGenerativeA11yRuntime", "useGenerativeA11yBindings", "hooks"],
    sections: [
      { id: "complete-example", title: "Bind an existing chat surface", body: ["Bindings provide refs only. Spread them onto the existing semantic host elements."], code: { language: "tsx", value: `function ExistingChat() {
  const runtime = useGenerativeA11yRuntime();
  const attention = useGenerativeA11yAttention();
  const { preferences, setPreferences } = useGenerativeA11yPreferences();
  const bindings = useGenerativeA11yBindings();

  return (
    <main {...bindings.conversationProps}>
      <article {...bindings.newestResponseProps}>Latest response</article>
      <textarea {...bindings.composerProps} />
      <button onClick={() => runtime.dispatch(startEvent)}>Send</button>
      <output>{attention.mode}</output>
      <button onClick={() => setPreferences({ ...preferences, streaming: "less" })}>
        Reduce streaming detail
      </button>
    </main>
  );
}` }, walkthrough: [{ label: "Read the owned runtime", description: "Dispatch only lifecycle evidence the host already owns." }, { label: "Register existing elements", description: "Ref bindings classify attention without changing markup or styles." }, { label: "Expose user control", description: "Preference updates remain validated and versioned." }], api: [
        { name: "useGenerativeA11y()", type: "GenerativeA11yContextValue", requirement: "Hook", defaultValue: "n/a", description: "Returns runtime, attentionStore, and preferenceStore from the nearest provider." },
        { name: "useGenerativeA11yRuntime()", type: "GenerativeA11yRuntime", requirement: "Hook", defaultValue: "n/a", description: "Returns the provider runtime." },
        { name: "useGenerativeA11yAttention()", type: "AttentionSnapshot", requirement: "Hook", defaultValue: "unknown SSR snapshot", description: "Subscribes through useSyncExternalStore to conservative attention evidence." },
        { name: "useGenerativeA11yPreferences()", type: "GenerativeA11yPreferencesResult", requirement: "Hook", defaultValue: "n/a", description: "Returns validated preferences, setPreferences, and the underlying store." },
        { name: "useGenerativeA11yBindings()", type: "GenerativeA11yBindings", requirement: "Hook", defaultValue: "n/a", description: "Returns stable composer, conversation, and newest-response ref props." },
      ] },
      { id: "binding-contracts", title: "GenerativeA11yBindings", body: ["Each property contains a React ref callback for one host-owned semantic area."], table: { headers: ["Property", "Target", "Purpose"], rows: [["composerProps", "HTMLTextAreaElement", "Classifies composer focus"], ["conversationProps", "HTMLElement", "Classifies history focus"], ["newestResponseProps", "HTMLElement", "Observes newest response visibility"]] } },
    ],
  },
  {
    path: "/api/ai-sdk",
    group: "AI SDK",
    title: "@generative-a11y/ai-sdk",
    description: "Translate documented AI SDK useChat state and exact callback terminals into normalized generative-a11y events.",
    keywords: ["AI SDK", "createObserver", "composeChatCallbacks", "useChat"],
    sections: [
      { id: "surface", title: "Public surfaces", body: ["The adapter reads documented messages, status, and error state. Exact finish and error terminals come from callbacks composed into useChat."], table: { headers: ["Surface", "Exports", "Use"], rows: [["Framework-neutral", "createObserver, composeChatCallbacks", "Custom subscription or state bridge"], ["React", "useChatAccessibility, useObserveChatAccessibility", "AI SDK useChat components"], ["Metadata", "CHAT_ADAPTER_METADATA", "Declared fidelity and evidence review"]] } },
      { id: "ownership", title: "Evidence and ownership", body: ["The adapter borrows the core runtime and never performs chat actions. It does not parse rendered messages or private AI SDK fields."], bullets: ["Response and message IDs are namespaced by scopeId.", "Tool arguments do not prove execution.", "Callbacks preserve host onFinish and onError behavior.", "Observer disposal clears only adapter-owned identity state."] },
    ],
  },
  {
    path: "/api/ai-sdk/use-chat-accessibility",
    group: "AI SDK",
    title: "useChatAccessibility",
    description: "Create the AI SDK observer and exact terminal callbacks before invoking useChat in the same React component.",
    keywords: ["useChatAccessibility", "useObserveChatAccessibility", "ChatIntegration", "useChat"],
    sections: [
      { id: "complete-example", title: "Complete useChat integration", body: ["Call useChatAccessibility first, pass chatCallbacks into useChat, then observe the documented snapshot."], code: { language: "tsx", value: `const accessibility = useChatAccessibility({
  runtime,
  scopeId: "support-thread",
  getToolLabel({ toolName }) {
    return toolName === "lookupOrder" ? "Look up order" : "A tool";
  },
  onFinish: hostOnFinish,
  onError: hostOnError,
});

const chat = useChat({
  id: "support-thread",
  ...accessibility.chatCallbacks,
});

useObserveChatAccessibility({
  integration: accessibility,
  snapshot: chat,
});` }, walkthrough: [{ label: "Create callbacks first", description: "The hook creates one observer and callback pair for the runtime and scope." }, { label: "Compose with useChat", description: "Exact finish and error evidence reaches both the adapter and host callbacks." }, { label: "Observe public state", description: "The second hook translates messages, status, and error after useChat returns." }, { label: "Let the hook clean up", description: "The owning hook disposes its observer after unmount while preserving React strict-mode remount behavior." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Borrowed normalized event target." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for messages, tools, approvals, and citations." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds adapter identity memory and suppresses new identity after saturation." },
        { name: "getToolLabel", type: "(context) => string", requirement: "Optional", defaultValue: '"A tool"', description: "Maps public tool context to short localized copy without exposing arguments." },
        { name: "onFinish / onError", type: "AI SDK callbacks", requirement: "Optional", defaultValue: "undefined", description: "Host callbacks preserved by chatCallbacks after adapter observation." },
        { name: "return", type: "ChatIntegration", requirement: "Return", defaultValue: "n/a", description: "Observer plus onFinish and onError callbacks for useChat." },
      ] },
      { id: "observe", title: "useObserveChatAccessibility", body: ["The observer hook borrows ChatIntegration and never disposes it."], api: [
        { name: "integration", type: "ChatIntegration", requirement: "Required", defaultValue: "n/a", description: "Value returned by useChatAccessibility." },
        { name: "snapshot", type: "UseChatSnapshot", requirement: "Required", defaultValue: "n/a", description: "Documented messages, status, and error fields from useChat." },
        { name: "return", type: "void", requirement: "Return", defaultValue: "n/a", description: "Observation occurs in an effect after the snapshot commits." },
      ] },
    ],
  },
  {
    path: "/api/assistant-ui",
    group: "assistant-ui",
    title: "@generative-a11y/assistant-ui",
    description: "Translate assistant-ui ThreadRuntime public state and subscriptions into normalized response, tool, approval, and citation events.",
    keywords: ["assistant-ui", "ThreadRuntime", "THREAD_ADAPTER_METADATA"],
    sections: [
      { id: "exports", title: "Public exports", body: ["The adapter observes only getState and subscribe from the supplied ThreadRuntime."], table: { headers: ["Export", "Kind", "Purpose"], rows: [["bindThreadRuntime", "Function", "Create one adapter subscription"], ["THREAD_ADAPTER_METADATA", "Frozen constant", "Declare fidelity and observed methods"], ["BindThreadRuntimeOptions", "Interface", "Binding input contract"], ["ThreadBinding", "Interface", "Adapter cleanup contract"]] } },
      { id: "fidelity", title: "Declared fidelity", body: ["Interruption is exact. Generic retry and connection evidence are unavailable. Tool failure and citations depend on public content parts."], note: "Unavailable evidence is not reconstructed from rendered text, timing, or private runtime fields." },
    ],
  },
  {
    path: "/api/assistant-ui/bind-thread-runtime",
    group: "assistant-ui",
    title: "bindThreadRuntime",
    description: "Subscribe to one public assistant-ui ThreadRuntime and dispatch normalized events into a borrowed core runtime.",
    keywords: ["bindThreadRuntime", "BindThreadRuntimeOptions", "ThreadBinding"],
    sections: [
      { id: "signature", title: "Signature and import", body: ["Create one binding per thread scope and dispose it when that subscription owner unmounts."], code: { language: "typescript", value: `import { bindThreadRuntime } from "@generative-a11y/assistant-ui";

const binding = bindThreadRuntime({
  runtime,
  scopeId: "support-thread",
  thread,
  maxTrackedEntities: 1_000,
});

// Removes only the subscription and adapter state.
binding.dispose();` }, walkthrough: [{ label: "Borrow the runtime", description: "The binding dispatches events but never disposes core ownership." }, { label: "Namespace the thread", description: "scopeId prevents collisions across mounted conversations." }, { label: "Observe the public surface", description: "Only getState and subscribe are required from ThreadRuntime." }, { label: "Release the binding", description: "Dispose removes its subscription without altering the thread runtime." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Borrowed normalized event target." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for message, tool, approval, and citation identity." },
        { name: "thread", type: "ThreadRuntimeSource", requirement: "Required", defaultValue: "n/a", description: "Borrowed getState and subscribe surface from assistant-ui." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds message, part, tool, and approval identity tracking." },
        { name: "return", type: "ThreadBinding", requirement: "Return", defaultValue: "n/a", description: "An idempotent dispose method for the adapter subscription." },
      ] },
      { id: "translation", title: "Translation contract", body: ["The adapter diffs public thread snapshots conservatively."], table: { headers: ["assistant-ui evidence", "Normalized output", "Fidelity"], rows: [["Assistant message starts running", "response.started", "Exact public state"], ["Append-only text growth", "response.text.delta", "Exact suffix"], ["Terminal message status", "completed, interrupted, failed", "Exact public status"], ["Tool call and result parts", "tool lifecycle", "Public part dependent"], ["Approval state", "approval requested or resolved", "Public part dependent"], ["Source parts", "citation.available", "Optional"]] } },
    ],
  },
  {
    path: "/api/ag-ui",
    group: "AG-UI",
    title: "@generative-a11y/ag-ui",
    description: "Translate documented AG-UI AgentSubscriber callbacks into normalized response, tool, and interaction events.",
    keywords: ["AG-UI", "AgentSubscriber", "AGENT_ADAPTER_METADATA"],
    sections: [
      { id: "exports", title: "Public exports", body: ["The adapter subscribes through the documented agent.subscribe(AgentSubscriber) surface."], table: { headers: ["Export", "Kind", "Purpose"], rows: [["bindAgent", "Function", "Create one protocol callback subscription"], ["AGENT_ADAPTER_METADATA", "Frozen constant", "Declare fidelity, observation, and saturation"], ["BindAgentOptions", "Interface", "Binding input contract"], ["AgentBinding", "Interface", "Adapter cleanup contract"]] } },
      { id: "fidelity", title: "Declared fidelity", body: ["Interruption is exact from protocol events. Generic retries and connection changes are unavailable. Input-required interactions depend on interrupt callbacks."], note: "The adapter does not subscribe to replay-prone private observables or infer missing protocol events." },
    ],
  },
  {
    path: "/api/ag-ui/bind-agent",
    group: "AG-UI",
    title: "bindAgent",
    description: "Subscribe to one AG-UI agent through documented callbacks and dispatch normalized events into a borrowed core runtime.",
    keywords: ["bindAgent", "BindAgentOptions", "AgentBinding", "AgentSubscriber"],
    sections: [
      { id: "signature", title: "Signature and import", body: ["Create the binding after the agent is ready, then dispose it when the owning application scope ends."], code: { language: "typescript", value: `import { bindAgent } from "@generative-a11y/ag-ui";

const binding = bindAgent({
  runtime,
  scopeId: "research-agent",
  agent,
  maxTrackedEntities: 1_000,
});

// Unsubscribes without disposing agent or runtime.
binding.dispose();` }, walkthrough: [{ label: "Borrow the agent", description: "The binding calls documented subscribe behavior and never owns agent execution." }, { label: "Namespace protocol IDs", description: "scopeId prevents message, tool, and interrupt collisions across agents." }, { label: "Bound identity", description: "The adapter suppresses new identities after capacity instead of evicting active protocol state." }, { label: "Dispose only the subscription", description: "Runtime and agent lifetimes remain with the host application." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Borrowed normalized event target." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for AG-UI message, tool, and interrupt IDs." },
        { name: "agent", type: "AgentSource", requirement: "Required", defaultValue: "n/a", description: "Borrowed object exposing documented subscribe behavior." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Positive safe integer bounding tracked responses, tools, and interactions." },
        { name: "return", type: "AgentBinding", requirement: "Return", defaultValue: "n/a", description: "An idempotent dispose method for the protocol subscription." },
      ] },
      { id: "translation", title: "AgentSubscriber translation", body: ["Callbacks provide exact protocol evidence without parsing host UI."], table: { headers: ["AG-UI callback family", "Normalized output", "Notes"], rows: [["Text message start, content, end", "response lifecycle", "Append-only protocol deltas"], ["Tool call start, args, result, end", "tool lifecycle", "Execution starts from protocol evidence, not arguments alone"], ["Run error or interruption", "response.failed or interrupted", "Safe localized copy only"], ["Interrupt and resume", "interaction requested or resolved", "Input-required lifecycle"], ["Run initialized", "resolution evidence", "Matches known active interrupt IDs"]] } },
    ],
  },
];

export const API_PAGES: readonly DocPage[] = Object.freeze(pages);
