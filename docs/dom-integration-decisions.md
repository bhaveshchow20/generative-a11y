# DOM integration decisions

Decision review date: **2026-08-09**. Links below point to standards or primary
project documentation. They support the design decision; they are not an
evergreen browser-support claim.

## Decision summary

The DOM runtime stays small and framework-independent. It builds narrowly around
platform APIs, accepts injection at browser boundaries, and adds no production
UI or focus-management dependency. The only third-party additions accepted for
this slice are test tools that provide a distinct evidence layer.

| Area                      | Decision                                                                          | Reason                                                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ariaNotify()`            | Use when callable, then retain live-region fallback                               | MDN labels the API limited availability; a production-only path would exclude unsupported combinations.                                                                                   |
| ARIA live regions         | Build two stable, atomic regions                                                  | The required surface is a few attributes and literal text replacement. A general announcer dependency would duplicate core scheduling and obscure ownership.                              |
| Page Visibility           | Read `document.visibilityState` and subscribe to `visibilitychange`               | Native evidence is sufficient; any other state becomes `"unknown"`.                                                                                                                       |
| Intersection Observer     | Use the native API or an injected factory                                         | It provides asynchronous intersection evidence. Absence or failure becomes `"unknown"`, not optimistic visibility.                                                                        |
| Focus and `activeElement` | Build conservative explicit helpers                                               | The library needs reference capture, guarded restoration, composed-tree checks, and finite failure results—not a focus trap or component system.                                          |
| React external stores     | Reuse React's `useSyncExternalStore` in the React adapter                         | The DOM package implements its framework-neutral `subscribe`/snapshot contract; React owns subscription semantics and hydration integration.                                              |
| React Aria                | Do not add as a production dependency                                             | React Aria is designed for accessible components and hooks. This project preserves host UI and needs DOM helpers usable without React. Hosts may continue using React Aria independently. |
| Browser storage           | Use injected storage/events or guarded `localStorage` and native `storage` events | The required contract is two storage methods plus an event source. No database or state-management dependency is warranted.                                                               |
| Testing Library           | Accept as test-only tooling                                                       | Semantic queries and user-oriented interactions are valuable for the React integration; they do not prove AT speech.                                                                      |
| Playwright                | Accept as test-only tooling                                                       | Chromium, Firefox, and WebKit projects provide real-browser DOM, focus, visibility, and accessibility-tree evidence. WebKit is not branded Safari.                                        |
| axe-core                  | Accept through `@axe-core/playwright` as test-only tooling                        | It catches a useful subset of machine-detectable accessibility defects. It cannot validate announcement speech or complete WCAG conformance.                                              |

## Platform sources

- [`Element.ariaNotify()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify)
  documents normal/high priority and limited availability. The implementation
  therefore treats it as progressive enhancement, not a baseline.
- [WAI-ARIA 1.2 live-region properties](https://www.w3.org/TR/wai-aria-1.2/#aria-live)
  define polite/assertive ordering as a suggestion that user agents and AT may
  override.
  [WCAG technique ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19)
  illustrates a live container present before its update.
- The
  [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API)
  exposes document visibility, while the
  [Intersection Observer specification](https://www.w3.org/TR/intersection-observer/)
  defines intersection observations. Neither identifies user intent or a
  screen-reader virtual cursor.
- [`Document.activeElement`](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement)
  reports DOM focus and documents shadow-tree boundaries.
  [`HTMLElement.focus()`](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/focus)
  provides the `preventScroll` option used by explicit focus requests.
- React documents external-store subscription, snapshot caching, and server
  snapshots in
  [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore).
- The native
  [`storage` event](https://developer.mozilla.org/en-US/docs/Web/API/Window/storage_event)
  is delivered to other same-origin browsing contexts, not the window that made
  the write. This is why the preference store promises cross-tab native sync but
  no implicit same-tab bus.

## Library sources

- [React Aria](https://react-aria.adobe.com/getting-started) provides unstyled
  accessible components and hooks. That is useful host-app infrastructure, but
  broader than this package's non-visual DOM boundary.
- [Testing Library](https://testing-library.com/docs/) emphasizes semantic,
  user-oriented DOM queries. It is used for component behavior, not internal
  store implementation details.
- [Playwright browser projects](https://playwright.dev/docs/browsers) cover
  Chromium, Firefox, and WebKit. Its
  [ARIA snapshots](https://playwright.dev/docs/aria-snapshots) describe
  accessibility-tree structure, not spoken output.
- [Playwright's accessibility guidance](https://playwright.dev/docs/accessibility-testing)
  integrates `@axe-core/playwright` and explicitly recommends combining
  automation with manual and inclusive testing. The primary
  [axe-core project](https://github.com/dequelabs/axe-core) likewise returns
  automated violations and incomplete cases rather than a conformance verdict.

## Dependency consequence

`@generative-a11y/dom` depends on core and browser platform APIs only. React,
React Aria, Testing Library, Playwright, and axe-core do not enter its
production bundle. The DOM stack adds only jsdom for deterministic DOM tests.
Testing Library will be added with the React stack, while Playwright and
axe-core will be added with the browser-integration stack described in
[testing strategy](testing-strategy.md); they are not dependencies of the DOM
stack merely because later phases plan to use them.
