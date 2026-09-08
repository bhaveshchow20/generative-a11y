import { DocsDescription, DocsTitle } from "fumadocs-ui/page";
import type { ReactNode } from "react";

/** Renders the title, optional description, then optional page actions in children. */
export function DocumentationHeader({
  title,
  description,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="docs-page-header">
      <DocsTitle>{title}</DocsTitle>
      {description && <DocsDescription>{description}</DocsDescription>}
      {children}
    </div>
  );
}
