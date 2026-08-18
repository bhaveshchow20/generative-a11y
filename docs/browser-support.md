# Browser support and fallbacks

No browser or assistive-technology combination is declared supported until a
dated result is recorded from the [manual AT test plan](manual-at-test-plan.md).
Automated Chromium, Firefox, and WebKit results are structural evidence only;
Playwright WebKit is not branded Safari.

The repository's browser fixture runs against the pinned Playwright browser
versions in the lockfile. It verifies the React provider's pre-mounted regions,
forced live-region delivery, streamed completion behavior, focus preservation,
and host-interface axe results. These checks are CI evidence for DOM behavior,
not a browser/AT support claim.

## Announcement delivery

`DOMAnnouncementMode` controls one announcer instance:

| Mode          | Behavior                                                                 |
| ------------- | ------------------------------------------------------------------------ |
| `auto`        | Try callable `ariaNotify()`; otherwise mutate the selected live region   |
| `aria-notify` | The same progressive behavior; absence still falls back to a live region |
| `live-region` | Never call `ariaNotify()`; always mutate the selected live region        |

`ariaNotify()` is a progressive enhancement because MDN marks it
[limited availability](https://developer.mozilla.org/en-US/docs/Web/API/Element/ariaNotify).
On success, normal priority is used for polite intents and high priority for
assertive intents; fallback region text is left unchanged. If the accessor or
call throws, that notifier is disabled for the announcer. The current intent is
mutated into its live region once, and all later intents stay on the fallback
path.

When a document is available, the announcer synchronously creates an isolated
polite/assertive pair or adopts the host's supplied pair. Regions are stable and
configured with `aria-live`, `aria-atomic="true"`, and
`aria-relevant="additions text"`. Delivery applies or clears `lang` before the
notification, inserts the announcement as literal text, and replaces region text
even when two consecutive strings are identical. Supplied regions must remain
exposed by their ancestors and external CSS.

ARIA politeness is not a speech contract. WAI-ARIA describes it as an ordering
mechanism that user agents and assistive technologies may override
([`aria-live`](https://www.w3.org/TR/wai-aria-1.2/#aria-live)). A successful
`ariaNotify()` call or live-region mutation proves only that the library used
the API or changed the DOM. It cannot prove that speech occurred, in what voice,
or in what final order.

Without a document or mountable root, delivery returns `"unavailable"`. After
disposal it returns `"disposed"`. Neither status changes focus.

## Focus boundaries

Focus helpers are explicit host actions. They use public DOM focus APIs with
`preventScroll: true` by default, verify the deepest active element, and return
a finite focused/skipped result. They do not query host selectors, create focus
traps, or run automatically during streaming.

Open shadow roots are traversed through nested `activeElement` values.
Eligibility and guard containment follow assigned slots and cross open shadow
roots through their hosts, so hidden, `aria-hidden="true"`, or inert composed
ancestors reject focus. Closed shadow roots intentionally expose only their
host; internal focus cannot be captured or verified through the platform's
public surface.

Platform focusability still varies with browser and operating-system settings;
for example, the
[`activeElement` documentation](https://developer.mozilla.org/en-US/docs/Web/API/Document/activeElement)
notes platform-dependent focus behavior. Layout, computed CSS, tab order, and
actual AT navigation therefore remain browser/manual test responsibilities.

## Intersection evidence

The attention store uses a native Intersection Observer or an injected factory.
If the API is absent, construction/observation fails, or no target is
registered, the snapshot preserves the distinction:

- no current target: `"unobserved"`;
- target without usable observer evidence: `"unknown"`;
- observer entry: `"visible"` or `"outside"` from `isIntersecting`.

There is no “assume visible” fallback. Intersection state is also not evidence
that a screen-reader user has navigated to or read the target. See the
[attention model](attention-model.md).

## Storage

Browser persistence is opportunistic and opt-in. If `localStorage` access is
unavailable or throws, the preference store remains in memory. Native
cross-document events follow the platform's storage-event behavior; there is no
same-tab broadcast. See [preference storage](preference-storage.md).
