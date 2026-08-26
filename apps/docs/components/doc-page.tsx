import Link from "next/link";
import type { ReactNode } from "react";

import type { DocPage } from "../lib/content";
import { DOC_PAGES } from "../lib/content";
import { ArchitectureFlow } from "./architecture-flow";
import { CodeBlock } from "./code-block";
import { SiteShell } from "./site-shell";
import { JsonLd } from "./json-ld";
import { createArticleJsonLd } from "../lib/seo";

export function DocPageView({ page }: { page: DocPage }) {
  const apiSection = page.path.startsWith("/api");
  const siblingPages = DOC_PAGES.filter((entry) => entry.path.startsWith("/api") === apiSection);
  const index = siblingPages.findIndex((entry) => entry.path === page.path);
  const previous = index > 0 ? siblingPages[index - 1] : undefined;
  const next = index < siblingPages.length - 1 ? siblingPages[index + 1] : undefined;
  const relatedPages = (page.related ?? [])
    .map((path) => DOC_PAGES.find((entry) => entry.path === path))
    .filter((entry): entry is DocPage => Boolean(entry));
  const docsRoot = page.path.startsWith("/api") ? "/api" : "/docs/getting-started";
  const docsRootLabel = page.path.startsWith("/api") ? "API" : "Docs";

  return (
    <SiteShell currentPath={page.path}>
      <JsonLd data={createArticleJsonLd(page)} />
      <main className="doc-main">
        <article className="doc-article">
          <nav className="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li><Link href="/">Home</Link></li>
              {page.path === docsRoot ? null : <li><Link href={docsRoot}>{docsRootLabel}</Link></li>}
              <li aria-current="page">{page.title}</li>
            </ol>
          </nav>
          <header className="doc-intro">
            <div className="doc-kicker">
              <span>{page.group}</span>
            </div>
            <h1>{page.title}</h1>
            <p>{formatInlineCode(page.description)}</p>
          </header>

          {page.sections.map((section) => (
            <section className="doc-section" id={section.id} key={section.id}>
              <h2><a href={`#${section.id}`}>{section.title}</a></h2>
              {section.body.map((paragraph) => <p key={paragraph}>{formatInlineCode(paragraph)}</p>)}
              {section.visual === "runtime-flow" ? <ArchitectureFlow /> : null}
              {section.bullets ? (
                <ul>{section.bullets.map((item) => <li key={item}>{formatInlineCode(item)}</li>)}</ul>
              ) : null}
              {section.table ? (
                <div className="table-wrap" role="region" aria-label={`${section.title} table`} tabIndex={0}>
                  <table>
                    <thead><tr>{section.table.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
                    <tbody>{section.table.rows.map((row) => (
                      <tr key={row.join(":")}>{row.map((cell, cellIndex) => <td key={`${cellIndex}:${cell}`}>{formatInlineCode(cell)}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : null}
              {section.code ? <CodeBlock language={section.code.language} value={section.code.value} /> : null}
              {section.walkthrough ? (
                <div className="code-walkthrough">
                  <h3>How this code works</h3>
                  <ol>{section.walkthrough.map((step, stepIndex) => <li key={step.label}><span>{String(stepIndex + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><p>{formatInlineCode(step.description)}</p></div></li>)}</ol>
                </div>
              ) : null}
              {section.api ? (
                <div className="api-reference">
                  <h3>Options and return values</h3>
                  <div className="api-list">{section.api.map((entry) => <details key={entry.name}>
                    <summary><code>{entry.name}</code><span>{entry.type}</span><b>{entry.requirement}</b></summary>
                    <div><p>{formatInlineCode(entry.description)}</p><dl><dt>Default</dt><dd><code>{entry.defaultValue}</code></dd></dl></div>
                  </details>)}</div>
                </div>
              ) : null}
              {section.note ? <aside className="doc-note"><strong>Note</strong><p>{formatInlineCode(section.note)}</p></aside> : null}
            </section>
          ))}

          {relatedPages.length > 0 ? (
            <nav className="related-docs" aria-label="Related documentation">
              <h2>Related documentation</h2>
              <ul>
                {relatedPages.map((relatedPage) => (
                  <li key={relatedPage.path}>
                    <Link href={relatedPage.path}>
                      <strong>{relatedPage.title}</strong>
                      <span>{relatedPage.description}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <nav className="page-pagination" aria-label="Adjacent documentation pages">
            {previous ? <Link href={previous.path}><span>Previous</span>{previous.title}</Link> : <span />}
            {next ? <Link href={next.path}><span>Next</span>{next.title}</Link> : <span />}
          </nav>
        </article>

        <aside className="on-this-page" aria-label="On this page">
          <p>On this page</p>
          {page.sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          <a href="https://github.com/bhaveshchow20/generative-a11y">View source <span aria-hidden="true">↗</span></a>
        </aside>
      </main>
    </SiteShell>
  );
}

const eventNamePattern = /\b((?:(?:response|tool|interaction|approval|connection|citation|text|tools)\.[a-z][a-zA-Z.]*)|(?:response|tool|interaction|approval|scope|event)(?:Instance)?Id|nextResponseInstanceId)\b/g;
const exactEventNamePattern = /^(?:(?:response|tool|interaction|approval|connection|citation|text|tools)\.[a-z][a-zA-Z.]*|(?:response|tool|interaction|approval|scope|event)(?:Instance)?Id|nextResponseInstanceId)$/;

function formatInlineCode(text: string): ReactNode {
  return text.split(eventNamePattern).map((part, index) =>
    exactEventNamePattern.test(part) ? (
      <code className="inline-api-code" key={`${part}:${index}`}>{part}</code>
    ) : part,
  );
}
