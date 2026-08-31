import type { TOCItemType } from "fumadocs-core/toc";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/page";
import type { MDXComponents } from "mdx/types";
import type { ComponentType } from "react";

import { JsonLd } from "../json-ld";
import { createArticleJsonLd } from "../../lib/seo";
import { PROJECT_AUTHOR_NAME, PROJECT_AUTHOR_URL } from "../../lib/site";
import { useMDXComponents } from "../../mdx-components";

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
        <DocsTitle>{title}</DocsTitle>
        <DocsDescription>{description}</DocsDescription>
        <p className="docs-maintainer">
          Maintained by <a href={PROJECT_AUTHOR_URL}>{PROJECT_AUTHOR_NAME}</a>
        </p>
        <DocsBody>
          <Body components={useMDXComponents({})} />
        </DocsBody>
      </DocsPage>
    </>
  );
}
