---
"@generative-a11y/core": minor
"@generative-a11y/react": minor
"@generative-a11y/ai-sdk": minor
"@generative-a11y/assistant-ui": minor
"@generative-a11y/ag-ui": minor
"@generative-a11y/devtools": minor
"@generative-a11y/dom": patch
---

Add typed announcement catalogs that reuse host translations and pluralization,
plus optional localized copy for existing adapters. Runtime-generated sentences
use their catalog language independently of answer text. Default English notices
now explicitly carry `en`, correcting English messages previously tagged with a
response's language. Timing, attention policy and lifecycle evidence stay
intact.

Validate and copy construction-time configuration, isolate formatter failures
with generic English fallbacks, and expose content-free catalog metadata in
diagnostics/devtools. Replay V1 is unchanged but requires the same catalog and
configuration for reproduction. Exhaustive diagnostic-reason switches must
handle `catalog-format-error`. This adds no translation engine or AT support
claim.

Default retry messages preserve an explicitly supplied attempt value of zero
instead of treating it as missing.
