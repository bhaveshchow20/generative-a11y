import { DocsDescription, DocsTitle } from "fumadocs-ui/page";
import type { ReactNode } from "react";

export function DocumentationHeader({
  title,
  description,
}: {
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <header className="docs-page-header">
      <DocsTitle>{title}</DocsTitle>
      {description && <DocsDescription>{description}</DocsDescription>}
    </header>
  );
}
