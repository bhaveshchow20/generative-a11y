import type { TOCItemType } from "fumadocs-core/toc";
import { DocsBody, DocsPage } from "fumadocs-ui/page";
import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";

import { JsonLd } from "../json-ld";
import { createArticleJsonLd } from "../../lib/seo";
import { useMDXComponents } from "../../mdx-components";
import { DocumentationHeader } from "./docs-header";

type MdxBody = ComponentType<{ components?: MDXComponents }>;

/** Content and navigation metadata required to render one documentation page. */
export interface DocumentationPageProps {
  body: MdxBody;
  description?: string;
  path: string;
  title: string;
  toc: TOCItemType[];
}

/** Renders an MDX source through the native Fumadocs page composition. */
export function DocumentationPage({
  body: Body,
  description,
  path,
  title,
  toc,
}: DocumentationPageProps) {
  return (
    <>
      <JsonLd
        data={createArticleJsonLd({
          path,
          title,
          description: description ?? "",
        })}
      />
      <DocsPage toc={toc}>
        <DocumentationHeader title={title} description={description} />
        <DocsBody>
          <Body components={useMDXComponents({})} />
        </DocsBody>
      </DocsPage>
    </>
  );
}
