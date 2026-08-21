import Link from "next/link";

import type { DocPage } from "../lib/content";
import { DOC_PAGES } from "../lib/content";
import { ArchitectureFlow } from "./architecture-flow";
import { CodeBlock } from "./code-block";
import { SiteShell } from "./site-shell";

export function DocPageView({ page }: { page: DocPage }) {
  const index = DOC_PAGES.findIndex((entry) => entry.path === page.path);
  const previous = index > 0 ? DOC_PAGES[index - 1] : undefined;
  const next = index < DOC_PAGES.length - 1 ? DOC_PAGES[index + 1] : undefined;

  return (
    <SiteShell currentPath={page.path}>
      <main className="doc-main">
        <article className="doc-article">
          <header className="doc-intro">
            <div className="doc-kicker">
              <span>{page.group}</span>
            </div>
            <h1>{page.title}</h1>
            <p>{page.description}</p>
          </header>

          {page.sections.map((section) => (
            <section className="doc-section" id={section.id} key={section.id}>
              <h2><a href={`#${section.id}`}>{section.title}</a></h2>
              {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.visual === "runtime-flow" ? <ArchitectureFlow /> : null}
              {section.bullets ? (
                <ul>{section.bullets.map((item) => <li key={item}>{item}</li>)}</ul>
              ) : null}
              {section.table ? (
                <div className="table-wrap" role="region" aria-label={`${section.title} table`} tabIndex={0}>
                  <table>
                    <thead><tr>{section.table.headers.map((header) => <th scope="col" key={header}>{header}</th>)}</tr></thead>
                    <tbody>{section.table.rows.map((row) => (
                      <tr key={row.join(":")}>{row.map((cell, cellIndex) => <td key={`${cellIndex}:${cell}`}>{cell}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : null}
              {section.code ? <CodeBlock language={section.code.language} value={section.code.value} /> : null}
              {section.walkthrough ? (
                <div className="code-walkthrough">
                  <h3>How this code works</h3>
                  <ol>{section.walkthrough.map((step, stepIndex) => <li key={step.label}><span>{String(stepIndex + 1).padStart(2, "0")}</span><div><strong>{step.label}</strong><p>{step.description}</p></div></li>)}</ol>
                </div>
              ) : null}
              {section.api ? (
                <div className="api-reference">
                  <h3>Options and return values</h3>
                  <div className="api-list">{section.api.map((entry) => <details key={entry.name}>
                    <summary><code>{entry.name}</code><span>{entry.type}</span><b>{entry.requirement}</b></summary>
                    <div><p>{entry.description}</p><dl><dt>Default</dt><dd><code>{entry.defaultValue}</code></dd></dl></div>
                  </details>)}</div>
                </div>
              ) : null}
              {section.note ? <aside className="doc-note"><strong>Evidence boundary</strong><p>{section.note}</p></aside> : null}
            </section>
          ))}

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
