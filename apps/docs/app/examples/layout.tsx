import { DocumentationLayout } from "../../components/docs/docs-layout";
import { docsSource } from "../../lib/source";
import "../../styles/examples.css";

export default function ExamplesLayout({ children }: { children: React.ReactNode }) {
  return <DocumentationLayout tree={docsSource.pageTree}>{children}</DocumentationLayout>;
}
