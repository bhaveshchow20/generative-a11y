# Testing strategy

## Evidence layers

| Layer               | What it proves                                             | What it does not prove                |
| ------------------- | ---------------------------------------------------------- | ------------------------------------- |
| Core transcript     | Policy, order, timing, cancellation and reason codes       | Browser or screen-reader speech       |
| jsdom DOM contract  | Markup and mutation mechanics                              | Platform accessibility delivery       |
| Browser integration | Focus, visibility, scroll and accessibility-tree structure | Exact spoken timing/order             |
| Automated AT        | Observed phrases in a pinned AT/browser environment        | General usability or all combinations |
| Manual/user testing | Real workflow pacing and recovery                          | Universal conformance                 |

Core uses an injected clock with deterministic same-time ordering. Tests never
sleep. `dispose()` must clear every owned timer. The recorder exposes delivered
announcements and a diagnostic transcript with stable dispositions/reason codes.

## Phase 1 fixtures

- Sentences split at every chunk boundary.
- Quotes, parentheses, abbreviations, initials, decimals, currency, versions,
  URLs, email, Markdown and non-Latin punctuation.
- Paragraph boundaries, maximum-delay flush and completion fragments.
- Stop, retry identity rotation, reused response IDs and late stale deltas.
- Slow/fast tools, progress coalescing, parallel tools and response text.
- Interaction priority, errors, reconnect and citation deduplication.
- Golden transcripts for all presets.
- Stress tests for bounded queues and zero timers after completion/disposal.
- Package smoke tests load both ESM and CommonJS exports; conditional
  declaration paths are inspected during packing.

Property-oriented invariants include chunk invariance, one delivery per dedupe
window, no old-epoch delivery, assertive-before-due-polite ordering and exactly
one completion flush.

## Later phases

- jsdom tests pre-mounted regions, roles/properties, mutation ordering,
  singleton mounting and `ariaNotify()` feature detection. jsdom is not called a
  screen-reader test ([jsdom project](https://github.com/jsdom/jsdom)).
- Playwright covers Chromium, Firefox and WebKit behavior. ARIA snapshots verify
  semantic structure, not speech
  ([Playwright ARIA snapshots](https://playwright.dev/docs/aria-snapshots)).
  Playwright WebKit is not branded Safari
  ([browser docs](https://playwright.dev/docs/browsers)).
- Release-gate automation uses VoiceOver/macOS and NVDA/Windows through
  [Guidepup](https://github.com/guidepup/guidepup-playwright), serially on
  pinned dedicated runners.
- Manual release checks include actual Safari with VoiceOver, Chrome/Firefox
  with NVDA, and later JAWS, iOS VoiceOver and TalkBack before claiming support.

Automated checks find only some accessibility problems
([Playwright accessibility guidance](https://playwright.dev/docs/accessibility-testing)).
Releases publish exact tested versions and known issues, and periodically
include experienced disabled screen-reader users.
