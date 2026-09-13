# @generative-a11y/dom

## 0.3.0

### Minor Changes

- 6a499c7: Add opt-in attention-aware announcement control without replacing the
  runtime or changing the host interface. Quiet mode discards response text and
  routine starts/progress while preserving policy-enabled terminal and
  interaction notices. Explicit user overrides take precedence over conservative
  observations; resumption does not replay suppressed text.

  Add serializable attention control events, purpose-based queued cancellation,
  replay validation, a borrowed DOM attention bridge, React provider opt-in and
  control hook, and content-free devtools state. Existing behavior is unchanged
  by default. New event/reason union members may require updates to exhaustive
  TypeScript switches, and older replay readers cannot read the new event types.

- 05e6d61: Breaking API naming cleanup for the pre-1.0 packages, with no
  deprecated aliases.

  Use createRuntime, Runtime, RuntimeOptions and RuntimeEvent in core. Import
  en, Messages, MessageMap, MessageParams, MessageKey, AdapterCopy and
  normalizeAdapterCopy from @generative-a11y/core/messages. Pass messages
  instead of announcementCatalog; the diagnostic snapshot metadata field is also
  now messages.

  React uses A11yProvider and
  useA11y/useRuntime/useAttention/useAttentionControl/
  usePreferences/useAttentionRefs. DOM uses createAnnouncer, bindRuntime and
  bindAttention. Core testing/scheduling uses createRecorder and
  createScheduler. AI SDK uses createChatObserver; assistant-ui uses bindThread.
  Devtools uses createStore, mountOverlay. Associated types follow the new
  names, including A11yExpect/A11yMatchers in core/testing. AG-UI's bindAgent
  stays unchanged; its declarations now reference the renamed core types.

  Update imports and configuration together using the API naming reference in
  the stability guide. Lifecycle events, scheduling, ownership and delivery
  behavior remain unchanged. English is still the default, and applications
  continue using their existing translation systems.

  Provider dom becomes delivery, with onDelivery for browser reports. Optional
  useAttentionRefs returns composerRef/conversationRef/newestResponseRef
  callbacks for host elements rather than ref-only props objects. Each adapter
  exports adapterInfo and AdapterInfo. The redundant aria-notify requested
  delivery mode is removed; use auto or live-region. Observed delivery method
  aria-notify is unchanged. Invalid modes fail before allocating resources.
  Configuration errors identify known paths and missing keys without exposing
  supplied values.

  Complete onboarding examples now preserve pending announcements until actual
  teardown and connect devtools to the active delivery path. Add a reviewed
  public API inventory, checked consumer journeys, and research-backed
  conventions.

### Patch Changes

- d874164: Add typed announcement catalogs that reuse host translations and
  pluralization, plus optional localized copy for existing adapters.
  Runtime-generated sentences use their catalog language independently of answer
  text. Default English notices now explicitly carry `en`, correcting English
  messages previously tagged with a response's language. Timing, attention
  policy and lifecycle evidence stay intact.

  Validate and copy construction-time configuration, isolate formatter failures
  with generic English fallbacks, and expose content-free catalog metadata in
  diagnostics/devtools. Replay V1 is unchanged but requires the same catalog and
  configuration for reproduction. Exhaustive diagnostic-reason switches must
  handle `catalog-format-error`. This adds no translation engine or AT support
  claim.

  Default retry messages preserve an explicitly supplied attempt value of zero
  instead of treating it as missing.

- Updated dependencies [6a499c7]
- Updated dependencies [d874164]
- Updated dependencies [05e6d61]
  - @generative-a11y/core@0.4.0

## 0.2.1

### Patch Changes

- beaa7c7: Preserve workflow correlation through DOM delivery, keep redacted run
  and step snapshots, and expose hierarchy, attempts, and terminal state in the
  optional trace inspector.
- Updated dependencies [ca06bfa]
- Updated dependencies [0512916]
  - @generative-a11y/core@0.3.0

## 0.2.0

### Minor Changes

- f2f3f47: Expose versioned runtime diagnostics and correlate DOM delivery
  results with their originating announcements for development tooling.

### Patch Changes

- c647cfc: Improve package descriptions, documentation links, and npm README
  navigation for accessibility and AI-interface discovery.
- Updated dependencies [f2f3f47]
- Updated dependencies [c647cfc]
- Updated dependencies [153d595]
  - @generative-a11y/core@0.2.0

## 0.1.0

### Minor Changes

- 88f4e4e: Prepare the initial public release with a bounded accessibility
  runtime, DOM and React integrations, thin framework adapters, hardened package
  exports, and cross-browser accessibility fixtures.

### Patch Changes

- Updated dependencies [88f4e4e]
  - @generative-a11y/core@0.1.0
