import { Accordion, Accordions } from "fumadocs-ui/components/accordion";
import * as FilesComponents from "fumadocs-ui/components/files";
import { Step, Steps } from "fumadocs-ui/components/steps";
import * as TabsComponents from "fumadocs-ui/components/tabs";
import { TypeTable } from "fumadocs-ui/components/type-table";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { MDXComponents } from "mdx/types";

const docsComponents = {
  ...defaultMdxComponents,
  ...TabsComponents,
  ...FilesComponents,
  Accordion,
  Accordions,
  Step,
  Steps,
  TypeTable,
} satisfies MDXComponents;

/** Merge the docs MDX defaults with caller-provided component mappings. */
export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...docsComponents,
    ...components,
  };
}
