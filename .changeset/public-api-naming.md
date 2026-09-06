---
"@generative-a11y/core": minor
"@generative-a11y/dom": minor
"@generative-a11y/react": minor
"@generative-a11y/ai-sdk": minor
"@generative-a11y/assistant-ui": minor
"@generative-a11y/ag-ui": minor
"@generative-a11y/devtools": minor
---

Breaking API naming cleanup for the pre-1.0 packages, with no deprecated
aliases.

Use createRuntime, Runtime, RuntimeOptions and RuntimeEvent in core. Import en,
Messages, MessageMap, MessageParams, MessageKey, AdapterCopy and
normalizeAdapterCopy from @generative-a11y/core/messages. Pass messages instead
of announcementCatalog; the diagnostic snapshot metadata field is also now
messages.

React uses A11yProvider and useA11y/useRuntime/useAttention/useAttentionControl/
usePreferences/useAttentionRefs. DOM uses createAnnouncer, bindRuntime and
bindAttention. Core testing/scheduling uses createRecorder and createScheduler.
AI SDK uses createChatObserver; assistant-ui uses bindThread. Devtools uses
createStore, mountOverlay. Associated types follow the new names, including
A11yExpect/A11yMatchers in core/testing. AG-UI's bindAgent stays unchanged; its
declarations now reference the renamed core types.

Update imports and configuration together using the API naming reference in the
stability guide. Lifecycle events, scheduling, ownership and delivery behavior
remain unchanged. English is still the default, and applications continue using
their existing translation systems.

Provider dom becomes delivery, with onDelivery for browser reports. Optional
useAttentionRefs returns composerRef/conversationRef/newestResponseRef callbacks
for host elements rather than ref-only props objects. Each adapter exports
adapterInfo and AdapterInfo. The redundant aria-notify requested delivery mode
is removed; use auto or live-region. Observed delivery method aria-notify is
unchanged. Invalid modes fail before allocating resources. Configuration errors
identify known paths and missing keys without exposing supplied values.

Complete onboarding examples now preserve pending announcements until actual
teardown and connect devtools to the active delivery path. Add a reviewed public
API inventory, checked consumer journeys, and research-backed conventions.
