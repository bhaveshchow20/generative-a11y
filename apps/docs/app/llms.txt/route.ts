import { getSourceManifest } from "../../lib/source-manifest";
import {
  absoluteUrl,
  NPM_SCOPE_URL,
  PROJECT_AUTHOR_NAME,
  PROJECT_AUTHOR_URL,
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

export async function GET() {
  const manifest = await getSourceManifest();
  const pages = new Map(manifest.map((page) => [page.publicPath, page]));
  const links = importantPages
    .map((path) => {
      const page = pages.get(path);
      return page
        ? `- [${page.title}](${absoluteUrl(path)}): ${page.description}`
        : undefined;
    })
    .filter((entry): entry is string => Boolean(entry))
    .join("\n");

  const body = `# generative-a11y

> ${SITE_DESCRIPTION}

generative-a11y is an open-source TypeScript accessibility runtime for streaming AI responses and agent lifecycle events. It converts documented application and framework state into paced announcement intents and browser live-region updates. It does not replace semantic HTML, keyboard support, focus design, or testing with real assistive technology.

## Key facts

- Author and maintainer: [${PROJECT_AUTHOR_NAME}](${PROJECT_AUTHOR_URL})
- License: MIT
- Maturity: pre-1.0; package stability is documented per package
- Evidence boundary: deterministic runtime and DOM tests do not prove what assistive technology spoke

## Documentation

${links}

## Complete documentation corpus

- [Full documentation as plain text](${absoluteUrl("/llms-full.txt")}): Server-rendered guides and API reference content in one machine-readable document.

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
