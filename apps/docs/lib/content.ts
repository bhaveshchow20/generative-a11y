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
  readonly related?: readonly string[];
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

const devtoolsExample = `import { createDevtoolsStore } from "@generative-a11y/devtools";
import { mountDevtoolsOverlay } from "@generative-a11y/devtools/overlay";

const store = createDevtoolsStore({ maxEntries: 250 });
const detach = store.attachRuntime({ id: "support", runtime });
const overlay = mountDevtoolsOverlay({ store });

// Dispose in reverse ownership order.
overlay.dispose();
detach();
store.dispose();`;

const replayExample = `import { ManualClock, createGenerativeA11y } from "@generative-a11y/core";
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
replayClock.runUntilIdle();

runtime.dispose();
replayRuntime.dispose();`;

const pages: DocPage[] = [
  {
    path: "/docs/getting-started",
    group: "Getting started",
    title: "Getting started",
    description:
      "Install the core and DOM packages, connect one runtime, and tell it when responses and tools change.",
    keywords: ["install", "quick start", "framework neutral", "TypeScript"],
    sections: [
      {
        id: "install",
        title: "Install the core and browser packages",
        body: [
          "Core decides what to announce and when. DOM adds those announcements to the page. Add a framework adapter only when your app needs one.",
        ],
        code: {
          language: "shell",
          value: "npm install @generative-a11y/core @generative-a11y/dom",
        },
        walkthrough: [
          { label: "Add the core runtime", description: "@generative-a11y/core turns app events into useful screen-reader updates and controls their timing." },
          { label: "Add browser delivery", description: "@generative-a11y/dom adds those updates to the page without changing the visible interface." },
        ],
      },
      {
        id: "minimal-integration",
        title: "Minimal integration",
        body: [
          "Create one runtime and connect it to the browser. Send only the new text from each streaming update. Report when the response finishes, fails, or stops. Dispose both resources when the session ends.",
        ],
        code: { language: "typescript", value: quickStart },
        walkthrough: [
          { label: "Create one runtime", description: "Your runtime tracks responses, prepares useful text, and controls update timing." },
          { label: "Connect the browser", description: "connectRuntimeToDOM creates and manages the hidden live regions used for screen-reader updates." },
          { label: "Report app events", description: "Tell the runtime when a response starts, receives text, and finishes." },
          { label: "Clean up", description: "Dispose the browser connection first, then dispose the runtime when the session ends." },
        ],
        note: "generative-a11y can confirm when it adds an announcement to the page. Test with real screen readers to confirm what people hear.",
      },
      {
        id: "choose-an-integration",
        title: "Choose the package that matches your app",
        body: [
          "Use a framework adapter when your app already uses that framework. For a custom app, send events directly to the core runtime.",
        ],
        table: {
          headers: ["Application", "Package", "What it reports"],
          rows: [
            ["Framework-neutral", "@generative-a11y/core + /dom", "All standard library events"],
            ["React", "@generative-a11y/react", "Provider, delivery, attention, preferences"],
            ["AI SDK useChat", "@generative-a11y/ai-sdk/react", "Streaming, terminals, tools, approvals, citations"],
            ["assistant-ui", "@generative-a11y/assistant-ui", "Messages, tools, approvals, sources"],
            ["AG-UI / CopilotKit v2", "@generative-a11y/ag-ui", "Protocol text, tools, interrupts"],
            ["Development diagnostics", "@generative-a11y/devtools", "Redacted runtime and DOM delivery traces"],
            ["Deterministic tests", "@generative-a11y/test", "Event recording, replay, and semantic assertions"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/why-generative-a11y",
    group: "Concepts",
    title: "Why generative AI needs an accessibility runtime",
    description:
      "Learn why streaming responses, tool calls, approvals, retries, and failures need more than ordinary chat accessibility patterns.",
    keywords: [
      "AI accessibility",
      "generative AI accessibility",
      "accessible AI interfaces",
      "AI accessibility library",
    ],
    related: [
      "/docs/architecture",
      "/docs/screen-readers-and-streaming-ai",
      "/docs/integrations",
    ],
    sections: [
      {
        id: "the-gap",
        title: "AI interfaces change after the user acts",
        body: [
          "A conventional form usually has a short, predictable transition: submit, validate, and show a result. An AI interface can stream a response for many seconds, start tools, pause for approval, reconnect, retry, and finish long after focus has moved elsewhere.",
          "Semantic HTML, keyboard access, visible status, and sensible focus remain required. They do not by themselves decide which asynchronous changes deserve an announcement, how repeated changes should be grouped, or when lower-priority updates should wait.",
        ],
      },
      {
        id: "failure-modes",
        title: "Naive announcements create new barriers",
        body: [
          "Putting a changing transcript in an ARIA live region can announce partial tokens, repeat the growing response, interrupt more important information, or leave stale work queued after a retry. Moving focus for routine streaming and status changes is more disruptive because it changes the user's reading position.",
        ],
        bullets: [
          "Partial words and token-sized updates are difficult to understand.",
          "Re-announcing the full accumulated response repeats content.",
          "Tool progress can overwhelm the response the user asked for.",
          "Approval and failure states can arrive behind low-priority updates.",
          "Retries can make announcements from an obsolete response misleading.",
        ],
      },
      {
        id: "runtime-role",
        title: "Put policy between lifecycle state and browser delivery",
        body: [
          "generative-a11y accepts confirmed lifecycle events from the application or a thin framework adapter. Core segments response text, prioritizes important states, removes duplicates, coalesces updates, bounds queued work, and produces announcement intents. The DOM package then performs browser delivery without altering the visible interface.",
          "This boundary keeps framework state, accessibility policy, and DOM behavior independently testable. It also makes fidelity explicit: when an adapter cannot observe a retry or connection event through a documented public API, it reports that limitation instead of guessing.",
        ],
        note: "Deterministic runtime transcripts and DOM tests show what the library prepared or added to the page. They do not prove what a particular screen reader spoke.",
      },
      {
        id: "start",
        title: "Choose the smallest supported integration",
        body: [
          "Start with the framework-neutral core and DOM packages when your application already owns lifecycle state. Use the React layer for provider and element bindings. Add the AI SDK, assistant-ui, or AG-UI adapter only when the application uses that framework's documented public lifecycle surface.",
        ],
        table: {
          headers: ["Need", "Read next"],
          rows: [
            ["Install a custom integration", "Getting started"],
            ["Understand streaming announcements", "Screen readers and streaming AI"],
            ["Choose a framework adapter", "Choose an integration"],
            ["Test browser and assistive-technology behavior", "Testing"],
          ],
        },
      },
    ],
  },
  {
    path: "/docs/screen-readers-and-streaming-ai",
    group: "Concepts",
    title: "Accessible streaming AI for screen readers",
    description:
      "Make streaming AI responses understandable to screen-reader users by announcing meaningful text segments instead of tokens or repeated transcripts.",
    keywords: [
      "accessible streaming AI",
      "screen reader streaming text",
      "streaming chat accessibility",
      "screen reader AI responses",
    ],
    related: [
      "/docs/aria-live-and-generative-ai",
      "/docs/integrations/ai-sdk",
      "/docs/lifecycle/streaming",
    ],
    sections: [
      {
        id: "problem",
        title: "A visual stream and an audible stream need different pacing",
        body: [
          "A sighted reader can ignore the cursor and scan completed text at their own speed. A screen-reader user may receive every live-region mutation in sequence. Token-by-token changes can split words, repeat phrases, and keep the announcement channel busy after the useful information has arrived.",
          "The visible response should still update normally. The accessible announcement stream is a separate representation of the same confirmed lifecycle, optimized for useful listening rather than visual immediacy.",
        ],
      },
      {
        id: "naive-example",
        title: "Avoid announcing the growing transcript",
        body: [
          "This pattern makes the live region contain the entire accumulated response after every token. Depending on the browser and assistive technology, users may hear fragments, repeated content, or inconsistent results.",
        ],
        code: {
          language: "tsx",
          value: `function StreamingMessage({ text }: { text: string }) {
  return <div aria-live="polite">{text}</div>;
}`,
        },
        walkthrough: [
          {
            label: "Every render mutates the live region",
            description: "The full response changes whenever another token arrives.",
          },
          {
            label: "The browser receives no lifecycle boundary",
            description: "The region cannot tell whether text is partial, complete, retried, or obsolete.",
          },
        ],
      },
      {
        id: "runtime-example",
        title: "Send append-only deltas and an explicit terminal event",
        body: [
          "Dispatch response.started once, send only newly arrived text in response.text.delta, and finish with the terminal event the application actually observed. Core buffers partial text and emits meaningful segments according to the selected policy.",
        ],
        code: {
          language: "typescript",
          value: `runtime.dispatch({ type: "response.started", responseId: "r1" });
runtime.dispatch({
  type: "response.text.delta",
  responseId: "r1",
  delta: "The migration completed successfully. ",
});
runtime.dispatch({ type: "response.completed", responseId: "r1" });`,
        },
        walkthrough: [
          {
            label: "Start a response instance",
            description: "The runtime can separate this stream from earlier or retried work.",
          },
          {
            label: "Send new text only",
            description: "Append-only deltas prevent the application from re-submitting the accumulated transcript.",
          },
          {
            label: "Close the lifecycle explicitly",
            description: "Completion flushes useful buffered text; failure or interruption discards text that should no longer be announced.",
          },
        ],
      },
      {
        id: "expected-behavior",
        title: "Expected behavior and test boundaries",
        body: [
          "With the balanced policy, complete phrases can be announced without waiting for every token or repeating earlier text. Higher-priority failures and approval requests can take precedence over routine progress. Ordinary streaming never moves focus.",
          "Use deterministic tests to verify events, announcement intents, queue bounds, and DOM delivery. Then test the integrated application with representative browser and screen-reader combinations because spoken output is controlled by software outside the library.",
        ],
      },
    ],
  },
  {
    path: "/docs/aria-live-and-generative-ai",
    group: "Concepts",
    title: "ARIA live regions for generative AI",
    description:
      "Understand what ARIA live regions provide, why streaming tokens are a poor announcement unit, and how generative-a11y separates policy from delivery.",
    keywords: [
      "ARIA live region AI",
      "aria-live AI chat",
      "live region streaming text",
      "accessible chatbot screen reader",
    ],
    related: [
      "/docs/screen-readers-and-streaming-ai",
      "/api/dom/create-dom-announcer",
      "/docs/testing",
    ],
    sections: [
      {
        id: "what-live-regions-do",
        title: "Live regions expose changes without moving focus",
        body: [
          "An ARIA live region lets a browser expose text changes to assistive technology while keyboard focus stays where the user placed it. Polite updates generally wait for a suitable pause; assertive updates are reserved for information that warrants interruption.",
          "A live region is a delivery mechanism, not an announcement policy. It does not know whether a token is meaningful, whether a repeated update is obsolete, or whether a tool failure should outrank routine progress.",
        ],
      },
      {
        id: "streaming-risk",
        title: "Do not use each token as a live-region update",
        body: [
          "Generative output changes far more frequently than ordinary status text. Sending every token can create partial-word announcements and a backlog of low-value mutations. Replacing the live region with the entire accumulated response can instead repeat content or produce inconsistent results across browser and screen-reader combinations.",
        ],
        bullets: [
          "Keep the visible transcript semantic and readable independently of announcements.",
          "Choose meaningful phrases or sentences as announcement units.",
          "Use assertive delivery sparingly for confirmed urgent states.",
          "Cancel queued work when a response fails, stops, retries, or the runtime is disposed.",
        ],
      },
      {
        id: "library-approach",
        title: "generative-a11y separates scheduling from live-region delivery",
        body: [
          "The core package turns lifecycle events into polite or assertive announcement intents after segmentation, prioritization, deduplication, and scheduling. The DOM package owns stable polite and assertive regions, replaces their text for live-region delivery, and can use the emerging ariaNotify API when the browser exposes it in the configured mode.",
          "The application still owns its visible messages, controls, headings, forms, error relationships, keyboard interactions, and focus behavior. The library's live regions are not a substitute for those fundamentals.",
        ],
        note: "Browser delivery confirms a DOM action, not audible output. Validate the complete experience with real assistive technology.",
      },
      {
        id: "when-to-use",
        title: "Use ordinary semantics for stable content",
        body: [
          "Do not announce information merely because it rendered. Stable assistant messages should remain ordinary document content that users can navigate. Use lifecycle announcements for changes that would otherwise be easy to miss: a response becoming available, a tool changing state, approval becoming required, a connection being lost, or work ending in failure.",
        ],
      },
    ],
  },
  {
    path: "/docs/accessible-ai-agents",
    group: "Concepts",
    title: "Accessible AI agents and tool execution",
    description:
      "Design screen-reader announcements for AI agent progress, tool calls, approvals, interruptions, failures, retries, and results.",
    keywords: [
      "AI agent accessibility",
      "accessible AI agents",
      "tool call accessibility",
      "AI approval accessibility",
      "agent UI accessibility",
    ],
    related: [
      "/docs/lifecycle/tools",
      "/docs/lifecycle/interactions",
      "/docs/integrations",
    ],
    sections: [
      {
        id: "agent-lifecycle",
        title: "Agent interfaces have more states than a chat transcript",
        body: [
          "An agent can start a long-running tool, report progress, request a decision, lose its connection, retry, and finish with a result. Visual indicators may make these transitions obvious, while a screen-reader user remains on the composer, transcript, or another part of the page.",
          "Accessibility depends on communicating consequential state changes without narrating every internal operation. Announcements should describe the user-facing lifecycle, not expose raw tool payloads, backend errors, or chain-of-thought-like implementation detail.",
        ],
      },
      {
        id: "event-model",
        title: "Map confirmed agent state to normalized events",
        body: [
          "Dispatch tool.started when a named user-relevant operation begins, tool.progress only for meaningful milestones, and tool.completed or tool.failed at the confirmed terminal state. Use interaction.requested and interaction.resolved for approval or other user decisions. Report connection and response retry events only when the application or framework provides reliable evidence.",
        ],
        table: {
          headers: ["Agent state", "Normalized event", "Announcement purpose"],
          rows: [
            ["Tool begins", "tool.started", "Set context for a user-relevant operation"],
            ["Meaningful milestone", "tool.progress", "Report progress without flooding"],
            ["Approval needed", "interaction.requested", "Make a required decision discoverable"],
            ["Tool fails", "tool.failed", "Communicate the safe user-facing failure label"],
            ["Response retries", "response.retrying", "Cancel stale response work and identify the retry"],
            ["Connection changes", "connection.lost / restored", "Report confirmed availability changes"],
          ],
        },
      },
      {
        id: "priority-and-focus",
        title: "Prioritize decisions and failures without stealing focus",
        body: [
          "Approval requests and failures can use higher announcement priority than routine progress, but ordinary agent lifecycle updates do not move focus. If an approval control needs focus, the host application must make that separate interaction decision using its own accessible dialog, disclosure, or inline workflow.",
          "Bounded queues and terminal-event cleanup prevent outdated progress from being delivered after a retry, failure, interruption, or disposal.",
        ],
      },
      {
        id: "framework-fidelity",
        title: "Choose an adapter by observable lifecycle fidelity",
        body: [
          "The AI SDK, assistant-ui, and AG-UI adapters translate documented public framework state into the normalized event model. Their pages list what they can observe. When the host application knows about additional connection, retry, or approval states, it can dispatch those core events directly instead of asking an adapter to infer them from rendered UI.",
        ],
      },
    ],
  },
  {
    path: "/docs/architecture",
    group: "Concepts",
    title: "Accessibility model and architecture",
    description:
      "See how an event from your app becomes a clear, well-timed screen-reader update.",
    keywords: ["architecture", "policy", "delivery", "assistive technology"],
    sections: [
      {
        id: "flow",
        title: "From an app event to a screen-reader update",
        body: [
          "AI framework → standard events → core runtime → browser delivery → screen reader.",
          "An adapter reads events from your framework. Core chooses useful updates, removes repeats, and controls timing. DOM adds each update without changing your visible interface.",
        ],
        visual: "runtime-flow",
      },
      {
        id: "boundaries",
        title: "Report only what the app knows",
        body: [
          "generative-a11y turns confirmed app events into screen-reader updates. It records each update added to the page. Test with real screen readers to confirm what they speak.",
        ],
        bullets: [
          "Core does not use the DOM.",
          "Adapters do not run framework actions or control your interface.",
          "Streaming and status changes do not move focus.",
          "generative-a11y does not copy backend errors or tool results into announcements.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations",
    group: "Getting started",
    title: "Choose an integration",
    description:
      "Choose the smallest package that connects generative-a11y to your app.",
    keywords: ["choose", "integration", "package", "AI SDK", "assistant-ui", "AG-UI", "React", "custom"],
    sections: [
      {
        id: "decision-table",
        title: "Start with the framework your app uses",
        body: [
          "Choose an adapter based on the framework in your code, not the way the interface looks. An adapter can only report events the framework makes publicly available.",
        ],
        table: {
          headers: ["Your app", "Install", "Choose when", "Events available"],
          rows: [
            ["Custom JavaScript", "core + dom", "Your app already knows when work starts and finishes", "All standard library events"],
            ["React application", "react", "You want a provider, browser updates, preferences, and element bindings", "Events sent by your app"],
            ["AI SDK useChat", "ai-sdk + core", "Your UI uses public useChat state and callbacks", "Responses, tools, approvals, sources, and final response states"],
            ["assistant-ui", "assistant-ui + core", "Your app exposes a public ThreadRuntime", "Messages, tools, approvals, sources, and final response states"],
            ["AG-UI or CopilotKit v2", "ag-ui + core", "Your agent exposes documented protocol callbacks", "Response text, tools, interruptions, and final response states"],
          ],
        },
      },
      {
        id: "fidelity",
        title: "Check which events the adapter can see",
        body: [
          "Each adapter lists the events its framework reports and the events that are unavailable. Adapters do not guess by reading rendered text, timing interface changes, or using private framework fields.",
          "Use the core integration directly when your app knows about retries, connection changes, or custom interactions that the framework adapter cannot see.",
        ],
        table: {
          headers: ["Question", "Use an adapter", "Dispatch core events"],
          rows: [
            ["Does the framework report the event you need?", "Yes", "Not required"],
            ["Do you need the framework's IDs translated?", "Yes", "Optional"],
            ["Does your app know when retries or connection changes happen?", "Only if the framework reports them", "Yes"],
            ["Can the integration depend on rendered UI text?", "Never", "Never"],
          ],
        },
      },
      {
        id: "installation",
        title: "Install only the layers you use",
        body: [
          "Your app supplies a core runtime to its framework adapter. DOM or React handles browser announcements separately.",
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
      "Send only the new text from each streaming update so screen readers do not hear the whole response again and again.",
    keywords: ["streaming", "delta", "segment", "sentence", "non-repetition"],
    sections: [
      {
        id: "append-only",
        title: "Send only the new text",
        body: [
          "Send response.started when a response begins. Each response.text.delta must contain only the text that just arrived. Send response.completed to announce any useful text still waiting. Send response.failed or response.interrupted to discard that text.",
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
          { label: "Start the response", description: "response.started tells the runtime that a new response is beginning." },
          { label: "Send new text only", description: "Each delta contains only new text, so earlier text is not announced again." },
          { label: "Let the runtime group text", description: "Your runtime waits for useful phrases instead of announcing every token." },
          { label: "Finish the response", description: "response.completed sends any useful text that is still waiting and closes the response." },
        ],
      },
      {
        id: "segmentation",
        title: "Meaningful units, not tokens",
        body: [
          "Balanced mode waits for a complete sentence when possible. It can also send a useful phrase after enough text arrives or a short delay. Each piece is announced once.",
        ],
        note: "Interactive examples show app text beside the screen-reader updates prepared by a real runtime.",
      },
    ],
  },
  {
    path: "/docs/lifecycle/tools",
    group: "Lifecycle",
    title: "Tool lifecycle",
    description:
      "Tell users when an app action starts, makes progress, finishes, or fails without exposing private arguments or results.",
    keywords: ["tools", "progress", "tool.failed", "tool.completed"],
    sections: [
      {
        id: "events",
        title: "Report the start, progress, and result",
        body: [
          "Tool arguments can arrive before the tool runs. Send tool.started when execution begins. Send tool.progress only when your app has a progress value from 0 to 1. Finish with one tool.completed or tool.failed event.",
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
          { label: "Keep one tool ID", description: "toolId keeps every progress update connected to the same app action." },
          { label: "Provide localized copy", description: "label and message are short user-facing text, not raw tool arguments or backend output." },
          { label: "Report progress", description: "progress uses a value from 0 to 1. Your runtime announces only useful changes." },
        ],
      },
      {
        id: "safe-errors",
        title: "Keep backend data out of announcements",
        body: [
          "Use error for debugging; generative-a11y never announces it. Set announcement only when your app has a short, translated message that is safe to share. Raw tool results also stay private.",
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/stop-retry",
    group: "Lifecycle",
    title: "Stop, abort, retry, and stale responses",
    description:
      "Stop pending announcements when a response is cancelled, and ignore late updates from an older retry.",
    keywords: ["stop", "abort", "retry", "regeneration", "stale response", "replacement"],
    sections: [
      {
        id: "interruption",
        title: "Stopping a response clears pending text",
        body: [
          "Send response.interrupted when your app stops a response. Core discards waiting text and prepares a short status update. Adapters do not treat a generic ready state as proof that someone stopped a response.",
        ],
      },
      {
        id: "retry",
        title: "Tell the runtime when a retry starts",
        body: [
          "response.retrying cancels the current attempt. Keep one responseId for the logical answer and give each attempt a new responseInstanceId. Core ignores late updates from older attempts.",
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
          { label: "Name the new attempt", description: "nextResponseInstanceId becomes the accepted attempt for later text and final events." },
          { label: "Keep the response ID", description: "responseId stays the same so the app can treat both attempts as one logical answer." },
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/interactions",
    group: "Lifecycle",
    title: "Interactions and approvals",
    description:
      "Announce approvals, confirmations, and requests for input when your app can confirm that they opened or closed.",
    keywords: ["interaction", "approval", "confirmation", "input required", "human in the loop"],
    sections: [
      {
        id: "general-events",
        title: "Prefer the general interaction model",
        body: [
          "Use interaction.requested and interaction.resolved for confirmations and other requests for input. Use approval events when the framework provides a specific approval state.",
        ],
      },
      {
        id: "focus",
        title: "Announcements do not move focus",
        body: [
          "generative-a11y can announce when your app needs input. Your app still opens the dialog, manages its controls, and restores focus when it closes.",
        ],
      },
    ],
  },
  {
    path: "/docs/lifecycle/identity",
    group: "Lifecycle",
    title: "Keep updates connected with stable IDs",
    description:
      "Use stable IDs to keep every update connected to the correct response, tool, interaction, or approval.",
    keywords: ["identity", "responseId", "responseInstanceId", "toolId", "scopeId", "message"],
    sections: [
      {
        id: "entities",
        title: "Use a stable ID for each piece of work",
        body: [
          "responseId identifies an answer, and responseInstanceId separates its retry attempts. toolId identifies a tool call, and toolInstanceId separates repeated runs. interactionId and approvalId connect each request to its result.",
        ],
        table: {
          headers: ["Entity", "Identity", "Why it matters"],
          rows: [
            ["Response", "responseId", "Keeps text and the final state together"],
            ["Attempt", "responseInstanceId", "Ignores late text from an older retry"],
            ["Tool", "toolId + toolInstanceId", "Separates repeated tool runs"],
            ["Interaction", "interactionId", "Connects a request to its result"],
            ["Adapter mount", "scopeId", "Prevents ID collisions across chats"],
          ],
        },
      },
      {
        id: "never-labels",
        title: "Labels are copy, not identity",
        body: [
          "Do not use displayed text, labels, array positions, or render counts as IDs because they can change. Framework adapters keep stable IDs from your framework and stop accepting unknown IDs after reaching their safety limit.",
        ],
      },
    ],
  },
  {
    path: "/docs/packages/core",
    group: "Packages",
    title: "@generative-a11y/core",
    description:
      "Reference for the browser-independent runtime, presets, scheduling, testing helpers, events, announcements, and diagnostics.",
    keywords: ["core", "runtime", "scheduler", "ManualClock", "presets", "segmentText", "API"],
    sections: [
      {
        id: "runtime-api",
        title: "Runtime and policy exports",
        body: ["Most applications start with createGenerativeA11y and report app events with dispatch."],
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
          { name: "dispatch(event)", type: "boolean", requirement: "Method", defaultValue: "n/a", description: "Handles one event immediately. Returns true when the runtime accepts it, or false after disposal or when nested dispatch work reaches its safety limit." },
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
        body: ["These lower-level exports support advanced integrations and repeatable tests. If the queue is full, the runtime drops status updates before response text so the answer is preserved when possible."],
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
          { name: "tools.announceStart", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Announces a tool start after the app reports that execution began." },
          { name: "tools.announceStartAfterMs", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Delays start copy so fast operations can finish without unnecessary status noise." },
          { name: "tools.announceProgress", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Allows explicit normalized progress values to produce paced status updates." },
          { name: "tools.progressEveryPercent", type: "number", requirement: "Policy", defaultValue: "preset value", description: "Sets the minimum percentage bucket change before another progress update is eligible." },
          { name: "tools.announceCompletion", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls successful tool terminal announcements." },
          { name: "tools.announceFailure", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls safe failure announcements while raw errors remain diagnostic-only." },
          { name: "announceResponseStarted", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls whether a response start produces status copy." },
          { name: "announceResponseCompleted", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls explicit response completion copy after the final buffered text flush." },
          { name: "announceInterruption", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls stop and abort status while interruption still cancels buffered output." },
          { name: "announceRetry", type: "boolean", requirement: "Policy", defaultValue: "preset value", description: "Controls retry updates when the app reports that a retry began." },
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
          { name: "runtime", type: "GenerativeA11yRuntime", requirement: "Required", defaultValue: "none", description: "The runtime that supplies screen-reader updates. Your app still owns it." },
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
          "Attention signals describe browser state such as focus and visibility. They cannot read a screen reader's virtual cursor. Focus helpers run only when your app calls them, never during normal streaming.",
        ],
        bullets: [
          "createAttentionStore and AttentionStore types",
          "captureFocus, focusElement, restoreFocus and result types",
          "createPreferenceStore, normalizePreferences, samePreferences",
          "defaultPreferences and preferencesToCoreConfiguration",
        ],
        api: [
          { name: "createAttentionStore(options)", type: "AttentionStore", requirement: "Function", defaultValue: "browser document", description: "Combines page visibility, window focus, the focused area, and newest-response visibility into a careful estimate of where the user is working." },
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
          { label: "Read the runtime", description: "useGenerativeA11yRuntime returns the same runtime so your app can report events from its callbacks." },
          { label: "Attach refs only", description: "The binding props contain refs, not styling or event handlers, so the existing chat interface remains application-owned." },
          { label: "Report events where they happen", description: "Send the event from the callback that confirms it happened. Do not guess by reading rendered text." },
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
          { name: "useGenerativeA11yRuntime()", type: "GenerativeA11yRuntime", requirement: "Hook", defaultValue: "nearest provider", description: "Returns the runtime from the nearest provider." },
          { name: "useGenerativeA11yAttention()", type: "AttentionSnapshot", requirement: "Hook", defaultValue: "unknown on server", description: "Uses useSyncExternalStore to report a careful estimate of where the user is working." },
          { name: "useGenerativeA11yPreferences()", type: "GenerativeA11yPreferencesResult", requirement: "Hook", defaultValue: "store snapshot", description: "Returns validated preferences, a setter, and the underlying store." },
          { name: "useGenerativeA11yBindings()", type: "GenerativeA11yBindings", requirement: "Hook", defaultValue: "stable ref props", description: "Returns composerProps, conversationProps, and newestResponseProps for existing elements." },
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/ai-sdk",
    group: "Integrations",
    title: "Vercel AI SDK accessibility",
    description:
      "Add paced screen-reader updates to AI SDK 7 and @ai-sdk/react 4 through documented state, finish callbacks, and error callbacks.",
    keywords: ["AI SDK", "useChat", "createObserver", "composeChatCallbacks", "approval", "citation"],
    related: [
      "/docs/screen-readers-and-streaming-ai",
      "/docs/getting-started",
      "/api/ai-sdk/use-chat-accessibility",
    ],
    sections: [
      {
        id: "installation",
        title: "Install the AI SDK adapter",
        body: [
          "Install @generative-a11y/core, @generative-a11y/dom, and @generative-a11y/ai-sdk beside the AI SDK packages already used by your application. The adapter translates public chat state and callbacks; it does not replace useChat or render a chat interface.",
        ],
        bullets: [
          "Use the React subpath when your application connects through @ai-sdk/react.",
          "Create one accessibility runtime for the chat surface and dispose it when that surface unmounts.",
        ],
      },
      {
        id: "react",
        title: "React integration",
        body: [
          "Create the accessibility integration before useChat so composed callbacks are present at construction, then observe its documented snapshot after useChat runs.",
        ],
        code: { language: "tsx", value: aiSdkExample },
        walkthrough: [
          { label: "Create accessibility first", description: "The hook creates one observer and composed callbacks before useChat captures its initial options." },
          { label: "Keep your callbacks", description: "The integration observes onFinish and onError, then calls the callbacks supplied by your app." },
          { label: "Construct useChat", description: "Spreading chatCallbacks tells the adapter when a response completes, stops, or fails." },
          { label: "Observe public state", description: "The second hook reads only messages, status, and error from the returned useChat helpers." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "none", description: "Receives events from the integration. Your app owns this runtime, so the integration never disposes it." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "A stable non-empty namespace for message, tool, approval, and source IDs in this chat instance." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds each identity collection. Invalid values throw and saturation suppresses later unknown identities." },
          { name: "getToolLabel", type: "(context) => string", requirement: "Optional", defaultValue: '"A tool"', description: "Maps public tool identity to short localized copy. It must not expose arguments or raw results." },
          { name: "onFinish", type: "ChatOnFinishCallback", requirement: "Optional", defaultValue: "undefined", description: "Your existing finish callback. It is composed rather than replaced." },
          { name: "onError", type: "ChatOnErrorCallback", requirement: "Optional", defaultValue: "undefined", description: "Your existing error callback. Raw errors are not copied into announcements." },
          { name: "chatCallbacks", type: "{ onFinish, onError }", requirement: "Return", defaultValue: "n/a", description: "Spread these callbacks into useChat so the adapter knows exactly when a response finishes or fails." },
          { name: "snapshot", type: "Pick<UseChatHelpers, 'messages' | 'status' | 'error'>", requirement: "Required", defaultValue: "none", description: "The public useChat return object observed after useChat has been invoked." },
        ],
      },
      {
        id: "lifecycle-mapping",
        title: "Lifecycle mapping",
        body: [
          "The observer maps documented message parts and chat status to response, text, tool, approval, and citation events. Composed callbacks confirm completion and failure. Your application must report retry actions because public AI SDK state does not identify every retry request.",
        ],
        bullets: [
          "messages and status identify active response text and known tool states",
          "onFinish confirms completion or stop details",
          "onError confirms failure without copying raw error text",
        ],
      },
      {
        id: "screen-reader-behavior",
        title: "Expected screen-reader behavior",
        body: [
          "Core groups streaming text into paced announcement intents and gives approval, failure, and completion updates suitable priority. The DOM package writes those intents to live regions without moving focus during routine status changes. Browser transcripts confirm DOM delivery; test VoiceOver, NVDA, or another target screen reader before making support claims.",
        ],
      },
      {
        id: "fidelity",
        title: "What the adapter can report",
        body: [
          "Use supplied callbacks so the adapter knows when a response finishes, stops, or fails. Status alone does not provide enough detail. Report regenerate actions from your app when you need retry events. A successful response after an error tells the adapter that the connection returned.",
        ],
        bullets: [
          "Exports CHAT_ADAPTER_METADATA, createObserver, composeChatCallbacks",
          "React subpath exports useChatAccessibility and useObserveChatAccessibility",
          "Tool failure, approvals, and citations use stable public part IDs",
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        body: [
          "Missing completion updates often mean useChat captured callbacks before the accessibility integration created them. Repeated output can indicate an unstable scopeId or more than one observer attached to the same chat. Inspect runtime diagnostics, then compare the observed public state with the lifecycle mapping above.",
        ],
        bullets: [
          "Create the integration before constructing useChat.",
          "Keep scopeId stable for the lifetime of one chat instance.",
          "Use the lifecycle lab to inspect deterministic browser updates before testing assistive technology.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/assistant-ui",
    group: "Integrations",
    title: "assistant-ui accessibility",
    description:
      "Add paced screen-reader updates to an assistant-ui thread without replaying messages already present in its history.",
    keywords: ["assistant-ui", "bindThreadRuntime", "ThreadRuntime", "approval", "source"],
    related: [
      "/docs/accessible-ai-agents",
      "/docs/getting-started",
      "/api/assistant-ui/bind-thread-runtime",
    ],
    sections: [
      {
        id: "installation",
        title: "Install the assistant-ui adapter",
        body: [
          "Install @generative-a11y/core, @generative-a11y/dom, and @generative-a11y/assistant-ui beside assistant-ui. The adapter subscribes to a thread runtime you already own and leaves rendering, actions, and focus behavior with the host application.",
        ],
      },
      {
        id: "bind",
        title: "Connect an existing thread runtime",
        body: [
          "bindThreadRuntime reads only getState and subscribe. It cannot run thread actions, render an interface, or dispose your core runtime.",
        ],
        code: { language: "typescript", value: assistantUiExample },
        walkthrough: [
          { label: "Pass the public thread", description: "Your adapter needs only getState and subscribe, so it cannot invoke composer, message, or run actions." },
          { label: "Namespace framework IDs", description: "scopeId prevents identical message and tool IDs from colliding across mounted threads." },
          { label: "Record existing history", description: "bindThreadRuntime records existing messages at startup and skips old content after hydration." },
          { label: "Dispose the subscription", description: "Returned cleanup stops observation while leaving assistant-ui and core running." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "none", description: "The runtime that receives events from this adapter. Your app owns it." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "A stable namespace for assistant messages, tools, approvals, and sources in this thread." },
          { name: "thread", type: "Pick<ThreadRuntime, 'getState' | 'subscribe'>", requirement: "Required", defaultValue: "none", description: "The documented assistant-ui thread interface. The adapter does not read actions or private state." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds tracked response, tool, approval, source, and text-part identities." },
          { name: "dispose()", type: "void", requirement: "Return", defaultValue: "n/a", description: "Stops the subscription and clears adapter records. It does not dispose the thread or runtime supplied by your app." },
        ],
      },
      {
        id: "lifecycle-mapping",
        title: "Lifecycle mapping",
        body: [
          "Documented thread state supplies response text, final states, tool progress, approvals, and sources. The binding records existing history before it starts dispatching, which prevents old messages from becoming new announcements after hydration.",
        ],
      },
      {
        id: "screen-reader-behavior",
        title: "Expected screen-reader behavior",
        body: [
          "New response text becomes paced announcement intents. Tool and approval changes receive priority based on the shared policy, while routine status changes leave focus in place. Browser transcripts show what the DOM package wrote; confirm spoken output with the screen readers and browsers your application supports.",
        ],
      },
      {
        id: "limits",
        title: "What public state cannot prove",
        body: [
          "Your adapter can report streaming, known final states, tools, approvals, and sources. assistant-ui does not provide general retry or connection events, so generative-a11y does not guess.",
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        body: [
          "Repeated historical messages can indicate that a new binding received a different scopeId or started before thread hydration settled. Missing updates can indicate that the supplied thread does not expose the expected public state. Check one active subscription, stable identity, and the documented assistant-ui version before changing announcement policy.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/ag-ui",
    group: "Integrations",
    title: "AG-UI accessibility",
    description:
      "Add paced screen-reader updates to an AG-UI agent through documented callbacks for responses, tools, and user interactions.",
    keywords: ["AG-UI", "bindAgent", "AgentSubscriber", "interrupt", "protocol"],
    related: [
      "/docs/accessible-ai-agents",
      "/docs/getting-started",
      "/api/ag-ui/bind-agent",
    ],
    sections: [
      {
        id: "installation",
        title: "Install the AG-UI adapter",
        body: [
          "Install @generative-a11y/core, @generative-a11y/dom, and @generative-a11y/ag-ui beside the AG-UI client used by your application. Bind the existing agent after it is ready, and keep ownership of the agent and accessibility runtime in your application.",
        ],
      },
      {
        id: "bind-agent",
        title: "Subscribe to the public agent API",
        body: [
          "bindAgent observes an AbstractAgent through subscribe callbacks. It does not invoke actions, subscribe to private observables, or mutate agent state.",
        ],
        code: { language: "typescript", value: agUiExample },
        walkthrough: [
          { label: "Connect the agent", description: "bindAgent uses documented AgentSubscriber callbacks and does not run agent actions." },
          { label: "Use a stable scope", description: "scopeId prefixes protocol message, tool, and interrupt IDs for each mounted agent." },
          { label: "Translate confirmed events", description: "Text, tool, and interrupt callbacks become standard events when their public data confirms what happened." },
          { label: "Clean up locally", description: "dispose removes this subscriber without disposing the AG-UI agent or accessibility runtime." },
        ],
        api: [
          { name: "runtime", type: "Pick<GenerativeA11yRuntime, 'dispatch'>", requirement: "Required", defaultValue: "none", description: "Receives events translated from documented protocol callbacks." },
          { name: "scopeId", type: "string", requirement: "Required", defaultValue: "none", description: "Namespaces message, tool, and interrupt identity for one agent binding." },
          { name: "agent", type: "Pick<AbstractAgent, 'subscribe'>", requirement: "Required", defaultValue: "none", description: "A borrowed AG-UI agent exposing the documented subscriber API." },
          { name: "maxTrackedEntities", type: "number", requirement: "Optional", defaultValue: "1000", description: "Bounds response, tool, and interaction records and fails closed after saturation." },
          { name: "dispose()", type: "void", requirement: "Return", defaultValue: "n/a", description: "Unsubscribes this binding and clears adapter-owned identity records." },
        ],
      },
      {
        id: "lifecycle-mapping",
        title: "Lifecycle mapping",
        body: [
          "Text callbacks map to response start, content, and completion. Tool callbacks map to confirmed progress and results. Interrupt and resume callbacks map to requests for user input and their resolution. Stable protocol IDs keep each update attached to the correct response or tool.",
        ],
      },
      {
        id: "screen-reader-behavior",
        title: "Expected screen-reader behavior",
        body: [
          "The runtime paces response text, prioritizes approval and failure states, and suppresses duplicate progress updates. The DOM delivery layer updates live regions without moving focus for normal agent activity. Treat its transcript as browser evidence and run assistive-technology tests for spoken behavior.",
        ],
      },
      {
        id: "protocol-evidence",
        title: "What the protocol can report",
        body: [
          "Text start, content, and end callbacks report a response. Tool callbacks report work and results. Interrupt and resume callbacks report requests for user input. Your adapter does not guess about replay, connection recovery, or retries when AG-UI stays silent.",
        ],
      },
      {
        id: "troubleshooting",
        title: "Troubleshooting",
        body: [
          "Missing interaction updates usually trace to an agent that was bound before readiness or callbacks that omit stable IDs. Duplicate updates can come from multiple subscribers. Confirm one binding per agent, a stable scopeId, and documented callbacks before adding custom event inference.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/copilotkit",
    group: "Integrations",
    title: "CopilotKit v2",
    description:
      "Connect CopilotKit v2 with the AG-UI adapter after the agent is ready.",
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
          { label: "Wait for readiness", description: "Your effect subscribes only after CopilotKit exposes a ready AG-UI agent." },
          { label: "Reuse the protocol adapter", description: "CopilotKit v2 exposes a public AG-UI agent, so the AG-UI adapter can connect it directly." },
          { label: "Return cleanup", description: "React effect cleanup disposes exactly the subscription created by this mount." },
        ],
      },
      {
        id: "no-duplicate-package",
        title: "Why there is no CopilotKit package",
        body: [
          "A second adapter would duplicate the same work. If an app has client tools that AG-UI cannot identify, connect those tools directly instead of guessing from their names.",
        ],
      },
    ],
  },
  {
    path: "/docs/integrations/custom",
    group: "Integrations",
    title: "Custom applications",
    description:
      "Connect a custom app by reporting its response, tool, and interaction events directly to generative-a11y.",
    keywords: ["custom", "framework neutral", "adapter", "normalized event"],
    sections: [
      {
        id: "thin-adapter",
        title: "Keep translation thin",
        body: [
          "Report events where your app knows what happened. Keep the original IDs and send only newly added text. Report how each response or tool ends, and provide translated labels for users.",
        ],
        code: { language: "typescript", value: quickStart },
        walkthrough: [
          { label: "Report events at the source", description: "Call dispatch from the transport or app callback that confirms what happened." },
          { label: "Preserve stable IDs", description: "Use the response and tool IDs from your app instead of labels, array positions, or render counts." },
          { label: "Connect browser delivery", description: "DOM adds announcements without changing visible rendering or app actions." },
          { label: "Dispose by ownership", description: "Your adapter cleans up its subscriptions, then the application disposes resources it created." },
        ],
      },
      {
        id: "never-infer",
        title: "Leave out events the framework cannot report",
        body: [
          "Do not treat streamed arguments as a completed tool, a repeated render as a retry, a ready state as an interruption, or a tool name as an approval. If the framework does not report an event, the adapter leaves it out.",
        ],
      },
    ],
  },
  {
    path: "/docs/api/events",
    group: "API reference",
    title: "Event reference",
    description:
      "Field-level reference for every response, tool, interaction, approval, connection, and citation event accepted by runtime.dispatch.",
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
            ["eventId", "string", "No", "Connects an app event to its diagnostic messages"],
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
            ["dispatch(event)", "boolean", "Returns whether one event was accepted immediately"],
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
        body: ["An AnnouncementIntent is the screen-reader update prepared by core. It does not confirm that the browser delivered it or that a screen reader spoke it."],
        table: { headers: ["Field", "Type", "Meaning"], rows: [
          ["id", "string", "Unique ID for this scheduled update"], ["at", "number", "Clock timestamp"], ["channel", "polite | assertive", "Requested urgency"], ["text", "string", "User-facing text"], ["sourceType", "event type", "The app event that produced it"], ["responseId / toolId / interactionId", "string?", "Optional source ID"], ["locale", "string?", "Optional delivery language"],
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
      "Store contracts for announcement preferences and careful estimates of where the user is working, including persistence and server rendering.",
    keywords: ["preferences", "attention", "focus", "useSyncExternalStore", "persistence"],
    sections: [
      { id: "preferences", title: "PreferenceStore", body: ["Preferences are versioned, validated, and mapped to core configuration. Invalid persistence data is diagnosed and ignored."], table: { headers: ["Option", "Type", "Default"], rows: [["defaultValue", "PreferenceSchemaV1", "balanced"], ["persistence.key", "string", "library key"], ["persistence.storage", "PreferenceStorage", "localStorage when available"], ["persistence.events", "PreferenceStorageEventSource", "storage events when available"], ["onDiagnostic", "callback", "undefined"]] } },
      { id: "attention", title: "AttentionStore", body: ["AttentionStore describes browser focus and visibility. It does not inspect a screen reader's cursor and never moves focus."], table: { headers: ["Snapshot field", "Values", "Browser signal"], rows: [["visibility", "visible, hidden, unknown", "Document visibility"], ["windowFocus", "focused, blurred, unknown", "Window focus"], ["focusArea", "composer, conversation, elsewhere, none, unknown", "Deep active element"], ["newestResponse", "visible, outside, unobserved, unknown", "Intersection observer"], ["mode", "foreground, background, reading-history, away, unknown", "Derived from the signals above"]] } },
    ],
  },
  {
    path: "/docs/devtools",
    group: "Tools",
    title: "Debug AI accessibility with the trace explorer",
    description:
      "Inspect bounded, redacted runtime decisions and browser delivery evidence with the optional generative-a11y devtools package.",
    keywords: ["devtools", "accessibility trace", "diagnostics", "debugging", "redaction"],
    related: [
      "/api/devtools",
      "/api/core/diagnostics",
      "/docs/troubleshooting",
    ],
    sections: [
      {
        id: "install",
        title: "Install development-only diagnostics",
        body: [
          "Install @generative-a11y/devtools in development environments. The package observes public core diagnostics and does not patch dispatch, change announcement policy, or depend on an AI framework.",
        ],
        code: { language: "shell", value: "npm install --save-dev @generative-a11y/devtools" },
        walkthrough: [
          { label: "Keep it development-only", description: "The package helps inspect runtime behavior and should not become part of the production accessibility path." },
          { label: "Attach an existing runtime", description: "The store borrows public diagnostic methods from a runtime your app owns." },
        ],
      },
      {
        id: "trace-explorer",
        title: "Open the Accessibility Trace Explorer",
        body: [
          "The optional overlay mounts only when your code calls mountDevtoolsOverlay. It starts collapsed inside an open Shadow DOM and provides search, filters, causal evidence, capture controls, and explicit trace copy.",
        ],
        code: { language: "typescript", value: devtoolsExample },
        walkthrough: [
          { label: "Create a bounded store", description: "maxEntries limits retained diagnostic records and reports how many older records were dropped." },
          { label: "Attach one runtime identity", description: "A stable runtime ID connects observed events, decisions, snapshots, and optional DOM delivery results." },
          { label: "Mount the overlay", description: "The browser helper creates the launcher and trace workspace only after this explicit call." },
          { label: "Dispose owned resources", description: "Close the overlay, detach the borrowed runtime, then dispose the store." },
        ],
      },
      {
        id: "captured-evidence",
        title: "Captured evidence and redaction",
        body: [
          "The store retains event categories, outcomes, timing, stable IDs, queue and entity snapshots, declared adapter evidence, and browser delivery metadata. It excludes assistant text, labels, errors, tool data, stacks, DOM content, deduplication keys, and timer handles.",
          "Pass adapter metadata through source only when a documented integration can support it. Devtools does not detect a framework or invent events that the framework did not report.",
        ],
      },
      {
        id: "delivery-correlation",
        title: "Correlate runtime decisions with DOM delivery",
        body: [
          "Send DOMDeliveryResult values from createDOMAnnouncer onDiagnostic to store.recordDelivery. Safe announcement and entity IDs connect the browser action to the runtime decision that requested it.",
        ],
        note: "A trace can confirm a runtime decision and a browser API call or live-region mutation. It cannot prove that assistive technology spoke the announcement.",
      },
      {
        id: "keyboard-and-focus",
        title: "Overlay keyboard and focus behavior",
        body: [
          "Opening the workspace moves focus into it. Escape or the close control collapses the workspace and restores the element focused before opening. Streaming records do not move focus, the overlay does not trap focus, and it creates no live region or global keyboard shortcut.",
        ],
      },
    ],
  },
  {
    path: "/docs/testing/replay",
    group: "Accessibility and testing",
    title: "Deterministic replay testing",
    description:
      "Record normalized lifecycle events, replay them through a ManualClock, and assert announcement or diagnostic transcripts with optional Vitest matchers.",
    keywords: ["deterministic replay", "Vitest", "ManualClock", "fixtures", "accessibility testing"],
    related: [
      "/api/test",
      "/api/core/testing",
      "/docs/testing",
    ],
    sections: [
      {
        id: "install",
        title: "Install the test helpers",
        body: [
          "Install @generative-a11y/test beside core in the test workspace. The package needs no browser and its root entry does not import Vitest.",
        ],
        code: { language: "shell", value: "npm install --save-dev @generative-a11y/test" },
        walkthrough: [
          { label: "Keep fixtures local", description: "Replay files contain normalized application events and should follow the repository rules for test data." },
          { label: "Add Vitest only when used", description: "Import the optional matcher entry from @generative-a11y/test/vitest." },
        ],
      },
      {
        id: "record-and-replay",
        title: "Record and replay normalized events",
        body: [
          "recordRuntime captures only events sent through the dispatch target it returns. Fixtures use a versioned JSON envelope, relative timestamps, and array order for events with the same time.",
        ],
        code: { language: "typescript", value: replayExample },
        walkthrough: [
          { label: "Wrap the dispatch target", description: "Send the same normalized events used by the application through recording.runtime." },
          { label: "Create a fixture", description: "fixture returns a frozen V1 envelope with non-negative relative times." },
          { label: "Replay with controlled time", description: "replayEvents advances ManualClock to each event and dispatches it in recorded order." },
          { label: "Settle only when intended", description: "Call runUntilIdle when the test needs final delayed output rather than intermediate state." },
        ],
      },
      {
        id: "vitest-matchers",
        title: "Use semantic Vitest matchers",
        body: [
          "installVitestMatchers adds transcript, announcement, and diagnostic assertions. Expected objects use semantic partial fields, which keeps tests focused on the behavior under review.",
        ],
        bullets: [
          "toHaveAnnouncementTranscript checks ordered output",
          "toHaveAnnounced checks that one matching intent exists",
          "toHaveDiagnostic checks a matching runtime decision",
        ],
      },
      {
        id: "evidence-limit",
        title: "Keep the evidence boundary clear",
        body: [
          "Replay proves that normalized events produce repeatable runtime output under a controlled clock. It does not prove browser delivery or screen-reader speech. Keep browser fixtures and hands-on assistive-technology tests as separate release evidence.",
        ],
      },
    ],
  },
  {
    path: "/docs/testing",
    group: "Accessibility and testing",
    title: "Testing integrations",
    description:
      "Test patterns for adapters, runtime behavior, browser delivery, and hands-on screen-reader checks.",
    keywords: ["testing", "ManualClock", "Vitest", "Playwright", "screen reader"],
    sections: [
      { id: "test-layers", title: "Test each layer separately", body: ["A runtime transcript shows what core prepared. A DOM test shows how the page changed. Test with a real screen reader to confirm what it speaks."], table: { headers: ["Layer", "Check", "Does not confirm"], rows: [["Adapter", "Events and stable IDs", "Announcements"], ["Core", "Prepared updates, timing, suppression, cancellation", "Browser behavior"], ["DOM", "Browser results and page updates", "Screen-reader speech"], ["Browser", "Keyboard, landmarks, focus, live regions", "Every screen reader and browser combination"], ["Hands-on screen-reader test", "One user workflow", "Behavior in every environment"]] } },
      { id: "browser-matrix", title: "Test every supported browser engine", body: ["Browser fixtures run in Chromium, Firefox, and WebKit. They check keyboard use, stable focus, page landmarks, live regions, and page announcements."], code: { language: "shell", value: `pnpm test:browser:install
pnpm test:browser` }, walkthrough: [{ label: "Install engines", description: "Repository scripts install the Chromium, Firefox, and WebKit versions used by tests." }, { label: "Run browser tests", description: "This command runs cross-browser accessibility fixtures and documentation checks." }, { label: "Interpret the result", description: "A passing browser test confirms browser behavior, not screen-reader speech." }] },
      { id: "at-fixture", title: "Test a realistic app workflow", body: ["Fixtures cover streaming text, tool updates, stopping, retrying, and browser announcements. Each assertion names the behavior it checks."], bullets: ["Run the same scenarios in all three browser engines.", "Check that streaming and status updates do not move focus.", "Connect each app event to the runtime update and the resulting page change.", "Keep controls and visible status usable without the library."] },
      { id: "manual-evidence", title: "Record hands-on screen-reader tests", body: ["For each release, record the date, browser, operating system, screen reader and version, workflow, expected result, actual result, and outcome. Repository validation checks every required field."], note: "One test describes one setup and workflow. It does not guarantee the same result with every screen reader and browser." },
      { id: "clock", title: "Use ManualClock for time-dependent behavior", body: ["Advance the test clock instead of waiting for real timers. Check diagnostics when the runtime intentionally skips an update."], code: { language: "typescript", value: `const recorder = createAnnouncementRecorder({ preset: "balanced" });
const runtime = recorder.runtime;
const clock = recorder.clock;

runtime.dispatch(started);
runtime.dispatch(delta);
clock.advanceBy(2_000);

expect(recorder.transcript()).toHaveLength(1);` }, walkthrough: [{ label: "Create the harness", description: "createAnnouncementRecorder supplies a runtime and ManualClock." }, { label: "Send app events", description: "Use the same events your integration sends in the application." }, { label: "Advance the clock", description: "Tests stay fast and repeatable while checking delayed updates." }] },
    ],
  },
  {
    path: "/docs/troubleshooting",
    group: "Accessibility and testing",
    title: "Troubleshooting",
    description:
      "Fix missing, repeated, late, delayed, or noisy announcements by checking each step from the framework event to the browser update.",
    keywords: ["troubleshooting", "nothing announced", "duplicate", "stale", "diagnostics", "SSR", "delivery"],
    sections: [
      {
        id: "nothing-announced",
        title: "Nothing is announced",
        body: [
          "First check that the runtime receives a started event, new text only, and one completed, failed, or interrupted event with the same response ID. Then check runtime diagnostics and the browser result separately.",
        ],
        bullets: [
          "Confirm the announcement listener or DOM binding is attached before dispatch.",
          "Complete a sentence or dispatch response.completed so buffered text can flush.",
          "Check for policy-silent, empty-text, unknown-response, or runtime-disposed diagnostics.",
          "Check DOMDeliveryResult for unavailable or disposed delivery.",
          "A successful page update does not confirm what a screen reader spoke. Test that separately.",
        ],
      },
      {
        id: "repeated-output",
        title: "Output repeats or arrives too often",
        body: [
          "response.text.delta must contain only the text that just arrived. If you send the full response every time, earlier text may be announced again.",
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
          "A retry must replace the active response attempt. Core ignores late updates from older attempts and reports stale-response diagnostics.",
        ],
        bullets: [
          "Send response.retrying with the replaced and next response instance IDs.",
          "Attach the new responseInstanceId to each later text event and final event.",
          "Do not reuse a completed or interrupted response instance.",
          "If the framework does not provide retry IDs, report retry events directly from your app instead of guessing.",
        ],
      },
      {
        id: "tool-noise",
        title: "Tool progress is too noisy",
        body: [
          "Keep each tool ID stable and use short, translated labels. To reduce noise, adjust the start delay and progress settings instead of filtering announcements after they are created.",
        ],
        bullets: [
          "Delay tool starts with tools.announceStartAfterMs so fast operations can finish quietly.",
          "Raise tools.progressEveryPercent or disable progress announcements.",
          "Never copy raw arguments, results, or backend errors into user-facing labels.",
        ],
      },
      {
        id: "diagnostics",
        title: "Use diagnostics to find the first problem",
        body: [
          "Each diagnostic says what the runtime did and why. Start with the first unexpected result instead of looking only at the final browser update.",
        ],
        table: {
          headers: ["Reason", "Meaning", "First check"],
          rows: [
            ["policy-silent", "Active policy suppresses this event", "Preset and explicit policy overrides"],
            ["unknown-response or unknown-tool", "No active matching identity exists", "Started event order and IDs"],
            ["stale-response or stale-tool", "Event belongs to a replaced execution", "Instance identity propagation"],
            ["progress-threshold", "Progress did not cross the configured bucket", "progressEveryPercent"],
            ["queue-capacity", "Bounded scheduler rejected additional work", "Producer rate and maxQueueSize"],
            ["delivery-error", "Every announcement listener failed", "Listener exceptions and onDeliveryError"],
            ["delivered", "Listeners accepted the prepared announcement", "Check the DOM result, then test with a screen reader"],
          ],
        },
      },
      {
        id: "trace-explorer",
        title: "Inspect a redacted trace during development",
        body: [
          "Use @generative-a11y/devtools when a single diagnostic is not enough to explain the event sequence. Its bounded store connects source events, runtime decisions, snapshots, and optional DOM delivery results without retaining response text, labels, tool data, or page content.",
        ],
        bullets: [
          "Attach the store to an existing runtime and give that runtime a stable development ID.",
          "Forward DOMDeliveryResult values to recordDelivery when you need browser correlation.",
          "Pause or clear capture without changing runtime scheduling or browser delivery.",
          "Treat the trace as debugging evidence, not proof of screen-reader speech.",
        ],
      },
    ],
  },
  {
    path: "/docs/compatibility",
    group: "Reference",
    title: "Compatibility",
    description:
      "See which browsers, React versions, and framework versions are covered by the current tests.",
    keywords: ["browser", "SSR", "React 18", "React 19", "peer dependency", "compatibility"],
    sections: [
      {
        id: "runtime",
        title: "Browser and server support",
        body: [
          "Core works without a browser. DOM stays inactive when document is unavailable. React renders stable hidden regions on the server and connects them in the browser. Adapter imports do not require browser globals.",
        ],
      },
      {
        id: "browser-matrix",
        title: "Automated browser tests have limits",
        body: [
          "Browser tests run in Chromium, Firefox, and WebKit. WebKit provides useful coverage, but it cannot replace Safari testing with a real screen reader. Record those hands-on tests separately.",
        ],
        table: {
          headers: ["Engine", "Automated tests cover", "Test by hand"],
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
      {
        id: "development-tools",
        title: "Development package compatibility",
        body: [
          "The headless devtools store and test recorder work with the public core contracts. The optional browser overlay has React peers, and the optional matcher entry has a Vitest peer.",
        ],
        table: {
          headers: ["Package entry", "Peer range", "Use"],
          rows: [
            ["@generative-a11y/devtools", "Core workspace dependency", "Headless bounded diagnostic store"],
            ["@generative-a11y/devtools/overlay", "React and React DOM ^19.0.0", "Browser trace explorer"],
            ["@generative-a11y/test", "Core workspace dependency", "Record and replay normalized events"],
            ["@generative-a11y/test/vitest", "Vitest ^4.1.10", "Optional semantic matchers"],
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
      "Learn how package versions, supported framework ranges, deprecations, and upgrades work.",
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
          "Framework adapters are supported only with the versions listed in their peer dependency ranges. A new framework version can change the public events an adapter receives even when generative-a11y has not changed.",
        ],
        bullets: [
          "Review the compatibility matrix before upgrading a framework peer.",
          "Pin framework versions when your app depends on exact adapter behavior.",
          "Send core events directly when a framework does not report an event your app needs.",
        ],
      },
      {
        id: "package-contracts",
        title: "Package contracts are checked before publication",
        body: [
          "Release validation inspects package exports, declaration files, provenance-ready metadata, packed contents, dependency boundaries, and installability. Public entry points must resolve from the package users install.",
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
        title: "Each release check answers a different question",
        body: [
          "A release runs code checks, browser tests, package validation, and a validator for hands-on screen-reader test records. Passing one check does not replace the others.",
        ],
        table: {
          headers: ["Check", "What it covers", "Limit"],
          rows: [
            ["Repository check", "Types, builds, unit behavior, rendered docs", "Code and runtime behavior"],
            ["Browser matrix", "Keyboard, focus, semantics, page updates", "Browser behavior only"],
            ["Package validation", "Exports, tarballs, installability", "Files received by package users"],
            ["Screen-reader test record", "A dated, hands-on workflow", "One named setup"],
          ],
        },
      },
      {
        id: "migration-checklist",
        title: "Migration checklist",
        body: [
          "Upgrade one package area at a time. Check runtime output first, then test in browsers and with the screen readers you support.",
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
        title: "Deprecations remain documented",
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
      "Understand what the library can confirm, what it cannot see, and what still needs hands-on screen-reader testing.",
    keywords: ["limitations", "unsupported", "screen reader spoke", "planned", "experimental"],
    sections: [
      {
        id: "what-tests-prove",
        title: "What automated tests prove",
        body: [
          "Core tests check which updates the runtime prepares and when. Adapter tests check how framework events are translated. DOM and browser tests check page structure and updates. None can confirm what a specific screen reader spoke or what a person heard.",
        ],
        note: "Test with real browsers and screen readers before release.",
      },
      {
        id: "unsupported",
        title: "Unsupported by design",
        body: [
          "generative-a11y does not replace semantic HTML, keyboard support, focus management, visible status messages, or dialogs. It cannot read private framework state, run remote code, guarantee screen-reader speech, or guess missing events from page text.",
        ],
        bullets: [
          "No general assistant-ui retry or connection event",
          "No general AI SDK retry event unless your app reports the retry",
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
      "See what each generative-a11y package does and how the project keeps integrations small and reliable.",
    keywords: ["project", "packages", "architecture", "validation", "overview"],
    sections: [
      {
        id: "packages",
        title: "A focused package family",
        body: [
          "Each package has one job: decide what to announce, update the browser, connect React, or connect an AI framework. Install only what your app needs.",
        ],
        table: {
          headers: ["Package", "Purpose", "What it does not depend on"],
          rows: [
            ["core", "Policy, scheduling, segmentation", "No DOM or framework dependency"],
            ["dom", "Browser delivery, focus, attention, preferences", "No React or AI framework dependency"],
            ["react", "Provider and host-element bindings", "Leaves the visual interface unchanged"],
            ["ai-sdk", "useChat lifecycle translation", "Public state and callbacks only"],
            ["assistant-ui", "Thread runtime translation", "getState and subscribe only"],
            ["ag-ui", "Protocol lifecycle translation", "Documented subscriber callbacks only"],
            ["devtools", "Bounded redacted diagnostics and a trace explorer", "No application content or runtime control"],
            ["test", "Deterministic event replay and semantic assertions", "No browser or speech claims"],
          ],
        },
      },
      {
        id: "validation",
        title: "Test each part at the right level",
        body: [
          "Runtime, adapter, browser, and hands-on screen-reader tests answer different questions. Keeping them separate prevents anyone from mistaking an automated transcript for what a person heard.",
        ],
      },
    ],
  },
  {
    path: "/project/contributing",
    group: "Project",
    title: "Contributing",
    description:
      "Contribute focused changes with tests, clear documentation, stable events, and clean package responsibilities.",
    keywords: ["contributing", "development", "tests", "pull request", "pnpm check"],
    sections: [
      {
        id: "workflow",
        title: "Development workflow",
        body: [
          "Use the Node version in .nvmrc, install repository dependencies, add tests for exported behavior, and run the full repository check before requesting review.",
        ],
        code: {
          language: "shell",
          value: "corepack enable\npnpm install --frozen-lockfile\npnpm check\npnpm test:browser:install\npnpm test:browser",
        },
        walkthrough: [
          { label: "Enable the package manager", description: "Corepack selects the pnpm version declared by the repository." },
          { label: "Install dependencies", description: "pnpm restores the exact workspace dependency graph from the lockfile." },
          { label: "Run repository checks", description: "pnpm check covers formatting, lint, types, package builds, unit behavior, and rendered documentation." },
          { label: "Install browser engines", description: "Playwright uses pinned Chromium, Firefox, and WebKit binaries for repeatable fixtures." },
          { label: "Run browser checks", description: "pnpm test:browser checks keyboard behavior, focus, structure, and browser updates." },
        ],
      },
      {
        id: "review",
        title: "Review expectations",
        body: [
          "Keep core independent of browsers, DOM independent of React and AI frameworks, and adapters small. Never claim that an automated transcript or page update proves what a screen reader spoke.",
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
