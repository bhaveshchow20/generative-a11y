# Product specification

## Promise

**Accessible AI, without rebuilding your interface.**

`generative-a11y` adds screen-reader announcement orchestration, streaming
cadence, interruption handling, conservative focus behavior, attention-aware
policies and deterministic testing to an application's existing AI interface.

It is an enhancement layer, not a chat UI or component library. It does not ship
message renderers, composers, tool cards, approval dialogs, error cards, loaders
or styled preference panels.

## Users and jobs

- Application teams can add a supported adapter without replacing their design
  system.
- Framework authors can emit normalized events into a headless runtime.
- Accessibility engineers can select or customize a policy.
- Test authors can replay event fixtures and assert stable announcement
  decisions.

## v0.1 scope

1. Browser-independent core runtime and normalized event API.
2. DOM delivery with `ariaNotify()` progressive enhancement and stable
   live-region fallbacks.
3. React provider, hook, attention inputs, bindings and preference persistence.
4. Adapters for AI SDK, assistant-ui and AG-UI.
5. CopilotKit v2 support as a thin AG-UI integration if a separate package adds
   real value.
6. Recorder, matchers, event replay and a development inspector.
7. Integration examples and a polished documentation site.

## Success criteria

- A supported integration requires one provider, hook or adapter in its common
  path.
- The existing visible UI is unchanged.
- Streaming deltas become meaningful sentence or paragraph announcements.
- Stop, retry and replacement cannot leak stale queued output.
- Adapters declare lifecycle fidelity and never manufacture unsupported events.
- Automated tests distinguish policy decisions, DOM behavior and actual
  assistive-technology output.
- Releases publish a dated browser/assistive-technology support matrix rather
  than a blanket compliance claim.

## Non-goals

- A general WCAG toolkit or accessibility overlay.
- AI-generated alternative text or plain-language rewriting.
- Generic UI primitives.
- Automated certification of WCAG conformance.
- Reliably retracting speech already handed to assistive technology.
