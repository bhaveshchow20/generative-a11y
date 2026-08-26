import type { ApiEntry, DocPage } from "./content";

const runtimeMethods: readonly ApiEntry[] = [
  { name: "dispatch(event)", type: "boolean", requirement: "Method", defaultValue: "n/a", description: "Processes one serializable GenerativeA11yEvent synchronously. Returns false after disposal or when a nested dispatch transaction reaches capacity." },
  { name: "getPolicy()", type: "ReadonlyAnnouncementPolicy", requirement: "Method", defaultValue: "n/a", description: "Returns the resolved immutable policy used by this runtime." },
  { name: "pendingCount()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Counts scheduler candidates and owned response flush timers. Use it for tests and diagnostics, not application rendering." },
  { name: "subscribeAnnouncements(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Registers an AnnouncementIntent listener and returns an idempotent unsubscribe function." },
  { name: "subscribeDiagnostics(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Registers an AnnouncementDiagnostic listener and returns an idempotent unsubscribe function." },
  { name: "subscribeDiagnosticEvents(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Observes a versioned ordered stream of source events and diagnostic decisions without changing scheduling." },
  { name: "getDiagnosticSnapshot()", type: "RuntimeDiagnosticSnapshotV1", requirement: "Method", defaultValue: "n/a", description: "Returns immutable content-free response, tool, queue, and flush timing state for diagnostic consumers." },
  { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels every owned timer, clears bounded state and queued work, then releases listeners. Repeated calls are safe." },
];

const pages: DocPage[] = [
  {
    path: "/api",
    group: "API overview",
    title: "API reference",
    description: "Package and symbol-level reference for every public generative-a11y runtime, browser, React, framework adapter, devtools, and testing contract.",
    keywords: ["API", "reference", "exports", "packages", "TypeScript"],
    sections: [
      {
        id: "packages",
        title: "Choose the packages you need",
        body: ["Start with core. Add DOM or React for browser updates, then add a framework adapter if your app uses that framework."],
        table: { headers: ["Package", "Primary exports", "Use for"], rows: [
          ["@generative-a11y/core", "createGenerativeA11y, events, policy, scheduler", "Framework-independent policy"],
          ["@generative-a11y/dom", "announcer, runtime binding, focus, attention, preferences", "Browser updates and helpers"],
          ["@generative-a11y/react", "provider and hooks", "React setup and element bindings"],
          ["@generative-a11y/ai-sdk", "observer, callbacks, React hooks", "AI SDK useChat public state"],
          ["@generative-a11y/assistant-ui", "bindThreadRuntime", "assistant-ui ThreadRuntime"],
          ["@generative-a11y/ag-ui", "bindAgent", "AG-UI AgentSubscriber callbacks"],
          ["@generative-a11y/devtools", "createDevtoolsStore, overlay", "Bounded redacted development traces"],
          ["@generative-a11y/test", "recordRuntime, replayEvents, matchers", "Deterministic lifecycle tests"],
        ] },
      },
      {
        id: "reference-conventions",
        title: "How to read this reference",
        body: ["Each symbol page lists the import path, signature, parameters, return value, defaults, cleanup rules, and related APIs. Every example uses public exports from the installed packages."],
        bullets: ["Method return values describe behavior the library can confirm.", "Cleanup notes list the timers, subscriptions, DOM nodes, or framework objects released by dispose().", "Test notes separate runtime and browser results from hands-on screen-reader tests.", "You can link to any API page from an issue or code review."],
      },
    ],
  },
  {
    path: "/api/core",
    group: "Core",
    title: "@generative-a11y/core",
    description: "Core events, announcement rules, streaming text, scheduling, diagnostics, test clocks, and recorders.",
    keywords: ["core", "exports", "runtime", "events", "scheduler"],
    sections: [
      {
        id: "install",
        title: "Install and import",
        body: ["Core does not depend on the DOM, React, or an AI framework. Your app sends it GenerativeA11yEvent objects, and it creates AnnouncementIntent objects when there is something useful to announce."],
        code: { language: "shell", value: "npm install @generative-a11y/core" },
        walkthrough: [{ label: "Install core", description: "Use core in any JavaScript runtime, including tests that do not have a document." }, { label: "Add browser delivery", description: "Browser apps pair core with @generative-a11y/dom or @generative-a11y/react." }],
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
    description: "Create the core runtime that turns app events into well-timed AnnouncementIntent objects and useful debugging details.",
    keywords: ["createGenerativeA11y", "GenerativeA11yRuntime", "dispatch", "dispose"],
    sections: [
      {
        id: "signature",
        title: "Signature and import",
        body: ["Create one runtime for your app or for each conversation that needs separate settings. Connect delivery before sending events that can produce output."],
        code: { language: "typescript", value: `import { createGenerativeA11y } from "@generative-a11y/core";

const runtime = createGenerativeA11y({
  preset: "balanced",
  onAnnouncement(intent) {
    deliver(intent);
  },
});` },
        walkthrough: [{ label: "Import the constructor", description: "Import createGenerativeA11y from the package root." }, { label: "Choose a preset", description: "Presets supply default behavior. policy changes only the settings you provide." }, { label: "Connect output", description: "onAnnouncement registers the first listener. Browser apps usually use connectRuntimeToDOM instead." }],
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
        body: ["Each delta contains only new text. A completed event announces useful text that is still waiting, then closes the response."],
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
        walkthrough: [{ label: "Start the response", description: "Send response.started before text or final events for this responseId." }, { label: "Send new text", description: "Each delta contains only the text added since the last event." }, { label: "Finish the response", description: "Completion announces useful text that is still waiting and cancels response timers." }, { label: "Clean up", description: "Call dispose when the app no longer needs the runtime." }],
        note: "AnnouncementIntent describes an update prepared by core. Test with a real screen reader to confirm what it speaks.",
      },
    ],
  },
  {
    path: "/api/core/events",
    group: "Core",
    title: "GenerativeA11yEvent",
    description: "Report responses, tools, interactions, approvals, connection changes, and citations with this event union.",
    keywords: ["GenerativeA11yEvent", "response.started", "tool.started", "interaction.requested"],
    sections: [
      { id: "families", title: "Event families", body: ["Events describe actions and changes your app can confirm. They contain serializable data, not rendered components or private framework state."], table: { headers: ["Family", "Events", "Required identity"], rows: [
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
      { id: "common-fields", title: "Common fields", body: ["ID fields connect related events. Labels and messages contain translated text for users."], api: [
        { name: "type", type: "string literal", requirement: "Required", defaultValue: "n/a", description: "Selects one member of the discriminated event union." },
        { name: "eventId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Connects an event to your app's logs without being used as the ID for a response, tool, or interaction." },
        { name: "locale", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Carries the language for user-facing text into intents and DOM delivery." },
        { name: "label / message / announcement", type: "string", requirement: "Event-specific", defaultValue: "undefined", description: "Short, translated text supplied by your app. Do not pass raw arguments, results, or backend errors." },
      ] },
    ],
  },
  {
    path: "/api/core/policy",
    group: "Core",
    title: "Policy and presets",
    description: "Settings for streaming text, tool updates, response status, announcement channels, timing, and queue limits.",
    keywords: ["presets", "resolvePolicy", "PolicyOverrides", "minimumGapMs"],
    sections: [
      { id: "presets", title: "PresetName", body: ["Each preset defines a complete set of default values."], table: { headers: ["Preset", "Streaming", "Status updates"], rows: [["minimal", "Restrained", "Final states"], ["balanced", "Sentence-paced", "Useful status"], ["verbose", "More frequent", "Progress enabled"], ["completion-only", "Final text only", "Minimal"]] } },
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
    description: "Low-level scheduler for timing, duplicate removal, merging, cancellation, queue priority, and repeatable tests.",
    keywords: ["createAnnouncementScheduler", "ScheduleAnnouncement", "capacityPriority", "cancelScope"],
    sections: [
      { id: "signature", title: "Signature and cleanup", body: ["Most apps should use createGenerativeA11y. Use the scheduler directly only if your app already decides which events should produce announcements."], code: { language: "typescript", value: `const scheduler = createAnnouncementScheduler({
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
});` }, walkthrough: [{ label: "Supply a clock", description: "Scheduler timers use your Clock, so tests can control time." }, { label: "Limit the queue", description: "maxQueueSize limits pending output." }, { label: "Set queue priority", description: "Response text can replace a status update when the queue is full." }, { label: "Group related work", description: "Use one scope to cancel pending work when that response or tool ends." }], api: [
        { name: "options", type: "AnnouncementSchedulerOptions", requirement: "Required", defaultValue: "n/a", description: "Clock, pacing, capacity, announcement listener, and optional diagnostic callbacks." },
        { name: "return", type: "AnnouncementScheduler", requirement: "Return", defaultValue: "n/a", description: "Owned scheduler with schedule, cancelScope, pendingCount, and dispose methods." },
      ] },
      { id: "candidate", title: "ScheduleAnnouncement", body: ["A candidate describes prepared user-facing output. It must not contain raw backend data."], api: [
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Requested announcement urgency." },
        { name: "text", type: "string", requirement: "Required", defaultValue: "n/a", description: "Translated text with whitespace normalized by the runtime." },
        { name: "sourceType", type: "GenerativeA11yEvent['type']", requirement: "Required", defaultValue: "n/a", description: "Identifies the app event that produced this candidate." },
        { name: "delayMs", type: "number", requirement: "Optional", defaultValue: "0", description: "Additional eligibility delay measured by the injected clock." },
        { name: "scope", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Key used to cancel pending work for one response, tool, or interaction." },
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
    description: "ManualClock and AnnouncementRecorder APIs for testing runtime behavior without a browser or real-time delays.",
    keywords: ["ManualClock", "createAnnouncementRecorder", "transcript", "testing"],
    sections: [
      { id: "recorder", title: "createAnnouncementRecorder", body: ["createAnnouncementRecorder bundles a runtime, ManualClock, announcement transcript, and diagnostic transcript into one test harness."], code: { language: "typescript", value: `const recorder = createAnnouncementRecorder({
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

expect(recorder.transcript()).toHaveLength(1);` }, walkthrough: [{ label: "Create the test runtime", description: "Your recorder provides a runtime, ManualClock, and captured output." }, { label: "Send app events", description: "Use the same events your app sends in production." }, { label: "Advance the clock", description: "Tests control time instead of waiting for real timers." }], api: [
        { name: "options", type: "Recorder options", requirement: "Optional", defaultValue: "{}", description: "Accepts runtime preset, policy, error handling, and an optional startAt timestamp. Clock and listeners are owned by the recorder." },
        { name: "return", type: "AnnouncementRecorder", requirement: "Return", defaultValue: "n/a", description: "Provides runtime, clock, transcript(), diagnosticTranscript(), and clear()." },
      ] },
      { id: "manual-clock", title: "ManualClock", body: ["ManualClock implements Clock and runs timers in a repeatable order."], api: [
        { name: "new ManualClock(startAt)", type: "ManualClock", requirement: "Constructor", defaultValue: "0", description: "Creates a clock at the supplied timestamp." },
        { name: "now()", type: "number", requirement: "Method", defaultValue: "n/a", description: "Returns the current manual timestamp." },
        { name: "setTimeout(callback, delayMs)", type: "ClockTimer", requirement: "Method", defaultValue: "n/a", description: "Schedules a callback on the manual clock." },
        { name: "clearTimeout(timer)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Cancels a registered timer." },
        { name: "advanceBy(ms)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Advances time and runs due callbacks in a repeatable order." },
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
      { id: "intent", title: "AnnouncementIntent", body: ["An AnnouncementIntent describes an update prepared by core. It does not confirm that the browser delivered it or that a screen reader spoke it."], api: [
        { name: "id", type: "string", requirement: "Required", defaultValue: "n/a", description: "Unique scheduled output identity." },
        { name: "at", type: "number", requirement: "Required", defaultValue: "n/a", description: "Injected clock timestamp at delivery." },
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Requested urgency for the delivery layer." },
        { name: "text", type: "string", requirement: "Required", defaultValue: "n/a", description: "Translated text with normalized whitespace." },
        { name: "sourceType", type: "event type", requirement: "Required", defaultValue: "n/a", description: "Identifies the app event that caused this intent." },
        { name: "responseId / toolId / interactionId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Optional source lifecycle correlation." },
      ] },
      { id: "diagnostic", title: "AnnouncementDiagnostic", body: ["Diagnostics record runtime decisions for tests and telemetry. Listener failures do not change runtime behavior. Repeated queue-limit decisions can share one diagnostic with a count."], table: { headers: ["Disposition", "Typical reasons", "Meaning"], rows: [["queued", "scheduled", "Candidate entered the scheduler"], ["merged", "coalesced", "Pending equivalent work was replaced"], ["suppressed", "duplicate, policy-silent, stale-response", "Policy or identity prevented output"], ["cancelled", "scope-cancelled, runtime-disposed", "Pending work became invalid"], ["announced", "delivered, delivery-error", "Listeners accepted output or every attempt failed"]] }, api: [
        { name: "disposition", type: "DiagnosticDisposition", requirement: "Required", defaultValue: "n/a", description: "High-level outcome category." },
        { name: "reason", type: "DiagnosticReason", requirement: "Required", defaultValue: "n/a", description: "Stable machine-readable explanation for the decision." },
        { name: "count", type: "number", requirement: "Optional", defaultValue: "undefined", description: "Number of equivalent decisions represented by an aggregated diagnostic." },
      ] },
      { id: "runtime-observability", title: "Versioned runtime observability", body: ["subscribeDiagnosticEvents emits each normalized source event before the decisions caused by that dispatch. getDiagnosticSnapshot returns current lifecycle and queue timing without response text, labels, errors, scopes, deduplication keys, or timer handles."], api: [
        { name: "RuntimeDiagnosticEventV1", type: "event-observed | decision", requirement: "Event", defaultValue: "n/a", description: "Schema-versioned ordered diagnostic event with injected time and a monotonic sequence." },
        { name: "RuntimeDiagnosticSnapshotV1", type: "immutable object", requirement: "Snapshot", defaultValue: "n/a", description: "Content-free active response, tool, pending announcement, and response flush state." },
        { name: "pending.announcements", type: "readonly DiagnosticPendingAnnouncement[]", requirement: "Snapshot field", defaultValue: "[]", description: "Stable correlation, channel, source, scheduling, due-time, delay, and queue sequence fields ordered by due time." },
      ], note: "Runtime diagnostics explain library behavior. They do not prove DOM delivery or screen-reader speech." },
    ],
  },
  {
    path: "/api/dom",
    group: "DOM",
    title: "@generative-a11y/dom",
    description: "Browser announcements, runtime connections, safe focus helpers, attention tracking, and validated preference storage.",
    keywords: ["DOM", "ariaNotify", "live region", "focus", "preferences"],
    sections: [
      { id: "install", title: "Install browser delivery", body: ["DOM uses core without depending on React or an AI framework."], code: { language: "shell", value: "npm install @generative-a11y/core @generative-a11y/dom" }, walkthrough: [{ label: "Prepare updates in core", description: "Core prepares announcements without using browser globals." }, { label: "Add updates to the page", description: "DOM uses ariaNotify when available and falls back to hidden live regions." }] },
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
      { id: "result", title: "DOMDeliveryResult", body: ["announce returns one result synchronously."], table: { headers: ["Status", "Method", "Meaning"], rows: [["notified", "aria-notify", "ariaNotify returned without throwing"], ["mutated", "live-region", "Selected stable region text changed"], ["unavailable", "none", "No usable document or region exists"], ["disposed", "none", "announce was called after disposal"]] }, api: [
        { name: "channel", type: "polite | assertive", requirement: "Required", defaultValue: "n/a", description: "Intent channel selected for this attempt." },
        { name: "announcementId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable ID copied from the AnnouncementIntent for diagnostic correlation." },
        { name: "sourceType", type: "GenerativeA11yEvent['type']", requirement: "Required", defaultValue: "n/a", description: "Event type that produced the announcement intent." },
        { name: "at", type: "number", requirement: "Required", defaultValue: "n/a", description: "Injected-clock timestamp copied from the announcement intent." },
        { name: "sourceEventId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Application event ID when the source event supplied one." },
        { name: "responseId / toolId / interactionId", type: "string", requirement: "Optional", defaultValue: "undefined", description: "Entity IDs copied from the announcement intent when present." },
        { name: "error", type: "{ name, message }", requirement: "Optional", defaultValue: "undefined", description: "Serializable ariaNotify failure information when fallback was needed." },
      ], note: "A notified or mutated result confirms that the library updated the browser. Test with a real screen reader to confirm what it speaks." },
    ],
  },
  {
    path: "/api/dom/connect-runtime-to-dom",
    group: "DOM",
    title: "connectRuntimeToDOM",
    description: "Subscribe an existing core runtime to a DOMAnnouncer while preserving separate runtime and browser ownership.",
    keywords: ["connectRuntimeToDOM", "DOMRuntimeBinding", "dispose"],
    sections: [
      { id: "signature", title: "Signature and import", body: ["connectRuntimeToDOM borrows your runtime. Disposing its binding removes only subscription and announcer resources."], code: { language: "typescript", value: `import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({});
const delivery = connectRuntimeToDOM(runtime, { mode: "auto" });

runtime.dispatch(event);

delivery.dispose();
runtime.dispose();` }, walkthrough: [{ label: "Create the runtime", description: "Your app creates and owns the core runtime." }, { label: "Connect browser delivery", description: "Connect the DOM binding before your app sends events." }, { label: "Clean up in order", description: "Dispose the DOM binding before you dispose the runtime." }], api: [
        { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Required", defaultValue: "n/a", description: "Supplies AnnouncementIntent objects while remaining under your app's control." },
        { name: "options", type: "DOMAnnouncerOptions", requirement: "Optional", defaultValue: "{}", description: "Forwarded to the owned DOM announcer." },
        { name: "return", type: "DOMRuntimeBinding", requirement: "Return", defaultValue: "n/a", description: "Provides the announcer and an idempotent dispose function." },
      ] },
      { id: "ownership", title: "DOMRuntimeBinding", body: ["dispose leaves app-supplied runtimes and live regions intact."], api: [
        { name: "announcer", type: "DOMAnnouncer", requirement: "Property", defaultValue: "n/a", description: "Owned announcer used for every runtime intent." },
        { name: "dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Unsubscribes from the runtime and disposes the owned announcer." },
      ] },
    ],
  },
  {
    path: "/api/dom/focus",
    group: "DOM",
    title: "Focus helpers",
    description: "Helpers for capturing, moving, and restoring focus in dialogs and other app interactions.",
    keywords: ["captureFocus", "focusElement", "restoreFocus", "FocusResult"],
    sections: [
      { id: "workflow", title: "Capture and restore application focus", body: ["Call these helpers from dialogs and other interactions that your app controls. Do not move focus for streaming text or routine status updates."], code: { language: "typescript", value: `const capture = captureFocus(document);
const opened = focusElement(dialogHeading, { preventScroll: true });

// After the application-owned interaction closes:
const restored = restoreFocus(capture, {
  onlyIfFocusWithin: dialog,
});` }, walkthrough: [{ label: "Capture current focus", description: "captureFocus records the active element without moving focus." }, { label: "Focus the dialog", description: "Your app chooses the correct element inside the dialog." }, { label: "Restore when appropriate", description: "onlyIfFocusWithin leaves focus alone if the user moved outside the dialog." }], api: [
        { name: "captureFocus(document)", type: "FocusCapture", requirement: "Function", defaultValue: "global document", description: "Captures the deep active element from the supplied document." },
        { name: "focusElement(element, options)", type: "FocusResult", requirement: "Function", defaultValue: "preventScroll: true", description: "Attempts focus and reports focused or a stable skipped reason." },
        { name: "restoreFocus(capture, options)", type: "FocusResult", requirement: "Function", defaultValue: "n/a", description: "Restores only when the captured target remains eligible and optional guards still match." },
      ] },
      { id: "results", title: "FocusResult", body: ["Results are explicit so applications can test focus workflows without guessing."], table: { headers: ["Status", "Meaning", "Application response"], rows: [["focused", "Target became active", "Continue the workflow"], ["skipped", "A documented eligibility check, browser failure, or restoration guard prevented focus", "Preserve current focus and inspect reason"]] } },
    ],
  },
  {
    path: "/api/dom/attention",
    group: "DOM",
    title: "createAttentionStore",
    description: "A store that uses page visibility, window focus, the focused area, and response visibility to estimate where the user is working.",
    keywords: ["createAttentionStore", "AttentionStore", "AttentionSnapshot", "registerComposer"],
    sections: [
      { id: "signature", title: "Create and register app elements", body: ["AttentionStore reads browser focus and visibility. It does not inspect a screen reader's cursor or move focus."], code: { language: "typescript", value: `const attention = createAttentionStore({ document });

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
attention.dispose();` }, walkthrough: [{ label: "Read browser signals", description: "AttentionStore reads document visibility, window focus, element focus, and intersection changes." }, { label: "Register app areas", description: "Register the composer, conversation history, and newest response so the store can identify them." }, { label: "Clean up", description: "Each registration and subscription returns its own cleanup function." }], api: [
        { name: "options", type: "AttentionStoreOptions", requirement: "Optional", defaultValue: "browser document", description: "Injects the document, intersection observer factory, and observer configuration." },
        { name: "return", type: "AttentionStore", requirement: "Return", defaultValue: "n/a", description: "External store with snapshots, registrations, subscriptions, and disposal." },
      ] },
      { id: "snapshot", title: "AttentionSnapshot", body: ["A field stays unknown when the browser cannot provide enough information. AttentionStore never guesses."], table: { headers: ["Field", "Values", "Browser signal"], rows: [["visibility", "visible, hidden, unknown", "Document visibility"], ["windowFocus", "focused, blurred, unknown", "Window focus"], ["focusArea", "composer, conversation, elsewhere, none, unknown", "Deep active element"], ["newestResponse", "visible, outside, unobserved, unknown", "Intersection observer"], ["mode", "foreground, background, reading-history, away, unknown", "Derived from the fields above"]] } },
    ],
  },
  {
    path: "/api/dom/preferences",
    group: "DOM",
    title: "PreferenceStore",
    description: "Validated, versioned external store for user-controlled streaming and tool verbosity with optional persistence.",
    keywords: ["createPreferenceStore", "PreferenceSchemaV1", "preferencesToCoreConfiguration", "storage"],
    sections: [
      { id: "store", title: "createPreferenceStore", body: ["createPreferenceStore validates loaded and assigned values before exposing a stable snapshot."], code: { language: "typescript", value: `const store = createPreferenceStore({
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
});` }, walkthrough: [{ label: "Supply storage", description: "Pass storage when you need persistence, server rendering, or controlled tests." }, { label: "Subscribe to changes", description: "getSnapshot returns validated, versioned preferences." }, { label: "Map preferences to core", description: "preferencesToCoreConfiguration converts selected verbosity into a core preset and policy override." }], api: [
        { name: "defaultValue", type: "PreferenceSchemaV1", requirement: "Optional", defaultValue: "defaultPreferences", description: "Validated snapshot used when persistence is missing or invalid." },
        { name: "persistence.key", type: "string", requirement: "Optional", defaultValue: "library key", description: "Storage key for the serialized versioned schema." },
        { name: "persistence.storage", type: "PreferenceStorage", requirement: "Optional", defaultValue: "localStorage when available", description: "Injected getItem and setItem surface." },
        { name: "persistence.events", type: "PreferenceStorageEventSource", requirement: "Optional", defaultValue: "storage events when available", description: "Synchronizes validated changes from other documents." },
        { name: "onDiagnostic", type: "callback", requirement: "Optional", defaultValue: "undefined", description: "Observes invalid, unavailable, read, write, and event-source outcomes." },
      ] },
      { id: "schema", title: "PreferenceSchemaV1 and helpers", body: ["A version field makes persistence migrations explicit."], api: [
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
    description: "A React provider and hooks for browser updates, attention, preferences, and refs for your existing interface.",
    keywords: ["React", "GenerativeA11yProvider", "hooks", "bindings"],
    sections: [
      { id: "provider", title: "GenerativeA11yProvider", body: ["GenerativeA11yProvider can own a runtime or borrow one from your app. It renders stable hidden delivery regions and leaves visible UI unchanged."], code: { language: "tsx", value: `import { GenerativeA11yProvider } from "@generative-a11y/react";

export function App() {
  return (
    <GenerativeA11yProvider
      preset="balanced"
      dom={{ mode: "auto" }}
    >
      <ExistingChat />
    </GenerativeA11yProvider>
  );
}` }, walkthrough: [{ label: "Mount one provider", description: "Wrap the part of your app that sends accessibility events." }, { label: "Configure browser delivery", description: "dom controls hidden screen-reader updates without replacing visible components." }, { label: "Keep app behavior in the app", description: "ExistingChat still owns its HTML, keyboard behavior, and focus." }], api: [
        { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Optional", defaultValue: "owned runtime", description: "Borrows an existing runtime when provided. GenerativeA11yProvider never disposes app-supplied runtimes." },
        { name: "dom", type: "false | GenerativeA11yDOMOptions", requirement: "Optional", defaultValue: "{}", description: "Configures hidden DOM delivery or disables it." },
        { name: "attention", type: "false | AttentionStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures the provider's attention store or disables browser signal collection." },
        { name: "attentionStore", type: "AttentionStore", requirement: "Optional", defaultValue: "owned store", description: "Borrows an application-supplied attention store." },
        { name: "preferences", type: "PreferenceStoreOptions", requirement: "Optional", defaultValue: "{}", description: "Configures an owned preference store." },
        { name: "preferenceStore", type: "PreferenceStore", requirement: "Optional", defaultValue: "owned store", description: "Borrows an application-supplied preference store." },
      ] },
      { id: "ownership", title: "Provider ownership", body: ["GenerativeA11yProvider cleans up every runtime, browser connection, store, timer, subscription, and live region it creates. Anything supplied by your app remains under your control."], bullets: ["Provider context is unavailable outside the provider.", "Server rendering uses stable hidden structure and reports attention as unknown.", "Routine announcements never move focus.", "Preference changes update the runtime without replacing your components."] },
    ],
  },
  {
    path: "/api/react/hooks",
    group: "React",
    title: "React hooks",
    description: "React hooks for the runtime, attention, preferences, and refs for existing app elements.",
    keywords: ["useGenerativeA11y", "useGenerativeA11yRuntime", "useGenerativeA11yBindings", "hooks"],
    sections: [
      { id: "complete-example", title: "Bind an existing chat interface", body: ["Bindings contain refs only. Add them to semantic elements already in your app."], code: { language: "tsx", value: `function ExistingChat() {
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
}` }, walkthrough: [{ label: "Read the app runtime", description: "Send only events that your app knows happened." }, { label: "Register existing elements", description: "Ref bindings track focus and visibility without changing markup or styles." }, { label: "Expose user control", description: "Preference updates remain validated and versioned." }], api: [
        { name: "useGenerativeA11y()", type: "GenerativeA11yContextValue", requirement: "Hook", defaultValue: "n/a", description: "Returns runtime, attentionStore, and preferenceStore from the nearest provider." },
        { name: "useGenerativeA11yRuntime()", type: "GenerativeA11yRuntime", requirement: "Hook", defaultValue: "n/a", description: "Returns the provider runtime." },
        { name: "useGenerativeA11yAttention()", type: "AttentionSnapshot", requirement: "Hook", defaultValue: "unknown SSR snapshot", description: "Uses useSyncExternalStore to report browser focus and visibility without guessing missing values." },
        { name: "useGenerativeA11yPreferences()", type: "GenerativeA11yPreferencesResult", requirement: "Hook", defaultValue: "n/a", description: "Returns validated preferences, setPreferences, and the underlying store." },
        { name: "useGenerativeA11yBindings()", type: "GenerativeA11yBindings", requirement: "Hook", defaultValue: "n/a", description: "Returns stable composer, conversation, and newest-response ref props." },
      ] },
      { id: "binding-contracts", title: "GenerativeA11yBindings", body: ["Each property contains a React ref for an existing part of your interface."], table: { headers: ["Property", "Target", "Purpose"], rows: [["composerProps", "HTMLTextAreaElement", "Detects focus in the composer"], ["conversationProps", "HTMLElement", "Detects focus in conversation history"], ["newestResponseProps", "HTMLElement", "Checks whether the newest response is visible"]] } },
    ],
  },
  {
    path: "/api/ai-sdk",
    group: "AI SDK",
    title: "@generative-a11y/ai-sdk",
    description: "Turn documented AI SDK useChat state and callbacks into generative-a11y events.",
    keywords: ["AI SDK", "createObserver", "composeChatCallbacks", "useChat"],
    sections: [
      { id: "surface", title: "Public APIs used", body: ["AI SDK adapters read documented messages, status, and error state. onFinish and onError report final response state."], table: { headers: ["Surface", "Exports", "Use"], rows: [["Framework-neutral", "createObserver, composeChatCallbacks", "Custom subscription or state bridge"], ["React", "useChatAccessibility, useObserveChatAccessibility", "AI SDK useChat components"], ["Metadata", "CHAT_ADAPTER_METADATA", "Supported events and framework APIs"]] } },
      { id: "ownership", title: "Runtime and app ownership", body: ["Your app owns the core runtime. Adapters report events without running chat actions or reading rendered messages and private AI SDK fields."], bullets: ["scopeId separates response and message IDs across chat instances.", "Tool arguments do not mean that execution started.", "Your onFinish and onError callbacks remain intact.", "Disposing the observer clears only records created by the adapter."] },
    ],
  },
  {
    path: "/api/ai-sdk/use-chat-accessibility",
    group: "AI SDK",
    title: "useChatAccessibility",
    description: "Create the AI SDK observer and completion callbacks before calling useChat in the same React component.",
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
});` }, walkthrough: [{ label: "Create callbacks first", description: "useChatAccessibility creates one observer and callback pair for each runtime and scope." }, { label: "Pass callbacks to useChat", description: "Completion and error details reach the adapter and your existing callbacks." }, { label: "Observe public state", description: "useObserveChatAccessibility reads messages, status, and error after useChat returns." }, { label: "Let the hook clean up", description: "Unmounting disposes the observer and supports React Strict Mode remounts." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Receives adapter events while remaining under your app's control." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for messages, tools, approvals, and citations." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds adapter identity memory and suppresses new identity after saturation." },
        { name: "getToolLabel", type: "(context) => string", requirement: "Optional", defaultValue: '"A tool"', description: "Maps public tool context to short localized copy without exposing arguments." },
        { name: "onFinish / onError", type: "AI SDK callbacks", requirement: "Optional", defaultValue: "undefined", description: "Your existing callbacks. chatCallbacks calls them after the adapter records the result." },
        { name: "return", type: "ChatIntegration", requirement: "Return", defaultValue: "n/a", description: "Observer plus onFinish and onError callbacks for useChat." },
      ] },
      { id: "observe", title: "useObserveChatAccessibility", body: ["useObserveChatAccessibility reads your ChatIntegration without disposing it."], api: [
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
    description: "Turn public assistant-ui ThreadRuntime state into response, tool, approval, and source events.",
    keywords: ["assistant-ui", "ThreadRuntime", "THREAD_ADAPTER_METADATA"],
    sections: [
      { id: "exports", title: "Public exports", body: ["assistant-ui integration uses only getState and subscribe from your ThreadRuntime."], table: { headers: ["Export", "Kind", "Purpose"], rows: [["bindThreadRuntime", "Function", "Create one adapter subscription"], ["THREAD_ADAPTER_METADATA", "Frozen constant", "List supported events and methods"], ["BindThreadRuntimeOptions", "Interface", "Options for the binding"], ["ThreadBinding", "Interface", "Cleanup method for the binding"]] } },
      { id: "fidelity", title: "Events the adapter can report", body: ["Public thread state can report interruptions but not general retries or connection changes. Tool failures and sources depend on content parts from assistant-ui."], note: "Missing events are never guessed from rendered text, timing, or private runtime fields." },
    ],
  },
  {
    path: "/api/assistant-ui/bind-thread-runtime",
    group: "assistant-ui",
    title: "bindThreadRuntime",
    description: "Connect one assistant-ui ThreadRuntime and send its public events to a core runtime supplied by your app.",
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
binding.dispose();` }, walkthrough: [{ label: "Use the app runtime", description: "ThreadBinding sends events to core without disposing your runtime." }, { label: "Separate thread IDs", description: "scopeId prevents ID collisions across mounted conversations." }, { label: "Read public thread state", description: "ThreadBinding needs only getState and subscribe from ThreadRuntime." }, { label: "Dispose the binding", description: "dispose removes the subscription without changing the thread runtime." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Receives adapter events while remaining under your app's control." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for message, tool, approval, and citation identity." },
        { name: "thread", type: "ThreadRuntimeSource", requirement: "Required", defaultValue: "n/a", description: "Borrowed getState and subscribe surface from assistant-ui." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds message, part, tool, and approval identity tracking." },
        { name: "return", type: "ThreadBinding", requirement: "Return", defaultValue: "n/a", description: "An idempotent dispose method for the adapter subscription." },
      ] },
      { id: "translation", title: "Events reported from thread state", body: ["Each public thread snapshot is compared with its previous value, and confirmed changes become events."], table: { headers: ["assistant-ui state", "generative-a11y event", "Source"], rows: [["Assistant message starts running", "response.started", "Public message state"], ["Text grows", "response.text.delta", "New text only"], ["Message finishes, stops, or fails", "completed, interrupted, failed", "Public message status"], ["Tool call and result parts", "tool lifecycle", "Public content parts"], ["Approval state", "approval requested or resolved", "Public content parts"], ["Source parts", "citation.available", "Optional content parts"]] } },
    ],
  },
  {
    path: "/api/ag-ui",
    group: "AG-UI",
    title: "@generative-a11y/ag-ui",
    description: "Turn documented AG-UI AgentSubscriber callbacks into response, tool, and interaction events.",
    keywords: ["AG-UI", "AgentSubscriber", "AGENT_ADAPTER_METADATA"],
    sections: [
      { id: "exports", title: "Public exports", body: ["AG-UI integration subscribes through agent.subscribe(AgentSubscriber)."], table: { headers: ["Export", "Kind", "Purpose"], rows: [["bindAgent", "Function", "Create one protocol subscription"], ["AGENT_ADAPTER_METADATA", "Frozen constant", "List supported events and limits"], ["BindAgentOptions", "Interface", "Options for the binding"], ["AgentBinding", "Interface", "Cleanup method for the binding"]] } },
      { id: "fidelity", title: "Events the adapter can report", body: ["Protocol events report interruptions. AG-UI does not provide general retry or connection events. Interrupt callbacks report requests for user input."], note: "AG-UI integration never uses private observables or guesses events missing from the protocol." },
    ],
  },
  {
    path: "/api/ag-ui/bind-agent",
    group: "AG-UI",
    title: "bindAgent",
    description: "Connect one AG-UI agent through its public callbacks and send those events to a core runtime supplied by your app.",
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
binding.dispose();` }, walkthrough: [{ label: "Connect the agent", description: "AgentBinding subscribes to documented callbacks without running your agent." }, { label: "Separate agent IDs", description: "scopeId prevents message, tool, and interrupt IDs from colliding across agents." }, { label: "Limit stored IDs", description: "After reaching its limit, the adapter ignores new IDs instead of removing active records." }, { label: "Dispose the subscription", description: "Your app still owns the runtime and agent after the binding is disposed." }], api: [
        { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "n/a", description: "Receives adapter events while remaining under your app's control." },
        { name: "scopeId", type: "string", requirement: "Required", defaultValue: "n/a", description: "Stable non-empty namespace for AG-UI message, tool, and interrupt IDs." },
        { name: "agent", type: "AgentSource", requirement: "Required", defaultValue: "n/a", description: "Borrowed object exposing documented subscribe behavior." },
        { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Positive safe integer bounding tracked responses, tools, and interactions." },
        { name: "return", type: "AgentBinding", requirement: "Return", defaultValue: "n/a", description: "An idempotent dispose method for the protocol subscription." },
      ] },
      { id: "translation", title: "How AgentSubscriber callbacks map to events", body: ["AG-UI integration reads public callbacks instead of rendered UI."], table: { headers: ["AG-UI callback family", "generative-a11y event", "Notes"], rows: [["Text message start, content, end", "response lifecycle", "Each update contains only new text"], ["Tool call start, args, result, end", "tool lifecycle", "Arguments alone do not mean execution started"], ["Run error or interruption", "response.failed or interrupted", "Uses short, translated text that is safe to share"], ["Interrupt and resume", "interaction requested or resolved", "Reports when the app needs user input"], ["Run initialized", "interaction resolution", "Matches known active interrupt IDs"]] } },
    ],
  },
  {
    path: "/api/devtools",
    group: "Devtools",
    title: "@generative-a11y/devtools",
    description: "Create a bounded redacted diagnostic store and an explicit browser Accessibility Trace Explorer for development.",
    keywords: ["createDevtoolsStore", "mountDevtoolsOverlay", "DevtoolsStore", "trace explorer"],
    related: ["/docs/devtools", "/api/core/diagnostics", "/api/dom/create-dom-announcer"],
    sections: [
      {
        id: "store",
        title: "createDevtoolsStore",
        body: ["The headless store is framework-neutral and has no browser side effects on import. It subscribes to public runtime diagnostics and owns only its bounded captured history."],
        code: { language: "typescript", value: `import { createDevtoolsStore } from "@generative-a11y/devtools";

const store = createDevtoolsStore({ maxEntries: 250 });
const detach = store.attachRuntime({ id: "support", runtime });
const snapshot = store.getSnapshot();
const trace = store.exportTrace();

detach();
store.dispose();` },
        walkthrough: [
          { label: "Bound retained records", description: "maxEntries defaults to 250 and must be a positive safe integer." },
          { label: "Attach public diagnostics", description: "attachRuntime borrows subscribeDiagnosticEvents and getDiagnosticSnapshot from core." },
          { label: "Read or export", description: "Snapshots and V1 trace exports are immutable and content-free." },
          { label: "Release capture", description: "Detach the borrowed runtime before disposing the store." },
        ],
        api: [
          { name: "createDevtoolsStore(options)", type: "DevtoolsStore", requirement: "Function", defaultValue: "maxEntries: 250", description: "Creates an isolated store with bounded records and no attached runtimes." },
          { name: "attachRuntime({ id, runtime, source? })", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Attaches public core diagnostics under a stable ID and returns idempotent detach." },
          { name: "source", type: "DevtoolsRuntimeSource", requirement: "Optional attach option", defaultValue: "undefined", description: "Records the adapter name, documented public evidence, and declared fidelity supplied by the integration." },
          { name: "recordDelivery(input)", type: "void", requirement: "Method", defaultValue: "n/a", description: "Adds validated content-free DOM delivery evidence correlated by safe IDs." },
          { name: "exportTrace()", type: "DevtoolsTraceExportV1", requirement: "Method", defaultValue: "n/a", description: "Refreshes runtime snapshots and exports the schema-versioned redacted trace." },
        ],
      },
      {
        id: "capture-controls",
        title: "Capture controls and ownership",
        body: ["pauseCapture and resumeCapture affect devtools capture only. They do not pause runtime scheduling or browser delivery. clear removes records without detaching runtimes; dispose detaches runtimes and removes subscribers."],
        api: [
          { name: "getSnapshot()", type: "DevtoolsSnapshot", requirement: "Method", defaultValue: "n/a", description: "Returns a cached immutable view until captured state changes." },
          { name: "subscribe(listener)", type: "() => void", requirement: "Method", defaultValue: "n/a", description: "Observes store changes with an idempotent unsubscribe function." },
          { name: "pauseCapture() / resumeCapture()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Controls diagnostic retention without changing the observed runtimes." },
          { name: "refreshSnapshots()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Requests fresh content-free snapshots from attached runtimes without changing their state." },
          { name: "clear() / dispose()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Clears captured state or releases all store-owned resources." },
        ],
      },
      {
        id: "trace-contracts",
        title: "Snapshot and trace contracts",
        body: ["Devtools snapshots and V1 exports contain redacted records, runtime snapshots, and declared adapter sources. The bounded record list reports how much older data it dropped."],
        api: [
          { name: "droppedCount", type: "number", requirement: "Snapshot and export", defaultValue: "0", description: "Counts records removed from the ring buffer since the last clear." },
          { name: "runtimeSourceId", type: "string", requirement: "Optional record field", defaultValue: "undefined", description: "Connects a record to an immutable adapter evidence revision without copying that metadata into each record." },
          { name: "records", type: "readonly DevtoolsRecord[]", requirement: "Snapshot and export", defaultValue: "[]", description: "Contains redacted events, decisions, and optional DOM delivery results in capture order." },
          { name: "runtimeSnapshots", type: "Readonly<Record<string, RuntimeDiagnosticSnapshotV1>>", requirement: "Snapshot and export", defaultValue: "{}", description: "Stores the latest content-free core snapshot for each attached runtime." },
          { name: "runtimeSources", type: "Readonly<Record<string, DevtoolsRuntimeSource>>", requirement: "Snapshot and export", defaultValue: "{}", description: "Stores immutable adapter evidence revisions still referenced by retained records." },
        ],
      },
      {
        id: "overlay",
        title: "mountDevtoolsOverlay",
        body: ["Import the browser helper from @generative-a11y/devtools/overlay. It mounts one Shadow DOM host after an explicit call, starts collapsed, and restores prior focus when closed."],
        code: { language: "typescript", value: `import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const overlay = mountDevtoolsOverlay({ store });
overlay.dispose();` },
        walkthrough: [
          { label: "Pass the store", description: "The overlay reads the store you created and does not attach a runtime itself." },
          { label: "Mount explicitly", description: "Importing the package does not create browser UI or global shortcuts." },
          { label: "Dispose the host", description: "dispose unmounts the workbench and removes the custom element." },
        ],
        api: [
          { name: "store", type: "DevtoolsStore", requirement: "Required", defaultValue: "n/a", description: "Supplies the captured records and control methods displayed by the overlay." },
          { name: "document", type: "Document", requirement: "Optional", defaultValue: "global document", description: "Selects the document that receives the Shadow DOM host." },
          { name: "copyText", type: "(value) => void | Promise<void>", requirement: "Optional", defaultValue: "Clipboard API", description: "Overrides trace copying for hosts that provide their own clipboard bridge." },
          { name: "host", type: "HTMLElement", requirement: "Return field", defaultValue: "n/a", description: "Exposes the mounted custom element for inspection or host-controlled placement." },
          { name: "dispose()", type: "void", requirement: "Return method", defaultValue: "n/a", description: "Unmounts the workbench and removes its host. Repeated calls are safe." },
        ],
        note: "Captured runtime and browser evidence does not prove that assistive technology spoke an announcement.",
      },
    ],
  },
  {
    path: "/api/test",
    group: "Testing",
    title: "@generative-a11y/test",
    description: "Record normalized lifecycle events, replay versioned fixtures with a ManualClock, and install semantic Vitest assertions.",
    keywords: ["recordRuntime", "replayEvents", "ReplayFixtureV1", "installVitestMatchers"],
    related: ["/docs/testing/replay", "/api/core/testing", "/docs/testing"],
    sections: [
      {
        id: "record-replay",
        title: "recordRuntime and replayEvents",
        body: ["Recording captures accepted events sent through the returned dispatch target. Replay validates the full fixture before dispatching any event and advances the supplied ManualClock in recorded order."],
        code: { language: "typescript", value: `import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
import { recordRuntime, replayEvents } from "@generative-a11y/test";

const clock = new ManualClock(0);
const runtime = createGenerativeA11y({ clock });
const recording = recordRuntime({ runtime, clock });
recording.runtime.dispatch({
  type: "response.started",
  responseId: "report",
});
const fixture = recording.fixture();

const replayClock = new ManualClock(fixture.startAt);
const replayRuntime = createGenerativeA11y({ clock: replayClock });
replayEvents(replayRuntime, replayClock, fixture);

runtime.dispose();
replayRuntime.dispose();` },
        walkthrough: [
          { label: "Record through the wrapper", description: "Only calls made through recording.runtime become fixture entries." },
          { label: "Freeze a V1 fixture", description: "fixture stores relative non-negative times and preserves array order for ties." },
          { label: "Replay under injected time", description: "replayEvents advances ManualClock before each dispatch and does not run until idle." },
        ],
        api: [
          { name: "recordRuntime({ runtime, clock })", type: "RuntimeRecording", requirement: "Function", defaultValue: "n/a", description: "Returns a dispatch target plus immutable events, fixture, and clear methods." },
          { name: "RuntimeRecording.events()", type: "readonly RecordedEvent[]", requirement: "Method", defaultValue: "[]", description: "Returns frozen copies of accepted normalized events with relative timestamps." },
          { name: "RuntimeRecording.fixture()", type: "ReplayFixtureV1", requirement: "Method", defaultValue: "n/a", description: "Builds a validated frozen fixture from the current recording." },
          { name: "RuntimeRecording.clear()", type: "void", requirement: "Method", defaultValue: "n/a", description: "Removes recorded events without changing the target runtime or clock." },
          { name: "ReplayFixtureV1", type: "{ format, version, startAt, events }", requirement: "Type", defaultValue: "n/a", description: "Defines the versioned JSON envelope and ordered recorded events used by replay." },
          { name: "createReplayFixture(events, options?)", type: "ReplayFixtureV1", requirement: "Function", defaultValue: "startAt: 0", description: "Validates and freezes a versioned local replay fixture." },
          { name: "replayEvents(runtime, clock, fixture)", type: "void", requirement: "Function", defaultValue: "n/a", description: "Validates the fixture, advances ManualClock, and dispatches each copied event." },
          { name: "matchesPartial(actual, expected)", type: "boolean", requirement: "Function", defaultValue: "n/a", description: "Compares expected top-level semantic fields with an announcement or diagnostic object." },
        ],
      },
      {
        id: "vitest",
        title: "Opt-in Vitest matchers",
        body: ["Import @generative-a11y/test/vitest only in Vitest setup. The root package entry has no Vitest runtime import."],
        code: { language: "typescript", value: `import { expect } from "vitest";
import { installVitestMatchers } from "@generative-a11y/test/vitest";

installVitestMatchers(expect);
expect(recorder).toHaveAnnounced({
  sourceType: "response.completed",
});` },
        walkthrough: [
          { label: "Install once", description: "Register matchers in the Vitest setup file used by the test project." },
          { label: "Assert semantic fields", description: "Partial expectations keep tests focused on the contract under review." },
        ],
        api: [
          { name: "toHaveAnnouncementTranscript(expected)", type: "matcher", requirement: "Vitest", defaultValue: "n/a", description: "Checks ordered announcement output with partial semantic fields." },
          { name: "toHaveAnnounced(expected)", type: "matcher", requirement: "Vitest", defaultValue: "n/a", description: "Checks that at least one announcement matches the expected fields." },
          { name: "toHaveDiagnostic(expected)", type: "matcher", requirement: "Vitest", defaultValue: "n/a", description: "Checks that at least one runtime diagnostic matches the expected fields." },
        ],
      },
      {
        id: "limits",
        title: "Validation and evidence limits",
        body: ["Replay rejects unsupported formats, versions, event types, backward times, and response or tool events without required IDs before dispatch. A passing transcript confirms deterministic core output. It does not prove browser delivery or screen-reader speech."],
      },
    ],
  },
];

export const API_PAGES: readonly DocPage[] = Object.freeze(pages);
