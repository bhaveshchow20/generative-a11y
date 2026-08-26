# Discoverability operations

This guide records the public search surfaces, ownership tasks, and measurement
choices for generative-a11y. It contains no verification tokens or analytics
credentials.

## Canonical search-intent map

Each problem cluster points to one primary page. Supporting pages should link to
the primary page instead of repeating it.

| Search intent                                       | Canonical page                                                    |
| --------------------------------------------------- | ----------------------------------------------------------------- |
| AI accessibility and the purpose of generative-a11y | `https://generativea11y.com/docs/why-generative-a11y`             |
| Screen readers and streaming AI output              | `https://generativea11y.com/docs/screen-readers-and-streaming-ai` |
| ARIA live regions for generative AI                 | `https://generativea11y.com/docs/aria-live-and-generative-ai`     |
| Accessible AI agents, tools, and approvals          | `https://generativea11y.com/docs/accessible-ai-agents`            |
| Architecture and accessibility model                | `https://generativea11y.com/docs/architecture`                    |
| Vercel AI SDK accessibility                         | `https://generativea11y.com/docs/integrations/ai-sdk`             |
| assistant-ui accessibility                          | `https://generativea11y.com/docs/integrations/assistant-ui`       |
| AG-UI accessibility                                 | `https://generativea11y.com/docs/integrations/ag-ui`              |
| Debugging AI accessibility decisions                | `https://generativea11y.com/docs/devtools`                        |
| Deterministic accessibility replay testing          | `https://generativea11y.com/docs/testing/replay`                  |
| Package and symbol reference                        | `https://generativea11y.com/api`                                  |
| Runnable lifecycle behavior                         | `https://generativea11y.com/examples/lifecycle-lab`               |

## Search engine verification

The docs application reads verification values from deployment environment
variables. Keep the values out of source control.

- Set `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` to the content value supplied by
  Google Search Console for an HTML tag verification.
- Set `NEXT_PUBLIC_BING_SITE_VERIFICATION` to the content value supplied by Bing
  Webmaster Tools for its `msvalidate.01` tag.
- Prefer DNS verification when the account owner can edit DNS. DNS ownership
  survives application and hosting changes.

After deployment:

1. Add `https://generativea11y.com` as the canonical property in Google Search
   Console and Bing Webmaster Tools.
2. Complete ownership verification and confirm that each service sees the
   production hostname.
3. Submit `https://generativea11y.com/sitemap.xml` in both services.
4. Inspect the homepage, each concept guide, each integration page, the example,
   and the API index. Confirm that the selected canonical matches the inspected
   URL.
5. Review indexing coverage and crawl errors after the first crawl, then after
   releases that change navigation, metadata, or routes.
6. Review search queries and landing pages each month. Separate branded terms
   from problem searches such as “streaming AI accessibility” and “aria-live
   AI.”

## Measurement

Search Console and Bing Webmaster Tools provide the first useful measurement:
queries, impressions, clicks, indexed pages, and crawl problems. Start there.

The site does not add a client analytics dependency in this phase. If page-level
referrers and outbound GitHub or npm clicks become necessary, enable Cloudflare
Web Analytics through the hosting account and document its data retention and
consent treatment before deployment. Track aggregate visits to concept,
integration, example, and API routes. Avoid user identifiers, session replay,
cross-site profiles, and content captured from interactive examples.

## GitHub and social settings

Repository owners should use `https://generativea11y.com` as the website and a
description aligned with the root README. Upload `apps/docs/public/og.png` as
the GitHub social preview.

GitHub permits 20 topics. Keep package and problem terms with clear browse
value. Prefer `a11y`, `aria`, and `react` over broad terms such as `llm`,
`streaming`, or `typescript` if the topic limit requires replacements. Retain
integration terms for AI SDK, assistant-ui, and AG-UI.

## Content backlog

### Pages worth building next

1. Testing streaming AI interfaces with VoiceOver
2. Testing streaming AI interfaces with NVDA
3. Accessible approval requests and human-in-the-loop agent flows
4. Accessible error, stop, and retry behavior for AI responses

These pages can use existing runtime behavior and the current manual
assistive-technology evidence format. Publish them only after the examples and
test evidence support each statement.

### Future content opportunities

5. Reconnect and network-status announcements in AI chat
6. Accessible citations and source updates in generated answers
7. Accessibility considerations for generative UI
8. Choosing polite and assertive live-region updates for agent status
9. An accessibility QA checklist for AI agent interfaces
10. Diagnosing repeated live-region output in streaming applications
11. Stable identity patterns for concurrent responses and tools

Treat this list as an editorial queue. Do not publish thin pages to fill it, and
do not document lifecycle support before a public integration can observe it.
