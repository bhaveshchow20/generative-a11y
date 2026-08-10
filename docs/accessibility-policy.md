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

| Preset            | Text                                   | Tools                               | Lifecycle                            |
| ----------------- | -------------------------------------- | ----------------------------------- | ------------------------------------ |
| `minimal`         | Full response at completion            | Failures only                       | Interactions, errors, stop           |
| `balanced`        | Completed sentences                    | Start if slow; completion/failure   | Meaningful lifecycle changes         |
| `verbose`         | Completed sentences with shorter delay | Start, progress, completion/failure | Detailed lifecycle changes           |
| `completion-only` | Full response at completion            | Silent                              | Response failure and completion only |

All presets are policy objects and can be overridden. Policy affects what the
runtime emits; it cannot guarantee what a browser/screen-reader combination
speaks.

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
  as experimental progressive enhancement. Scheduling, coalescing and fallback
  regions remain necessary.
- Detect or allow opt-out when the host already announces the same lifecycle to
  prevent duplicate speech.

## Attention and focus

Visibility, DOM focus and scroll position are heuristic policy inputs; none
reveals a screen-reader virtual cursor. Hidden/scrolled-away modes may coalesce
details into a short summary. Ordinary response, tool, completion and
non-actionable error updates never move focus. A host application's accessible
modal interaction may move and restore focus according to the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Stopping can cancel the library's unannounced queue, but cannot reliably retract
speech already delivered to assistive technology.
