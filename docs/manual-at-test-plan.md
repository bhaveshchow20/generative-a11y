# Manual assistive-technology test plan

Status: **planned, not yet executed**. This document defines release evidence;
it does not report support. Record exact OS, browser, assistive-technology, and
library versions with every run.

## Test matrix

| Platform | Browser                       | Assistive technology | Priority                               | Notes                                                                 |
| -------- | ----------------------------- | -------------------- | -------------------------------------- | --------------------------------------------------------------------- |
| macOS    | Safari                        | VoiceOver            | Required                               | Real Safari result; do not substitute Playwright WebKit               |
| macOS    | Chrome                        | VoiceOver            | Required                               | Confirms a second browser/accessibility bridge on macOS               |
| Windows  | Chrome                        | NVDA                 | Required                               | Test with a documented NVDA speech/viewer configuration               |
| Windows  | Firefox                       | NVDA                 | Required                               | Exercises a different Windows browser engine                          |
| Windows  | Chrome, and Edge if available | JAWS                 | Best effort before v0.1 support claims | Record unavailable combinations rather than inferring results         |
| Android  | Chrome                        | TalkBack             | Practical device check                 | Use a physical device when available; record device and Android build |

Run both the forced `live-region` path and progressive `auto` path. Test
`ariaNotify()` as its own path only when feature detection reports a callable
method in that exact browser. An unsupported API is an expected fallback case,
not a failed manual test.

## Fixture requirements

Use one stable page that exposes controls for:

- polite and assertive announcements;
- two consecutive identical messages;
- locale-tagged English, French, and one non-Latin-language sample reviewed by a
  speaker where possible;
- forced live-region mode, automatic progressive mode, and a test-only throwing
  notifier fixture;
- a composer, conversation history, newest response, unrelated focus target, and
  explicit focus capture/restore action;
- start, sentence streaming, completion, stop, retry, tool status, and failure
  events from a deterministic fixture.

The fixture must display a visual event log and `DOMDeliveryResult` without
changing the host page's focus. Do not expose test controls as part of the
announcement regions.

## Procedures

### Polite delivery and repeated text

1. Place DOM focus in the composer and note the AT's current focus/browse
   position.
2. Trigger one polite message and record whether, when, and how it is presented.
3. Trigger the identical message twice with a clear operator-controlled pause.
4. Confirm the visual log contains two deliveries and record whether AT presents
   zero, one, or two. Do not convert AT coalescing into a DOM failure.
5. Confirm DOM focus remains on the composer.

### Assertive delivery

1. Start a known longer polite utterance.
2. Trigger a short assertive, actionable message.
3. Record whether the polite utterance is interrupted, queued, resumed, or
   discarded.
4. Confirm focus remains unchanged and the assertive message did not open or
   emulate a dialog.

Assertive behavior varies by browser, AT, and user settings. The expected result
is a recorded observation, not identical interruption across the matrix.

### Locale

1. Trigger each locale-tagged utterance and inspect that `lang` is present on
   the selected delivery element before delivery.
2. Record language/voice switching, pronunciation problems, and whether behavior
   differs between `ariaNotify()` and live-region paths.
3. Trigger an utterance with no locale and confirm the driver removes its prior
   `lang` value.

A DOM `lang` assertion is deterministic. Correct pronunciation and voice
selection require this manual observation and a reviewer familiar with the
language.

### Progressive enhancement and fallback

1. Record whether `Element.prototype.ariaNotify` or the selected element exposes
   a callable method.
2. In `auto`, record the returned delivery method and observed AT output.
3. In forced `live-region`, repeat the same messages.
4. In the throwing-notifier fixture, confirm the current message uses the live
   region and later messages no longer call the notifier.
5. Compare missing, successful, and throwing API cases without treating
   `DOMDeliveryResult` as proof of speech.

### Focus preservation and explicit restoration

1. Keep focus in the composer while streaming text, tool statuses, completion,
   stop, retry, and non-actionable failure announcements run.
2. Confirm `document.activeElement`, the visible focus indicator, and AT focus
   do not move because of delivery.
3. Open a fixture interaction that intentionally captures focus, then invoke the
   explicit restore action. Record its `FocusResult` and observed focus.
4. Repeat after manually moving focus elsewhere; with an `onlyIfFocusWithin`
   guard, restoration must report skipped and preserve the later focus
   destination.
5. Where practical, repeat capture/restoration inside an open shadow root and
   record the closed-shadow limitation separately.

## Result record

For each matrix row, store:

- date, tester, hardware/device, OS build;
- browser name and exact version;
- AT name, exact version, speech settings, verbosity, and relevant modes;
- library commit or release;
- delivery path (`aria-notify` or `live-region`);
- scenario result: pass, fail, blocked, unavailable, or observation-only;
- exact observed phrase/order in the tester's own notes, focus outcome, and a
  minimal reproduction for failures;
- known issues and whether they reproduce without this library.

Avoid long copied speech transcripts in public issues when they contain private
application content. The fixture should use synthetic text.

## Automated versus manual evidence

Automated tests can prove intent order, API calls, DOM attributes, literal text
insertion, mutation count, locale timing, focus state, cleanup, accessibility
tree structure, and axe results. They cannot prove audible speech, interruption
behavior, pronunciation, user comprehension, virtual-cursor position, or
workflow usability.

Only the completed records above support a dated AT/browser statement. Even a
passing matrix does not establish WCAG conformance or behavior for untested
versions and user settings.

## Release evidence file

Store completed required results in `docs/assistive-technology-results.json`.
Set `sourceCommit` to the full commit tested before adding the evidence file.
Publishing verifies that this commit is an ancestor of the release and that no
repository content except the evidence file changed afterward. Evidence expires
after 30 days.

Each required matrix row must contain both `auto` and `live-region` paths. Each
path must pass these scenario identifiers: `polite-and-repeated-text`,
`assertive`, `locale`, `progressive-fallback`, `focus-preservation`, and
`realistic-stream`. The validator also requires exact environment metadata and
non-placeholder notes for every result. Run it locally with:

```sh
node scripts/assistive-technology-evidence.mjs \
  --file docs/assistive-technology-results.json \
  --source-commit <full-tested-commit-sha>
```

The JSON shape is:

```json
{
  "schemaVersion": 1,
  "sourceCommit": "0123456789abcdef0123456789abcdef01234567",
  "completedAt": "2026-08-20T23:30:00.000Z",
  "results": [
    {
      "platform": "macos",
      "browser": "safari",
      "assistiveTechnology": "voiceover",
      "testedAt": "2026-08-20T20:00:00.000Z",
      "tester": "Tester's name",
      "hardware": "Device model",
      "osVersion": "Exact OS version and build",
      "browserVersion": "Exact browser version",
      "assistiveTechnologyVersion": "Exact AT version",
      "settings": "Speech, verbosity, and navigation settings",
      "paths": [
        {
          "deliveryPath": "auto",
          "scenarios": [
            {
              "scenario": "polite-and-repeated-text",
              "status": "pass",
              "notes": "What the tester observed using synthetic fixture content"
            }
          ]
        }
      ]
    }
  ]
}
```

Repeat the row for all four required combinations, both delivery paths, and all
six scenarios. This abbreviated shape is documentation, not passing evidence.
