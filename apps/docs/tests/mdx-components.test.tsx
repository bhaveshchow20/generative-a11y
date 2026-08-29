// @vitest-environment jsdom

import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import * as FilesComponents from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";

import { useMDXComponents } from "../mdx-components";

describe("useMDXComponents", () => {
  it("registers the native Fumadocs authoring components", () => {
    const components = useMDXComponents({});

    expect(components.Callout).toBe(defaultMdxComponents.Callout);
    expect(components.Card).toBe(defaultMdxComponents.Card);
    expect(components.Cards).toBe(defaultMdxComponents.Cards);
    expect(components.Accordion).toBe(Accordion);
    expect(components.Accordions).toBe(Accordions);
    expect(components.Step).toBe(Step);
    expect(components.Steps).toBe(Steps);
    expect(components.TypeTable).toBe(TypeTable);
    expect(components.Tabs).toBe(TabsComponents.Tabs);
    expect(components.File).toBe(FilesComponents.File);
  });

  it("keeps Fumadocs defaults for headings, links, code blocks, and tables", () => {
    const components = useMDXComponents({});

    expect(components.h2).toBe(defaultMdxComponents.h2);
    expect(components.a).toBe(defaultMdxComponents.a);
    expect(components.pre).toBe(defaultMdxComponents.pre);
    expect(components.table).toBe(defaultMdxComponents.table);
  });

  it("lets page-specific mappings override native defaults", () => {
    const CustomHeading = ({ children, ...props }: ComponentProps<"h2">) => (
      <h2 data-custom-heading="true" {...props}>
        {children}
      </h2>
    );
    const overrides: MDXComponents = { h2: CustomHeading };

    expect(useMDXComponents(overrides).h2).toBe(CustomHeading);
  });
});
