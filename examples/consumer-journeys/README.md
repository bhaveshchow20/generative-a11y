# Consumer journeys

For an existing React + AI SDK application, the complete browser journey in
[`chat.tsx`](chat.tsx) needs two direct library dependencies:

```sh
npm install @generative-a11y/react @generative-a11y/ai-sdk
```

Prerequisites: Node.js 22+, `ai@7.0.x`, `@ai-sdk/react@4.0.x`, compatible
`react` and `react-dom` (`^18.2.0 || ^19.0.0`), and the SDK's `zod` peer
(`^3.25.76 || ^4.1.8` for the checked version). Your backend and transport must
already work. Pass your existing `useChat` options to `App`; it preserves
transport, composes finish/error callbacks, and retains other options.

`A11yProvider` owns runtime and browser delivery across responses. Its chat
child owns the adapter observer. Both clean up on unmount. The client directive
marks the React Server Components boundary. Preconstructed `Chat` instances need
callback composition at their own construction boundary instead.

The other journeys intentionally use different direct dependencies:

| Fixture       | Direct library packages   | Delivery                                       |
| ------------- | ------------------------- | ---------------------------------------------- |
| `chat.tsx`    | `react`, `ai-sdk`         | Provider-owned browser delivery                |
| `vanilla.ts`  | `core`, `dom`             | Explicit browser binding and teardown          |
| `observer.ts` | `core`, `ai-sdk`          | Deterministic intents only; no browser binding |
| `devtools.ts` | `core`, `dom`, `devtools` | Browser binding plus diagnostics               |

All short names above use the `@generative-a11y/` scope. The observer fixture
also imports the host `ai` package. Every directly imported package must be
declared, even if another package depends on it.

Run verification from the repository root:

```sh
pnpm build
pnpm exec vitest run tests/consumer/journeys.test.tsx
node tests/consumer/packed-onboarding.mjs
pnpm check
```

The packed check installs local archives outside the workspace with hoisting and
peer auto-installation disabled. Core and DOM are transitive only. It compiles
the exact chat fixture with strict NodeNext and Bundler resolution, checks the
client directive, and renders it on the server without browser globals. As in
the existing package smoke suite, the known upstream missing `json-schema`
declaration (TS7016) is reported separately. Declaration checks use TypeScript
`strict`; `exactOptionalPropertyTypes` is disabled there because the checked
upstream SDK declarations fail with that additional option. Repository consumer
checks still enable it with `skipLibCheck` as configured in the base tsconfig.
The runtime tests send public SDK transport streams through the complete example
and check callbacks, DOM delivery, focus preservation and unmount cleanup. These
checks do not establish real assistive-technology output.
