# Complete React lifecycle

[Chat.tsx](./Chat.tsx) connects two existing host operations to normalized
response, tool and interaction events. [Demo.tsx](./Demo.tsx) supplies a local
service simulation; it makes no network calls. It preserves ordinary native
textareas and buttons. No renderer or framework adapter is introduced.

Copy both files into an existing React app and render `<ReactLifecycleDemo />`,
or render `<App operations={yourExistingOperations} />`. `reply` must send only
new text through `onDelta`; resolving means the response is complete. `prepare`
reports normalized progress (0–1); resolving means the tool succeeded. Rejection
means failure. These are example host functions, not new generative-a11y APIs.

```sh
npm install @generative-a11y/react @generative-a11y/core react react-dom
```

React 19.2.8 is tested; the library peers support React 18.2 and React 19. React
alone brings core and DOM transitively. This example imports only React's
integration at runtime; install core directly for the `ManualClock` test import.
Install DOM directly only when importing its APIs. No unpublished announcement
catalog or attention-control API is required by this recipe.

The provider owns its runtime, DOM delivery and observers. Unmount the provider
with the chat when the session ends. The host aborts its pending work and guards
late callbacks; provider disposal discards remaining queued notices. Keep the
provider mounted after ordinary operation completion so scheduled notices have
time to reach the DOM. A borrowed runtime must be disposed by its creator after
disconnecting its consumers; this recipe uses the owned path.

This demo intentionally supports one request at a time. Each send has fresh IDs;
"Try again" starts a new response, not an inferred retry of a previous attempt.
Use real request IDs in your application when available. The decision only
selects/discards the prepared draft locally; it does not save or publish
anything. Host-visible strings and labels belong to the host translation system.
Generated notices use the provider's existing catalog configuration.

Run from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm exec vitest run examples/react-lifecycle/Chat.test.tsx
pnpm exec tsc -p examples/react-lifecycle/tsconfig.json
```

`pnpm check` includes these tests and compiles `Chat.tsx` against packed
packages in ESM, CJS and Bundler consumer checks with strict library checking.
The unrelated AI SDK smoke scenario retains its existing narrowly isolated
upstream json-schema declaration exception.

See the [complete guide](https://generativea11y.com/docs/react-lifecycle) for
scheduling, DOM queries and manual assistive-technology procedures. Tests verify
literal DOM changes and focus, not audible speech or screen-reader usability.
