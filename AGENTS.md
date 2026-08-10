# Repository instructions

`generative-a11y` is a plug-and-play accessibility enhancement layer for
existing AI interfaces. It is not a visual component library.

## Product boundaries

- Preserve the host application's visual interface.
- Put framework-independent accessibility behavior in `packages/core`.
- Keep DOM behavior independent of React and AI frameworks.
- Keep adapters thin: translate documented public framework state into
  normalized events.
- Do not infer lifecycle events when a framework does not expose reliable
  evidence. Declare reduced fidelity instead.
- Do not parse private or unstable framework APIs unless the integration is
  explicitly experimental.
- Ordinary streaming and status changes must never steal focus.
- Never claim that deterministic transcripts or DOM tests prove real
  assistive-technology behavior.

## Engineering rules

- Use strict TypeScript and preserve serializable public events and policies
  where practical.
- Inject time into scheduling logic. Core code must not call global timers
  directly except through `SystemClock`.
- Every exported API requires tests and documentation.
- Keep queues bounded and cancel all owned timers on terminal events and
  `dispose()`.
- Add a changeset for user-visible published-package changes after the first
  release.
- Run `pnpm check` before handing off a phase.

## Phase discipline

- Complete and independently review each phase before starting the next.
- Root configuration and cross-package integration remain primary-agent
  responsibilities.
- Subagents doing write-heavy work must have exclusive directory ownership.
- DOM, React, adapters, devtools, examples, and the docs application are not
  part of Phase 1.
