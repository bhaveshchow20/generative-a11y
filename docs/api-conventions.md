# API conventions and developer experience

Research and implementation review: 6 September 2026. Audience: library
contributors and developers integrating generative-a11y.

The API should explain what a developer owns, what a call does, and how to stop
it. Shorter spelling is useful only while those distinctions remain clear. The
package supplies context; the symbol supplies its role. A host application keeps
its framework, translation system, components, and lifecycle ownership.

## What established projects demonstrate

These are observations from official documentation, followed by project-specific
judgments. They are not proof that one spelling produces better usability, or a
claim that all OSS projects follow the same conventions.

| Source                                                                                                                                        | Observed pattern                                                                                                          | Application here                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [TanStack Query quick start](https://tanstack.com/query/latest/docs/framework/react/quick-start)                                              | `QueryClient`, `QueryClientProvider`, and `useQueryClient` preserve the domain noun across creation, context, and access. | Keep `Runtime`, `A11yProvider`, and `useRuntime` explicit. Avoid branded constructors and generic `use()` or `create()`.                                     |
| [Zustand createStore](https://zustand.docs.pmnd.rs/reference/apis/create-store) and [reference](https://zustand.docs.pmnd.rs/reference/index) | A standalone store has `getState` and `subscribe`; React and vanilla have separate entry points.                          | Keep core framework-independent, use explicit `/react` adapter entry points, and make ownership of stores distinct from subscriptions.                       |
| [Radix introduction](https://www.radix-ui.com/primitives/docs/overview/introduction)                                                          | Related component parts share a predictable API and can be adopted into existing interfaces.                              | Keep integration names consistent across adapters. Do not build a competing visual component system or rename upstream APIs.                                 |
| [Floating UI useInteractions](https://floating-ui.com/docs/useinteractions)                                                                   | Prop getters compose event handlers; callers must preserve composition rather than overwrite handlers.                    | Our attention hook supplies only refs, so call it `useAttentionRefs`. Do not imply that it merges props, adds roles, or manages keyboard interaction.        |
| [React custom hooks](https://react.dev/learn/reusing-logic-with-custom-hooks)                                                                 | Hooks use `use` plus a capitalized purpose; component names start with capitals.                                          | Hooks describe the resource or observation: `useRuntime`, `useAttention`, `usePreferences`. Hook examples run inside components, not at module scope.        |
| [i18next API](https://www.i18next.com/overview/api)                                                                                           | Translation functions require initialized resources; fixed-language functions can be obtained with `getFixedT`.           | Accept existing synchronous translation functions after host initialization. Do not add resource loading, language detection, or another translation engine. |
| [Zod error customization](https://zod.dev/error-customization#internationalization)                                                           | Locale identifiers such as `en` appear in a locale context, and user translation functions can customize output.          | `en` is clear inside `core/messages`; default English needs no import. Keep the complete `Messages` configuration distinct from its `MessageMap`.            |
| [Redux Toolkit configureStore](https://redux-toolkit.js.org/api/configureStore)                                                               | The constructor is named for its role and provides defaults plus deliberate customization.                                | `createRuntime()` works without an empty options object. Options remain explicit when changing policy, time, messages, or callbacks.                         |
| [Node package exports](https://nodejs.org/api/packages.html#subpath-exports)                                                                  | An export map defines supported entry points and encapsulates other paths.                                                | Test the actual packed root and subpath imports in ESM, CommonJS, and TypeScript; source imports alone are insufficient.                                     |
| [TypeScript declaration guidance](https://www.typescriptlang.org/docs/handbook/declaration-files/do-s-and-don-ts.html)                        | Optional parameters and callback signatures must reflect actual invocation semantics.                                     | Export named option types and preserve precise callbacks and discriminated events. Do not shorten types into `any` or add overloads solely for appearance.   |

Framework-specific verification also checked the public
[AI SDK useChat API](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat) and
[assistant-ui ThreadRuntime](https://www.assistant-ui.com/docs/api-reference/runtimes/thread-runtime).
AI SDK exposes snapshot state and terminal callbacks as separate inputs;
assistant-ui exposes runtime subscriptions. Our adapters retain that distinction
instead of offering misleading parity. Documentation can be newer than installed
peers: compatibility claims remain bounded by the repository's installed types,
fixtures, and published peer ranges.

All sources above were accessed on the review date. AI SDK's page could not be
read through the research browser's Markdown response handler; its official HTML
was retrieved and inspected instead. No secondary popularity rankings, forum
anecdotes, or unsupported usability statistics informed these decisions.

## Naming rules

| Category                       | Convention                                                    | Examples                                                                |
| ------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Packages                       | One responsibility per package; lowercase kebab-case          | `@generative-a11y/core`, `@generative-a11y/ai-sdk`                      |
| Optional integrations          | Explicit subpaths; no private deep imports                    | `core/messages`, `core/testing`, `ai-sdk/react`, `devtools/overlay`     |
| Factory functions              | `create` plus the created resource                            | `createRuntime`, `createAnnouncer`, `createChatObserver`, `createStore` |
| Wiring existing resources      | `bind` plus the source being connected                        | `bindRuntime`, `bindThread`, `bindAgent`, `bindAttention`               |
| Visible development UI         | `mount` plus the mounted object                               | `mountOverlay`                                                          |
| Subscriptions                  | `subscribe` returns an unsubscribe function                   | `subscribeAnnouncements`, `store.subscribe`                             |
| End of ownership               | Idempotent `dispose()` on owned resources                     | runtime, observer, announcer, binding, overlay                          |
| Pure conversions               | Name the transformation, validation, or comparison            | `resolvePolicy`, `normalizeAdapterCopy`, `samePreferences`              |
| React                          | Capitalized components; `use` plus purpose for hooks          | `A11yProvider`, `useAttentionRefs`                                      |
| Types                          | PascalCase; role plus `Options` or `Props` where applicable   | `RuntimeOptions`, `AnnouncerOptions`, `A11yProviderProps`               |
| Descriptive values             | camelCase; compact identity inside an explicit module         | `adapterInfo`, `presets`, `en`                                          |
| Events                         | Entity plus observed lifecycle fact; explicit identity fields | `response.started`, `step.completed`, `responseId`, `runInstanceId`     |
| Configuration                  | Name the capability, not its implementation layer             | provider `delivery`, runtime `messages`, adapter `copy`                 |
| Callbacks                      | `on` plus the reported fact; distinguish layers               | core `onDiagnostic`, browser `onDelivery`, core `onDeliveryError`       |
| Files and documentation routes | lowercase kebab-case; match public symbol meaning             | `create-runtime.mdx`, `bind-thread.mdx`                                 |

Use `Props` only for React props, not as a container around one ref. Generic
names are acceptable when their package or receiver makes the domain
unambiguous. `createStore` in the devtools package creates its diagnostic store;
callers can use ordinary import aliases when another store factory is in scope.
We do not add namespace wrapper objects or a new facade simply to avoid
JavaScript aliases.

Keep useful domain terms such as `AnnouncementPolicy`, `AnnouncementIntent`, and
`RuntimeEvent`. Removing every shared prefix would collapse distinct concepts
into ambiguous `Policy`, `Event`, or `State`. Keep meaningful lifecycle names
and versioned serialization types; naming cleanup is not permission to invent
new framework evidence or alter scheduling semantics.

## Decisions beyond spelling

### Default setup and ownership

`createRuntime()` uses English and the balanced policy. It prepares announcement
intents; `bindRuntime(runtime)` owns browser delivery and borrows the runtime.
`A11yProvider` owns its default runtime and delivery, or borrows an explicitly
supplied runtime. Observers borrow the runtime. Subscriptions do not own it.
Documentation shows cleanup at removal of the chat surface, not directly after
synchronous event dispatch. A completed response can still have scheduled
notices.

### Attention refs are optional

`useAttentionRefs()` returns `composerRef`, `conversationRef`, and
`newestResponseRef`. These are callback refs for existing `HTMLElement`s,
including input, textarea, and editable host elements. They register
observations; they do not implement semantic props, automatic focus, or an
accessible chat UI. Keep them out of the minimum announcement setup. Compose
existing host refs with the host framework's own utility when needed.

### Delivery has one path

`delivery` configures the React provider's browser output. `onDelivery` reports
what that output path did, whereas core `onDiagnostic` reports scheduling
choices. Devtools examples attach to that active callback instead of creating a
second unconnected announcer. `auto` chooses supported notification delivery
with fallback; `live-region` deliberately uses live regions. The former
`aria-notify` input mode duplicated `auto` and is removed. `aria-notify` remains
an observed `DeliveryResult.method`, not a promise that speech occurred.

### Translation remains host-owned

`Messages` contains `id`, `locale`, and a complete `messages` map. `MessageMap`,
`MessageParams`, and `MessageKey` describe that map; `AdapterCopy` describes the
copy an adapter can safely add. This explicit complete map prevents silent
mixing of English fallback fragments into another language. The host supplies
translation quality and resource readiness. Configuration errors identify known
field paths or missing documented keys, never echo supplied values.

### Framework fidelity remains explicit

`adapterInfo` describes each adapter's existing evidence. The AI SDK example
creates callback composition before `useChat` and observes its snapshot
afterward. It does not wrap or replace `useChat`. Retry/regenerate detection
that lacks reliable evidence remains unavailable; docs do not instruct users to
reconstruct private adapter IDs. There is no new cross-framework lifecycle
abstraction.

## First-contact review and corrections

An independent developer review started at README and the public guides without
reading implementation history. It attempted vanilla setup, React/AI SDK setup,
translation, testing, debugging, and cleanup. This is an agent-assisted expert
walkthrough, not a study of human onboarding or real assistive technology.

| Observed failure or confusion                                            | Implemented correction                                                 | Verification                                                                         |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Vanilla quickstart disposed immediately, yielding no transcript          | Teardown is an exported function called when the chat is removed       | Actual example delivers completion before teardown in a DOM test                     |
| “Complete” AI SDK snippet had unbound variables and no provider/delivery | Complete component and provider example; endpoint and ownership stated | Typechecked source, exact documentation-copy test, mounted integration test          |
| Adapter copy instructions pointed at the wrong module                    | Use `core/messages` consistently                                       | Packed TypeScript consumers and import checks                                        |
| Devtools example created unused live regions                             | Wire `onDelivery` into the active binding                              | Actual example records a `dom-delivery` entry                                        |
| Attention “bindings” suggested semantic behavior                         | Explicit optional `useAttentionRefs` and direct callback fields        | Existing registration, replacement, SSR, and ownership tests plus consumer coverage  |
| Two delivery modes performed the same operation                          | Remove the redundant requested mode                                    | Unsupported mode rejected before allocating regions; browser fallback tests retained |
| `clear()` could be mistaken for runtime reset                            | Document recorder transcript-only clearing                             | Existing recording behavior retained; independent sessions create new recorders      |
| Invalid translation setup did not identify the field                     | Bounded, value-free field-specific errors                              | Missing-key, locale, ID, and adapter-copy regression checks                          |

## Keeping the API and documentation aligned

[The reviewed inventory](api-inventory.json) records every exported value, type,
and direct declaration signature for every public package entry point.
`scripts/api-inventory.mjs` derives it from the built export maps and TypeScript
declarations; the inventory test flags changed export names or direct
declaration signatures. Changes to referenced upstream types or runtime behavior
still require typechecking, consumer tests, and review. The inventory is an
audit artifact, not a second implementation of the APIs.

The runnable sources in `examples/consumer-journeys` are typechecked as part of
`pnpm check`. Tests require their complete code to appear in the corresponding
README and website examples, then exercise the real packages. Package smoke
continues to install packed artifacts under ESM, CommonJS, and strict TypeScript
resolution modes. Manual review still covers intent, ownership, and fidelity;
generated lists and green tests cannot establish those by themselves.

This pre-1.0 update makes direct breaking changes with no deprecated aliases, as
requested. The stability guide contains the full migration mapping. No package
publication or assistive-technology support claim follows automatically from
this work. Future API additions should follow these conventions and pass the
same consumer review, rather than repeatedly renaming the existing surface.
