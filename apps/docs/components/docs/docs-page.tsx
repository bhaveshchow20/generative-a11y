import type { TOCItemType } from "fumadocs-core/toc";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";

import { useMDXComponents } from "../../mdx-components";

type MdxBody = ComponentType<{ components?: MDXComponents }>;

/** Content and navigation metadata required to render one documentation page. */
export interface DocumentationPageProps {
  body: MdxBody;
  description?: string;
  title: string;
  toc: TOCItemType[];
}

/** Renders an MDX source through the native Fumadocs page composition. */
export function DocumentationPage({
  body: Body,
  description,
  title,
  toc,
}: DocumentationPageProps) {
  return (
    <DocsPage toc={toc}>
      <DocsTitle>{title}</DocsTitle>
      <DocsDescription>{description}</DocsDescription>
      <DocsBody>
        <Body components={useMDXComponents({})} />
      </DocsBody>
    </DocsPage>
  );
}
