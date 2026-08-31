# Hierarchical workflow fixture

This deterministic Node example preserves a host application's UI by rendering
nothing. It dispatches one run with sequential and concurrent steps, a scoped
tool, approval interaction, optional failed step, and a step retry with a stale
old-attempt event. It prints the normalized events, resolved policy,
announcement transcript, redacted diagnostics, and hierarchical snapshot.

```sh
pnpm --filter @generative-a11y/example-hierarchical-workflow start
pnpm --filter @generative-a11y/example-hierarchical-workflow test
```

The transcript and deterministic runtime diagnostics demonstrate library
behavior. They do not prove what any assistive technology announced.
