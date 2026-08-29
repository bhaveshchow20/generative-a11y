export type HomeCardSize = "sm" | "md" | "wide";

export interface HomeFeature {
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly code: readonly string[];
  readonly evidence: string;
}

export interface HomeIntegration {
  readonly name: string;
  readonly packageName: string;
  readonly href: string;
  readonly fidelity: string;
}

export interface HomePackage {
  readonly name: string;
  readonly role: string;
  readonly href: string;
}

export const asyncFeatures = [
  {
    eyebrow: "01 / stream",
    title: "Streaming stays useful",
    description:
      "Buffer incomplete text, pace meaningful segments, and flush only when the observed response completes.",
    code: ["response.started", "response.text.delta", "response.completed"],
    evidence: "Bounded scheduling prevents every token from becoming an update.",
  },
  {
    eyebrow: "02 / tools",
    title: "Tool work has a lifecycle",
    description:
      "Translate confirmed starts, meaningful progress, completion, and failure into one normalized event stream.",
    code: ["tool.started", "tool.progress", "tool.completed | tool.failed"],
    evidence: "Progress is reported only when the host exposes a real value.",
  },
  {
    eyebrow: "03 / focus",
    title: "Focus remains user-owned",
    description:
      "Streaming, tool progress, and ordinary status changes do not move focus. Explicit interaction patterns can capture and restore it deliberately.",
    code: ["captureFocus()", "restoreFocus()", "preventScroll: true"],
    evidence: "The invoked control remains the active element during this page’s demo.",
  },
  {
    eyebrow: "04 / schedule",
    title: "Announcements are scheduled",
    description:
      "Policies coalesce duplicates, bound queued work, and prioritize user-relevant status over noisy intermediate updates.",
    code: ["queued", "merged | suppressed", "announced | cancelled"],
    evidence: "Deterministic clocks make timing policy testable without claiming AT behavior.",
  },
] as const satisfies readonly HomeFeature[];

export const integrations = [
  {
    name: "Core / DOM",
    packageName: "@generative-a11y/core + /dom",
    href: "/docs/getting-started",
    fidelity: "Direct normalized events and browser delivery.",
  },
  {
    name: "React",
    packageName: "@generative-a11y/react",
    href: "/api/react",
    fidelity: "Provider and hooks over the same framework-independent runtime.",
  },
  {
    name: "AI SDK",
    packageName: "@generative-a11y/ai-sdk",
    href: "/docs/integrations/ai-sdk",
    fidelity: "Maps documented message parts and chat status.",
  },
  {
    name: "assistant-ui",
    packageName: "@generative-a11y/assistant-ui",
    href: "/docs/integrations/assistant-ui",
    fidelity: "Maps documented messages, tools, and approvals.",
  },
  {
    name: "AG-UI",
    packageName: "@generative-a11y/ag-ui",
    href: "/docs/integrations/ag-ui",
    fidelity: "Maps public protocol lifecycle callbacks and stable IDs.",
  },
] as const satisfies readonly HomeIntegration[];

const npm = "https://www.npmjs.com/package";

export const publishedPackages = [
  { name: "core", role: "Runtime, policies, scheduling, and diagnostics.", href: `${npm}/@generative-a11y/core` },
  { name: "dom", role: "Browser announcement delivery and focus utilities.", href: `${npm}/@generative-a11y/dom` },
  { name: "react", role: "React provider, hooks, and runtime bindings.", href: `${npm}/@generative-a11y/react` },
  { name: "ai-sdk", role: "Adapter for documented Vercel AI SDK state.", href: `${npm}/@generative-a11y/ai-sdk` },
  { name: "assistant-ui", role: "Adapter for assistant-ui lifecycle state.", href: `${npm}/@generative-a11y/assistant-ui` },
  { name: "ag-ui", role: "Adapter for the public AG-UI protocol.", href: `${npm}/@generative-a11y/ag-ui` },
  { name: "devtools", role: "Development-only diagnostics and redacted traces.", href: `${npm}/@generative-a11y/devtools` },
] as const satisfies readonly HomePackage[];
