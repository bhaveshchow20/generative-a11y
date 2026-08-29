import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import sourceConfig, { api, docs } from "../source.config";
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
      title: "Title",
      toc: [],
    });

    expect(page.props.toc).toEqual([]);
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
    expect(docsLayoutOptions.tabs).toHaveLength(3);
  });
});
