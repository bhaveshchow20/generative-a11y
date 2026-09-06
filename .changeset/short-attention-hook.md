---
"@generative-a11y/react": minor
---

Rename `useGenerativeA11yAttentionControl` to `useAttentionControl`. The old
export is removed; update imports and call sites to the shorter name.

Rename `useGenerativeA11yBindings` to `useAttentionTargets` to describe its
purpose: registering composer, conversation, and newest-response elements for
attention observations. The old export is removed.
