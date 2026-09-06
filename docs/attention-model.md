# Attention model

`createAttentionStore()` exposes conservative browser observations through an
`ExternalStore<AttentionSnapshot>`. These are raw signals for a host or the
React integration. They are not core policy decisions, proof that content was
read, or a model of user intent. `useGenerativeA11yAttention()` subscribes with
React's `useSyncExternalStore` and preserves the stable server snapshot during
SSR and hydration.

## Snapshot fields

Snapshots are frozen and cached by value. Repeated `getSnapshot()` calls return
the same object until a field changes.

| Field            | Values                                                                     | Evidence                                                                                |
| ---------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `visibility`     | `"visible"`, `"hidden"`, `"unknown"`                                       | `document.visibilityState`; other values and read failures are unknown                  |
| `windowFocus`    | `"focused"`, `"blurred"`, `"unknown"`                                      | callable `document.hasFocus()` plus window focus/blur events                            |
| `focusArea`      | `"composer"`, `"conversation"`, `"elsewhere"`, `"none"`, `"unknown"`       | `document.activeElement` compared with registered DOM areas                             |
| `newestResponse` | `"visible"`, `"outside"`, `"unobserved"`, `"unknown"`                      | current response target and Intersection Observer evidence                              |
| `mode`           | `"foreground"`, `"background"`, `"reading-history"`, `"away"`, `"unknown"` | conservative derivation from visibility, window focus, and newest-response intersection |

`focusArea` uses actual DOM focus. A focused descendant counts as belonging to a
registered area, and composer wins if composer and conversation registrations
overlap. `body`, `documentElement`, or no active element maps to `"none"`;
another focused element maps to `"elsewhere"`. This store does not follow a
screen-reader virtual cursor.

`newestResponse` has one current target. A later registration replaces the old
one, including a new registration of the same element. The final matching entry
in an observer callback is used. Registration epochs prevent queued callbacks
from an old target or observer from changing the current snapshot.

## Derived mode

Derivation is ordered and deliberately requires positive evidence:

| Evidence                                      | `mode`              |
| --------------------------------------------- | ------------------- |
| `visibility === "hidden"`                     | `"background"`      |
| visible and `windowFocus === "blurred"`       | `"away"`            |
| visible, focused, and newest response outside | `"reading-history"` |
| visible, focused, and newest response visible | `"foreground"`      |
| Any missing required evidence                 | `"unknown"`         |

`focusArea` is retained in every snapshot but does not currently participate in
mode derivation. In particular, `"reading-history"` means only that the document
is visible and focused while the registered newest response is outside the
observer intersection. It does not establish what the user is reading.

## Fallbacks and server behavior

- Without a document, client and server snapshots are the same all-`"unknown"`
  object. Registration, subscription, and disposal are inert safe no-ops.
- With a document and no newest-response target, `newestResponse` is
  `"unobserved"`.
- With a target but no usable Intersection Observer, it is `"unknown"`; the
  store never assumes visibility.
- `getServerSnapshot()` is always the stable all-`"unknown"` snapshot.
- Throwing visibility, focus, observer construction, observation, or cleanup
  boundaries degrade to unknown evidence or suppressed cleanup errors.

The underlying APIs have narrower meanings than “attention”: Page Visibility
reports document visibility, Intersection Observer reports target intersection,
and `activeElement` reports DOM focus. See the
[DOM decision record](dom-integration-decisions.md) for sources.

## Registration and cleanup

Composer and conversation registrations are reference-counted; each returned
unregister function is idempotent. Newest response registration is replaceable,
not aggregated. Multiple stores are isolated.

Subscribers present at a transition are called at most once from a stable
listener snapshot, and one listener's error cannot stop the rest. `dispose()` is
idempotent: it clears registrations and subscribers, removes document/window
listeners, and disconnects the observer. Stale callbacks become no-ops.
Subscribing or registering after disposal throws for a document-backed store.

The store uses no timers and never focuses or scrolls anything. The React
provider owns an attention store only when it creates one; an injected store is
borrowed and remains host-owned after unmount.

## Policy boundary

Core does not inspect browser globals. `bindAttentionToRuntime()` forwards the
store's initial and changed mode as serializable `attention.changed` events. The
bridge borrows both objects, rejects competing bridges for one runtime, and
clears observed attention to unknown on disposal. It never clears a user
override or disposes a borrowed object. The store stays observation-only.

Core's optional `policy.attention` is disabled by default. Enabling it uses
`quietWhen: ["background"]` unless the host supplies another list. `away` and
`reading-history` require explicit opt-in; `unknown` and `foreground` are never
automatic quiet triggers. `attention.override` selects `auto`, `normal`, or
`quiet`, independently of later observations. Controls are runtime-wide and
reject entity attribution, including partial attempt IDs.

Quiet mode discards response text and routine starts/progress. It preserves
base-policy-enabled terminal, failure, interaction, connection, citation, and
retry notices with their original channels. It cannot enable a notice disabled
by the selected preset and is not a global mute switch.

Pending routine candidates and response flush timers are cancelled. Lifecycle
tracking continues and the host's response stays available for review. No
transcript is deferred for automatic catch-up. At most 256 UTF-16 code units of
boundary context are retained while discarding text; a sentence or paragraph
crossing the quiet interval is discarded. Completion-strategy responses that
lost text during quiet mode do not replay their full text after resumption.
Retry starts a fresh attempt. Minimal and completion-only disable the short
completion notice too, so a suppressed response can finish silently.

React's `attentionPolicy` prop explicitly enables forwarding, separately from
core `policy.attention.enabled`. Existing attention refs/hooks stay observation-
only by default. `useAttentionControl()` returns current
`{ observed, override, effective }` state and `setOverride()` for a host-owned
control. No visual control is rendered by the library. Provider options are
captured at mount; keyed replacement safely releases and reacquires the bridge.

`getDiagnosticSnapshot().attention` is cached and frozen when enabled.
`attention-updated` records transitions; `attention-quiet` explains discarded
output. Both controls work with core/testing recording and replay. Replay must
use matching policy and clock ordering. Devtools exposes redacted state and
reason codes, not reading behavior or AT output. See the
[core API](../packages/core/README.md#attention-aware-announcements) and
[React integration](../packages/react/README.md).
