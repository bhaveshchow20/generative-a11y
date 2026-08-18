# Testing strategy

## Evidence layers

| Layer                    | What it proves                                                                       | What it does not prove                           | Status                |
| ------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------------- |
| Core transcript          | Policy, order, timing, cancellation, reason codes                                    | Browser or screen-reader delivery                | Implemented           |
| jsdom DOM/API contract   | Attributes, mutations, API selection, stores, focus results, cleanup                 | Browser accessibility tree or speech             | Implemented           |
| React component contract | Provider/hook ownership, external-store subscription, Strict Mode, SSR/hydration     | Real-browser or AT behavior                      | Implemented           |
| Browser integration      | Chromium/Firefox/WebKit DOM, focus, visibility, storage, accessibility-tree behavior | Branded Safari or exact speech                   | Planned               |
| axe-core                 | Machine-detectable issues in rendered fixtures                                       | Complete WCAG coverage or speech                 | Planned               |
| Manual AT                | Observed output and workflow behavior in one dated configuration                     | All versions, settings, or universal conformance | Planned, not executed |

The boundary is deliberate: a delivered core intent, successful `ariaNotify()`
call, live-region mutation, ARIA snapshot, or zero axe violations never proves
that a screen reader spoke the expected phrase.

## Deterministic core tests

Core uses an injected clock with deterministic same-time ordering. Tests never
sleep. `dispose()` clears every owned timer. Fixtures cover:

- sentences and paragraphs split at every chunk boundary;
- quotes, parentheses, abbreviations, initials, decimals, currency, versions,
  URLs, email, Markdown, and non-Latin punctuation;
- stop, retry identity rotation, reused IDs, and late stale deltas;
- slow/fast and parallel tools, progress coalescing, interactions, errors,
  reconnect, and citations;
- golden transcripts for all presets;
- bounded queues and zero timers after terminal events or disposal.

Property-oriented invariants include chunk invariance, bounded deduplication, no
old-epoch delivery, assertive-before-due-polite ordering, and one completion
flush.

## Deterministic DOM tests

Vitest and jsdom test observable contracts without pretending to emulate an
accessibility bridge:

- synchronous mount, supplied/owned region lifecycle, polite/assertive
  selection, locale timing, literal unsafe text, and repeated identical text;
- `ariaNotify()` success, absence, throwing accessor/call, permanent fallback,
  and serializable diagnostics;
- runtime binding ownership, subscription failure, reentrant disposal, stale
  delivery prevention, and multiple isolated runtimes;
- visibility, window focus, composer/conversation focus, Intersection Observer
  present/absent/stale records, cached snapshots, listener mutation, and
  cleanup;
- focus capture/restore, `preventScroll`, eligibility, guards, cross-document
  rejection, open shadow roots, slots, disabled fieldsets, and hostile DOM
  boundaries;
- every preference enum and core mapping, initial storage variants, canonical
  writes, failures, external-event filters, corruption, reentrancy, SSR, and
  disposal.

DOM code owns no clocks or timers. Observer and browser boundaries are injected
or stubbed rather than controlled by sleeps.

## React tests

The React slice uses React Testing Library and `useSyncExternalStore` through
the public provider/hooks. The current fixture runs React 19.2.8 and the
published peer range also covers React 18.2. It covers default and external
runtime ownership, hooks inside/outside a provider, Strict Mode mount/remount
cleanup, rerenders and configuration changes, SSR/hydration, multiple providers,
pre-commit writes, preference failures, cross-realm defaults, attention updates,
and ref-only bindings. Semantic queries are preferred over implementation-state
inspection. These tests prove React contracts, not browser speech.

## Real-browser tests

The next browser stack will run the same focused fixture in Chromium, Firefox,
and WebKit. WebKit results are not reported as Safari results
([Playwright browsers](https://playwright.dev/docs/browsers)). Cover:

- region mount and mutation order, repeated text, locale, and literal text;
- feature-detected `ariaNotify()` versus forced fallback;
- Page Visibility and window focus transitions where the runner can control them
  deterministically;
- composer/conversation focus, explicit focus helpers, open shadow roots, and
  slot traversal;
- Intersection Observer absence/presence and viewport transitions;
- localStorage loading, cross-page storage events, cleanup, and hydration;
- accessibility-tree structure through targeted
  [ARIA snapshots](https://playwright.dev/docs/aria-snapshots).

Run Chromium, Firefox, and WebKit in CI. Keep a smaller Chromium smoke shard for
pull-request latency only if the full matrix remains a required merge or nightly
gate. Pin tool/browser versions in CI artifacts so a result can be reproduced.

`@axe-core/playwright` scans the rendered example after each meaningful UI
state, not the isolated visually hidden announcer alone. Axe findings are
triaged as violations or incomplete/manual-review items. Follow Playwright's
[accessibility guidance](https://playwright.dev/docs/accessibility-testing):
automation complements manual assessment.

## Realistic stream fixture

One shared synthetic conversation should drive browser, React, and manual tests:

1. focus begins in the composer;
2. an assistant response streams sentence fragments and a paragraph boundary;
3. one fast tool suppresses its delayed start and one slow tool reports status;
4. a repeated polite phrase and an assertive actionable failure are delivered;
5. locale changes between utterances;
6. stop cancels pending text, retry creates a new response epoch, and a stale
   delta arrives for the old epoch;
7. the newest response moves outside and back inside the viewport;
8. an explicit host interaction captures/restores focus while ordinary updates
   leave focus unchanged.

The fixture exposes deterministic event and DOM logs. Manual testers record AT
output separately; the fixture never derives a “spoken” result from its logs.

## Packaging and CI

Package smoke tests import ESM and require CommonJS, and packed conditional
exports/declarations are inspected. Static gates include formatting, ESLint,
strict TypeScript, unit coverage, builds, publint, and package smoke tests.

Browser binaries and axe add CI cost and should be cached by exact lockfile/tool
version. Browser artifacts include traces and screenshots only on failure.
Automated AT tooling is not currently a release gate; it requires a pinned,
maintained runner and still would not replace the
[manual AT matrix](manual-at-test-plan.md).
