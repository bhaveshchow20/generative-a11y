# React integration example

This is a deliberately small existing-interface fixture, not a chat component.
Run it with:

```sh
pnpm --dir examples/react-integration dev
```

The visible interface remains ordinary application markup. The provider adds
visually hidden polite/assertive infrastructure, while the example exposes a
diagnostic transcript and attention state so browser tests can verify
integration behavior. Real assistive-technology speech still requires the
[manual test plan](../../docs/manual-at-test-plan.md).
