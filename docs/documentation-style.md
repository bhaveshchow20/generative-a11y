# Writing documentation

Lead with what the reader can do, then show the smallest working example. Use
the native Fumadocs components already registered in
`apps/docs/mdx-components.tsx`. Keep the site’s existing layout and typography.

## Page structure

Integration guides should present installation, working integration, optional
recipes, compatibility, and next steps in that order. Keep prerequisites short
at the top and link to exact version ranges later. Put required instructions in
visible content; reserve accordions for optional explanations or
troubleshooting.

Reference pages should name the API, state its purpose in one sentence, and show
a minimal example. Document each option with its meaning, default, and a small
example when behavior is not obvious. Use tables for parallel choices. Link to
the integration guide instead of repeating the complete tutorial.

Avoid repeating a code sample as a prose walkthrough. Each paragraph should
answer the next integration question. Use concrete verbs such as “Import”,
“Connect”, and “Wrap”. Keep exception cases out of the first example.

## Native blocks

| Block                                         | Use                                                                                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Code fence with `title="components/chat.tsx"` | Show where code belongs; native highlighting and copy controls are automatic. Use `Terminal` for commands.                                    |
| `Tabs` / `Tab`                                | Offer equivalent alternatives, such as package-manager commands. Use explicit values and a shared `groupId` for the same choice across pages. |
| `Steps` / `Step`                              | Present a real sequence, with the relevant code inside each step. Do not add a second walkthrough repeating those steps.                      |
| `Callout`                                     | Surface one consequential constraint near the relevant example, such as runtime ownership. Avoid stacking caveats before the first example.   |
| `Cards` / `Card`                              | Offer a small set of useful next destinations, with descriptive titles.                                                                       |
| Native table or `TypeTable`                   | Compare supported versions, option defaults, or lifecycle evidence.                                                                           |

For example:

````mdx
```tsx title="components/chat.tsx"
const runtime = useRuntime();
```
````

Titles must describe the intended host file or the purpose of a fragment; they
must not imply that unrelated snippets should be pasted together unchanged. Only
add line highlights when they explain a specific change. Keep copied code free
of presentation markup and match examples to typechecked consumer fixtures.

## Accessibility and verification

Our guides explain an accessibility behavior layer. Preserve host UI and make
runtime, delivery, and observer ownership clear. Report only lifecycle evidence
an adapter can observe. Browser tests and deterministic output do not prove
assistive-technology speech.

Keep `searchableText`, heading anchors, and links synchronized with the rendered
page. Verify that tabs and copy controls work with the keyboard, long code
scrolls within its block on narrow screens, and filenames remain visible. Test
the installed Fumadocs version rather than assuming every feature on the latest
website is available locally.

## References

The following official pages informed these conventions:

- [AsyncAPI page reference](https://www.fumadocs.dev/docs/integrations/asyncapi/api-page):
  concise introductions and filename-labelled examples.
- [GraphQL server reference](https://www.fumadocs.dev/docs/integrations/graphql/server):
  option-oriented sections, alternatives, defaults, and comparison tables.
- [GraphQL setup](https://www.fumadocs.dev/docs/integrations/graphql):
  installation followed by ordered configuration and verification.
- [Markdown authoring](https://www.fumadocs.dev/docs/markdown): native cards,
  callouts, headings, and code metadata.
- [Code blocks](https://www.fumadocs.dev/docs/ui/components/codeblock),
  [tabs](https://www.fumadocs.dev/docs/ui/components/tabs), and
  [steps](https://www.fumadocs.dev/docs/ui/components/steps): supported block
  behavior.
