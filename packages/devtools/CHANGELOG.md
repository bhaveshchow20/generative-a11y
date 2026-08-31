# @generative-a11y/devtools

## 0.1.1

### Patch Changes

- beaa7c7: Preserve workflow correlation through DOM delivery, keep redacted run
  and step snapshots, and expose hierarchy, attempts, and terminal state in the
  optional trace inspector.
- 0512916: Declare workflow fidelity across adapters and map documented AG-UI
  0.0.59 run, subagent, partial step, tool, response, and interaction ownership
  into the normalized hierarchy.
- Updated dependencies [ca06bfa]
- Updated dependencies [0512916]
  - @generative-a11y/core@0.3.0

## 0.1.0

### Minor Changes

- 8bdf95d: Add the initial explicit, isolated browser diagnostics overlay with
  capture controls, keyboard dismissal, and focus restoration.
- 717350b: Expose safe event correlation fields and explicit adapter evidence
  metadata to support causal diagnostic inspection without retaining application
  content.
- 649ea7a: Replace the dashboard workbench with a causal Accessibility Trace
  Explorer.

### Patch Changes

- c647cfc: Improve package descriptions, documentation links, and npm README
  navigation for accessibility and AI-interface discovery.
- 67d7b76: Add the initial bounded, redacted, development-only diagnostic store
  for runtime events, snapshots, DOM delivery correlation, and trace export.
- Updated dependencies [f2f3f47]
- Updated dependencies [c647cfc]
- Updated dependencies [153d595]
  - @generative-a11y/core@0.2.0
