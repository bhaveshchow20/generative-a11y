# Implementation plan

## Phase 0 — product and architecture

Status: in progress in the initial pull request.

- Repository rules and product boundaries.
- Event model, accessibility policy, package graph and testing strategy.
- Tooling, support and release decisions.

## Phase 1 — core runtime

Status: in progress in the initial pull request.

- Normalized events and lifecycle state.
- Injectable/manual clocks.
- Streaming sentence and paragraph segmentation.
- Prioritized scheduler, deduplication, coalescing, cancellation and bounded
  queues.
- Four presets.
- Recorder and diagnostic decisions.
- Comprehensive deterministic tests and independent review.

Acceptance: no DOM/React dependencies; chunk-boundary, punctuation, stale epoch,
concurrency, cleanup and preset coverage; format, lint, typecheck, tests and
build all pass.

## Phase 2 — DOM and React

- `ariaNotify()` progressive enhancement and stable polite/assertive live
  regions.
- React provider and hook, DOM bindings, attention inputs, conservative focus
  helpers and preferences.
- jsdom and cross-browser integration tests, followed by independent review.

## Phase 3 — adapters

Implement and review separately: AG-UI, AI SDK, assistant-ui, then CopilotKit v2
only if code beyond the AG-UI adapter is warranted. Each ships a mapping table,
fixtures, compatibility range, fidelity declaration and example.

## Phase 4 — testing package and devtools

- Replay, recorder facade, matchers, fixtures and diagnostic inspector.
- Explanations use stable reason codes from core.

## Phase 5 — documentation and examples

- Site inspired by the clarity and live-example structure of leading AI UI
  libraries without copying visual identity.
- Identical visible UI before/after; transcript, event timeline, policy switcher
  and stop/retry/tool/interaction scenarios.
- Message: **Keep your interface. Add the accessibility runtime.**

Every phase ends with formatting, lint, typecheck, tests, build, package
inspection, independent review and fixes before the next phase begins.
