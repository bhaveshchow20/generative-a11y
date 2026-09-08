import { PageViewOptions } from "./page-view-options";
import { MarkdownCopyButton } from "fumadocs-ui/layouts/docs/page";
import { REPOSITORY_URL } from "../../lib/site";
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
  sourcePath: string;
  title: string;
  toc: TOCItemType[];
}

/** Renders an MDX source through the native Fumadocs page composition. */
export function DocumentationPage({
  body: Body,
  description,
  path,
  sourcePath,
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
        <DocumentationHeader title={title} description={description}>
          <div
            role="group"
            aria-label="Page actions"
            className="flex flex-wrap items-center gap-2"
          >
            <MarkdownCopyButton markdownUrl={`/markdown${path}`} />
            <PageViewOptions
              path={path}
              githubUrl={`${REPOSITORY_URL}/blob/main/apps/docs/content/${path.startsWith("/api") ? "api" : "docs"}/${sourcePath}`}
            />
          </div>
        </DocumentationHeader>
        <DocsBody>
          <Body components={useMDXComponents({})} />
        </DocsBody>
      </DocsPage>
    </>
  );
}
