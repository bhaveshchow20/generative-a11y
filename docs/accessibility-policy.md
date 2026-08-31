# Accessibility policy

## Semantic separation

The visible conversation may use
[`role="log"`](https://www.w3.org/TR/wai-aria-1.2/#log) when its structure
genuinely represents an ordered appended log. It is not the streaming
announcement surface. Dedicated, pre-mounted announcers receive only prepared
utterances so an accumulated response is never reread on every token.

Normal streaming, tool and completion updates are polite. Assertive delivery is
reserved for truly urgent, actionable events because it can interrupt or discard
speech. [`status`](https://www.w3.org/TR/wai-aria-1.2/#status),
[`alert`](https://www.w3.org/TR/wai-aria-1.2/#alert) and modal dialogs remain
distinct host-UI mechanisms.

## Presets

| Preset            | Text                                   | Tools                               | Workflow hierarchy                                      |
| ----------------- | -------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `minimal`         | Full response at completion            | Failures only                       | Terminal runs; steps silent                             |
| `balanced`        | Completed sentences                    | Start if slow; completion/failure   | Terminal run summary; long-running top-level steps only |
| `verbose`         | Completed sentences with shorter delay | Start, progress, completion/failure | Run boundaries; identified steps and coalesced progress |
| `completion-only` | Full response at completion            | Silent                              | Runs and steps silent                                   |

All presets are policy objects and can be overridden. Policy affects what the
runtime emits; it cannot guarantee what a browser/screen-reader combination
speaks.

The `workflows` group keeps the hierarchy surface small: `runs` selects silent,
terminal-only or all boundaries; `steps` selects silent, long-running or all
identified boundaries; `announceStepAfterMs` sets the long-running threshold;
and progress/nested-step switches remain off in the balanced preset. Anonymous
step evidence stays silent because a label is not identity. Assertive delivery
is reserved for explicit response, step, and run failures plus urgent
interactions; routine concurrent updates remain polite and coalesced.

## DOM requirements for Phase 2

- Mount empty polite and assertive regions before their first update; keep them
  stable and accessibility-tree-visible. See
  [WCAG technique ARIA19](https://www.w3.org/WAI/WCAG22/Techniques/aria/ARIA19).
- Use atomic announcers containing only the prepared utterance. Never put an
  accumulating stream in an atomic region. See
  [`aria-atomic`](https://www.w3.org/TR/wai-aria-1.2/#aria-atomic).
- Use `aria-relevant="additions text"` conservatively.
- Do not use `aria-busy` as a generic thinking flag. It is incompatible with
  sentence streaming on the same subtree and must always be cleaned up.
- Treat
  [`ariaNotify()`](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify)
  as limited-availability progressive enhancement. Scheduling and coalescing
  remain in core, and stable fallback regions remain necessary.
- Hosts must not connect this delivery path alongside another system that
  announces the same lifecycle, which would risk duplicate speech.

The DOM layer inserts announcement strings as literal text, applies locale
before delivery, and replaces region content for repeated identical messages. A
`DOMDeliveryResult` reports an API call or DOM mutation; it is not confirmation
that assistive technology produced speech. See
[browser support and fallbacks](browser-support.md).

## Attention and focus

Document visibility, window focus, DOM focus and target intersection are
conservative inputs; none reveals a screen-reader virtual cursor or user intent.
The DOM attention store does not change policy itself. See the exact
[attention model](attention-model.md).

Ordinary response, tool, completion and non-actionable error updates never move
focus. A host application's accessible modal interaction may explicitly capture,
move and restore focus according to the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Guarded restoration must preserve a later user focus move.

Stopping can cancel the library's unannounced queue, but cannot reliably retract
speech already delivered to assistive technology.

## Preferences

Stored preferences are validated configuration for a future runtime construction
or replacement boundary. They never mutate or dispose an active runtime. Storage
is opt-in, corruption never becomes policy, and unavailable storage degrades to
memory-only behavior. See [preference storage](preference-storage.md).

## Verification claims

Deterministic transcript and DOM tests are required but cannot establish actual
speech, usability, or conformance. Browser/AT statements require dated manual
records from the [manual test plan](manual-at-test-plan.md); automated findings
remain a separate evidence layer in the [testing strategy](testing-strategy.md).
