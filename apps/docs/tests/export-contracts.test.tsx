import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import sourceConfig, { api, docs } from "../source.config";
import { DocumentationHeader } from "../components/docs/docs-header";
import { DocumentationPage } from "../components/docs/docs-page";
import { SiteLogo } from "../components/layout/site-logo";
import { docsLayoutOptions, homeLayoutOptions } from "../lib/layout.shared";

describe("docs application export contracts", () => {
  it("defines both Fumadocs content collections", () => {
    expect(docs).toBeDefined();
    expect(api).toBeDefined();
    expect(sourceConfig).toBeDefined();
  });

  it("composes documentation pages through the native page component", () => {
    const page = DocumentationPage({
      body: () => <p>Body</p>,
      description: "Description",
      path: "/docs/example",
      sourcePath: "example.mdx",
      title: "Title",
      toc: [],
    });

    expect(page.props.children).toHaveLength(2);
  });

  it("places header actions after the title and description", () => {
    const html = renderToStaticMarkup(
      <DocumentationHeader title="Header title" description="Header description">
        <button type="button">Header action</button>
      </DocumentationHeader>,
    );
    expect(html.indexOf("Header title")).toBeGreaterThan(-1);
    expect(html.indexOf("Header description")).toBeGreaterThan(html.indexOf("Header title"));
    expect(html.indexOf("Header action")).toBeGreaterThan(html.indexOf("Header description"));
  });

  it("renders the shared product logo as a named home link", () => {
    const html = renderToStaticMarkup(<SiteLogo href="/" />);

    expect(html).toContain('href="/"');
    expect(html).toContain('aria-label="generative-a11y home"');
    expect(html).toContain("generative-a11y");
  });

  it("keeps navigation contracts enabled across both layouts", () => {
    expect(homeLayoutOptions.searchToggle).toEqual({ enabled: true });
    expect(homeLayoutOptions.themeSwitch).toEqual({
      enabled: true,
      mode: "light-dark-system",
    });
    expect(docsLayoutOptions.sidebar).toMatchObject({ collapsible: true });
    expect(docsLayoutOptions.tabs).toHaveLength(2);
  });
});
