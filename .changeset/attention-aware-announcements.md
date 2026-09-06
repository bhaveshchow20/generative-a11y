---
"@generative-a11y/core": minor
"@generative-a11y/dom": minor
"@generative-a11y/react": minor
"@generative-a11y/devtools": minor
---

Add opt-in attention-aware announcement control without replacing the runtime or
changing the host interface. Quiet mode discards response text and routine
starts/progress while preserving policy-enabled terminal and interaction
notices. Explicit user overrides take precedence over conservative observations;
resumption does not replay suppressed text.

Add serializable attention control events, purpose-based queued cancellation,
replay validation, a borrowed DOM attention bridge, React provider opt-in and
control hook, and content-free devtools state. Existing behavior is unchanged by
default. New event/reason union members may require updates to exhaustive
TypeScript switches, and older replay readers cannot read the new event types.
