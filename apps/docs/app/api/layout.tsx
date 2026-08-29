import { DocumentationLayout } from "../../components/docs/docs-layout";
import { apiSource } from "../../lib/source";

export default function ApiRouteLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationLayout tree={apiSource.pageTree}>{children}</DocumentationLayout>;
}
