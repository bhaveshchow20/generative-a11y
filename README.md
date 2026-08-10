# generative-a11y

[![CI](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/ci.yml)
[![CodeQL](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml/badge.svg)](https://github.com/bhaveshchow20/generative-a11y/actions/workflows/codeql.yml)

Accessible AI, without rebuilding your interface.

`generative-a11y` is an accessibility runtime for streaming and agentic
applications. Framework adapters translate existing AI lifecycle state into
normalized events; the runtime turns those events into paced, prioritized, and
testable accessibility announcements.

This repository is in pre-release development. Phase 1 contains the
browser-independent core runtime. See
[the product specification](docs/product-spec.md) and
[implementation plan](docs/implementation-plan.md).

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
```

`pnpm check` verifies formatting, linting, types, tests with coverage,
production builds, package metadata, and ESM/CommonJS loading.

See [CONTRIBUTING.md](CONTRIBUTING.md) before proposing a change. Security
issues should follow the private reporting process in
[SECURITY.md](SECURITY.md).
