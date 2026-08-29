"use client";

import type { Root } from "fumadocs-core/page-tree";
import { DocsLayout } from "fumadocs-ui/layouts/docs";

import { docsLayoutOptions } from "../../lib/layout.shared";

export function DocumentationLayout({
  children,
  tree,
}: {
  children: React.ReactNode;
  tree: Root;
}) {
  return (
    <div className="docs-site">
      <DocsLayout {...docsLayoutOptions} tree={tree}>
        {children}
      </DocsLayout>
    </div>
  );
}
