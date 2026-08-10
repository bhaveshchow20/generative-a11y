# `@generative-a11y/dom`

DOM announcement delivery for `@generative-a11y/core`. The package mounts or
adopts live regions without changing the host application's visible interface.
It reports DOM delivery actions; it does not claim that assistive technology
produced speech.

## Install

```sh
pnpm add @generative-a11y/core @generative-a11y/dom
```

## Connect a runtime

`connectRuntimeToDOM(runtime, options?)` creates a `DOMAnnouncer`, subscribes it
to a `GenerativeA11yRuntime`, and returns a `DOMRuntimeBinding`. Disposing the
binding unsubscribes and disposes the announcer, but never disposes the borrowed
runtime.

```ts
import { createGenerativeA11y } from "@generative-a11y/core";
import { connectRuntimeToDOM } from "@generative-a11y/dom";

const runtime = createGenerativeA11y({
  onAnnouncement: () => undefined,
});
const binding = connectRuntimeToDOM(runtime);

// Later:
binding.dispose();
runtime.dispose();
```

`DOMRuntimeBinding` exposes the connected `announcer` and an idempotent
`dispose()` method. Once disposed, the binding cannot mutate its regions even if
the runtime was already delivering an event. If subscription fails, any regions
created for the attempted binding are removed before the error is rethrown.

## Create an announcer directly

`createDOMAnnouncer(options?)` returns a `DOMAnnouncer`. When a document is
available, it synchronously mounts one polite and one assertive region before
returning. Each announcer owns an isolated pair. Without an injected or global
document it remains inert, so the module and constructor are safe in server
environments.

```ts
import { createDOMAnnouncer } from "@generative-a11y/dom";

const announcer = createDOMAnnouncer({ mode: "auto" });
const result = announcer.announce(intent);
announcer.dispose();
```

`DOMAnnouncer` provides:

- `announce(intent)`, which returns a `DOMDeliveryResult`.
- `getRegions()`, which returns the `DOMLiveRegions` pair or `undefined` when
  the DOM is unavailable.
- An idempotent `dispose()`. It removes regions created by the announcer and
  leaves supplied regions mounted. Later announcements report `disposed`.

## Options and modes

`DOMAnnouncerOptions` accepts:

- `document`: an injected `Document`. If omitted, creation uses a supplied
  region's owner document and then the current global document, when available.
- `mode`: a `DOMAnnouncementMode` of `"auto"`, `"aria-notify"`, or
  `"live-region"`. Both progressive-enhancement modes try a callable
  `ariaNotify` on the selected region and fall back when it is absent.
  `"live-region"` always uses text mutation.
- `regions`: a pre-mounted `DOMLiveRegions` pair with `polite` and `assertive`
  elements. Required live-region attributes and visually hidden inline styles
  are applied, accessibility-tree hiding is removed, and the elements remain
  owned by the caller. The two channels must use distinct elements.
- `onDiagnostic`: a callback invoked with the `DOMDeliveryResult` for each
  attempted announcement. Callback errors are isolated from delivery.

If `ariaNotify` throws, that notifier is disabled for the announcer. The same
intent is delivered once through live-region mutation, and later intents remain
on that fallback path.

## Delivery results

`DOMDeliveryResult` is serializable and contains:

- `status`: `"notified"`, `"mutated"`, `"unavailable"`, or `"disposed"`.
- `method`: `"aria-notify"`, `"live-region"`, or `"none"`.
- `channel`: the selected core announcement channel.
- `error`, when notifier invocation failed, with serializable `name` and
  `message` strings.

`DOMLiveRegions` contains the stable outer `polite` and `assertive` elements.
Live-region delivery sets or clears `lang` from the intent locale and replaces
the region's text content on every delivery, including repeated identical text.
Announcement strings are inserted as literal text, never HTML.
