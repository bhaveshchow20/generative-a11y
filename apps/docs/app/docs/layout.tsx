import { DocumentationLayout } from "../../components/docs/docs-layout";
import { docsSource } from "../../lib/source";

export default function DocsRouteLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationLayout tree={docsSource.pageTree}>{children}</DocumentationLayout>;
}
