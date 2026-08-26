import { getDocPage } from "../../lib/content";
import {
  absoluteUrl,
  NPM_SCOPE_URL,
  REPOSITORY_URL,
  SITE_DESCRIPTION,
} from "../../lib/site";

const importantPages = [
  "/docs/getting-started",
  "/docs/why-generative-a11y",
  "/docs/screen-readers-and-streaming-ai",
  "/docs/aria-live-and-generative-ai",
  "/docs/accessible-ai-agents",
  "/docs/architecture",
  "/docs/integrations/ai-sdk",
  "/docs/integrations/assistant-ui",
  "/docs/integrations/ag-ui",
  "/docs/integrations/custom",
  "/docs/devtools",
  "/docs/testing/replay",
  "/docs/testing",
  "/api",
  "/api/devtools",
  "/api/core/testing",
] as const;

export function GET() {
  const links = importantPages
    .map((path) => {
      const page = getDocPage(path);
      return page
        ? `- [${page.title}](${absoluteUrl(path)}): ${page.description}`
        : undefined;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");

  const body = `# generative-a11y

> ${SITE_DESCRIPTION}

generative-a11y is an open-source TypeScript accessibility runtime for streaming AI responses and agent lifecycle events. It converts documented application and framework state into paced announcement intents and browser live-region updates. It does not replace semantic HTML, keyboard support, focus design, or testing with real assistive technology.

## Documentation

${links}

## Supported integrations

- React applications
- Vercel AI SDK accessibility through @generative-a11y/ai-sdk
- assistant-ui through @generative-a11y/assistant-ui
- AG-UI and compatible CopilotKit v2 agents through @generative-a11y/ag-ui
- Framework-neutral JavaScript and TypeScript through @generative-a11y/core and @generative-a11y/dom

## Development tools

- Bounded redacted runtime diagnostics and the Accessibility Trace Explorer through @generative-a11y/devtools
- Versioned event recording, ManualClock replay, and opt-in Vitest matchers through @generative-a11y/core/testing

## Project links

- [GitHub repository](${REPOSITORY_URL})
- [npm packages](${NPM_SCOPE_URL})
- [Interactive lifecycle examples](${absoluteUrl("/examples/lifecycle-lab")})
`;

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
