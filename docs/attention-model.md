# Attention model

`createAttentionStore()` exposes conservative browser observations through an
`ExternalStore<AttentionSnapshot>`. These are raw signals for a host or future
React integration. They are not core policy decisions, proof that content was
read, or a model of user intent.

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

The store uses no timers and never focuses or scrolls anything.

## Policy boundary

Core does not inspect browser globals. A host or React binding may translate an
attention snapshot into explicit core configuration or events at a defined
lifecycle boundary. That translation must remain conservative and testable; the
DOM store itself does not change announcement cadence or suppress output.
