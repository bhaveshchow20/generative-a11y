# Implementation plan

## Phase 0 — product and architecture

Status: foundational decisions complete; public documentation continues to
evolve with later phases.

- Repository rules and product boundaries.
- Event model, accessibility policy, package graph and testing strategy.
- Tooling, support and release decisions.

## Phase 1 — core runtime

Status: complete for the current core package slice.

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

Status: **in progress**. The deterministic DOM and React slices are implemented
and independently reviewed. Real-browser execution, the integration example, and
manual AT verification remain incomplete; Phase 2 as a whole is not yet
complete.

- Implemented DOM delivery: `ariaNotify()` progressive enhancement, stable
  polite/assertive regions, runtime binding, and deterministic jsdom coverage.
- Implemented DOM support APIs: [attention observations](attention-model.md),
  conservative focus helpers, and [preference storage](preference-storage.md).
- Documented [browser fallbacks](browser-support.md) and
  [DOM integration decisions](dom-integration-decisions.md).
- Implemented React work: provider/hooks, runtime ownership, ref-only bindings,
  Strict Mode behavior, SSR/hydration, preference persistence, and Testing
  Library coverage. The provider remains a thin lifecycle layer and does not
  render host UI.
- Remaining browser work: Chromium, Firefox, and WebKit Playwright fixtures plus
  axe scans. See [testing strategy](testing-strategy.md). These dependencies are
  intentionally kept in the follow-up browser stack until the fixture is ready.
- Remaining assistive-technology work: execute and publish dated results from
  the [manual AT test plan](manual-at-test-plan.md).

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
