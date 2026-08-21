# generative-a11y

[![CI](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Accessible AI, without rebuilding your interface.**

`generative-a11y` is a framework-independent accessibility layer for streaming
AI and agent interfaces. It translates existing lifecycle state into paced,
prioritized announcement intents for screen readers while leaving the host
application's visual UI alone.

> [!IMPORTANT] This project is in pre-1.0 development. Packages publish under
> the `@generative-a11y` npm scope, beginning with the first functional release
> at version 0.1.0. External assistive-technology validation remains in
> progress.

[Core API](packages/core/README.md) · [DOM API](packages/dom/README.md) ·
[React API](packages/react/README.md) · [Architecture](docs/architecture.md) ·
[Events](docs/events.md) · [Accessibility policy](docs/accessibility-policy.md)
· [Framework adapters](docs/framework-adapters.md) ·
[Contributing](CONTRIBUTING.md)

## Why generative-a11y?

AI interfaces create accessibility problems that ordinary component libraries do
not solve: responses stream incrementally, tools run for uncertain periods, and
agents can pause for approval or fail mid-task. Sending every token to a live
region is noisy; moving focus on routine status changes is disruptive.

This project provides the orchestration layer between AI lifecycle events and
accessible delivery:

- **Meaningful announcements:** segment streaming text into useful units instead
  of announcing tokens.
- **Agent-aware status:** represent tool progress, approvals, retries,
  connection changes, citations, and terminal states.
- **Predictable behavior:** prioritize, deduplicate, coalesce, and bound queued
  work with injected time for deterministic tests.
- **Framework independence:** keep accessibility policy in the core and make
  adapters translate documented public framework state.
- **Honest fidelity:** declare missing lifecycle evidence instead of guessing,
  and keep automated transcripts distinct from real assistive-technology tests.

## How it fits

```text
AI SDK / AG-UI / assistant-ui / custom application state
                         │
                    thin adapter
                         │
                         ▼
              normalized lifecycle events
                         │
                         ▼
           @generative-a11y/core runtime
        segment · prioritize · dedupe · schedule
                         │
                         ▼
              announcement intents
                         │
                    DOM driver
                         │
                         ▼
              assistive technology
```

The core never touches the DOM and never claims that assistive technology spoke
an announcement. That boundary keeps policy portable and delivery testable in
the environment where it actually runs.

## What it is and what it is not

| generative-a11y is                                       | generative-a11y is not                                   |
| -------------------------------------------------------- | -------------------------------------------------------- |
| An accessibility behavior layer for existing AI UIs      | A chat interface or visual component library             |
| A normalized event model for streaming and agent state   | An agent framework, model SDK, or transport protocol     |
| Policy and scheduling for announcement intents           | A replacement for semantic HTML, keyboard, or focus work |
| Infrastructure designed for adapter and DOM integrations | Proof that a specific screen reader announced content    |

## Ecosystem

| Source                    | Intended integration                                        | Status                                                                                |
| ------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Custom applications       | Dispatch events to core and deliver through the DOM package | Implemented; core/DOM browser fixture complete; manual AT validation pending          |
| Custom React applications | Wrap the existing tree with the provider and hooks          | Implemented; deterministic React checks complete; browser/AT validation pending       |
| [AG-UI][ag-ui]            | Translate protocol events through a thin adapter            | Implemented; deterministic and package checks complete; browser/AT validation pending |
| [AI SDK][ai-sdk]          | Observe documented chat state and lifecycle callbacks       | Implemented; deterministic and package checks complete; browser/AT validation pending |
| [assistant-ui][aui]       | Subscribe to documented runtime and message state           | Implemented; deterministic and package checks complete; browser/AT validation pending |
| [CopilotKit][copilotkit]  | Reuse its public AG-UI agent surface where fidelity allows  | AG-UI guidance; no duplicate adapter package                                          |

[ag-ui]: https://github.com/ag-ui-protocol/ag-ui
[ai-sdk]: https://github.com/vercel/ai
[aui]: https://github.com/assistant-ui/assistant-ui
[copilotkit]: https://github.com/CopilotKit/CopilotKit

## Core and DOM example

Install the framework-independent runtime and browser delivery packages:

```sh
npm install @generative-a11y/core @generative-a11y/dom
```

Then connect the runtime to the DOM without replacing the application's visual
interface:

```ts
import { createGenerativeA11y } from "@generative-a11y/core";
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
runtime.dispose();
```

See [`@generative-a11y/core`](packages/core/README.md) for the runtime contract
and [`@generative-a11y/dom`](packages/dom/README.md) for delivery, attention,
focus, and preference APIs.

## Principles

- Keep your existing UI.
- Announce meaningful units, not tokens.
- Never guess lifecycle events an adapter cannot observe.
- Make timing deterministic and inspectable.
- Treat real screen-reader testing as a release requirement, not a unit-test
  claim.

## Development

Use the Node.js version in `.nvmrc` and install dependencies from the lockfile:

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm check
pnpm test:browser:install
pnpm test:browser
```

`pnpm check` verifies formatting, linting, types, tests with coverage,
production builds, package metadata, and ESM/CommonJS loading.
`pnpm test:browser` runs the focused accessibility fixture in Chromium, Firefox,
and WebKit with axe scans; it does not claim screen-reader output.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Security
issues should follow the private reporting process in
[SECURITY.md](SECURITY.md).

## Community

- [Request a feature or integration](https://github.com/bhaveshchow20/generative-a11y/issues/new?template=feature_request.yml)
- [Report a bug](https://github.com/bhaveshchow20/generative-a11y/issues/new?template=bug_report.yml)
- [Share an assistive-technology test result](https://github.com/bhaveshchow20/generative-a11y/issues/new?template=assistive_technology_report.yml)
- [Get support](SUPPORT.md)

## License

[MIT](LICENSE)
