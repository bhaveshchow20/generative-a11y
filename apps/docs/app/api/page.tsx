import type { Metadata } from "next";

import { DocPageView } from "../../components/doc-page";
import { getDocPage } from "../../lib/content";

export const metadata: Metadata = {
  title: "API reference",
  description: "Package and symbol-level generative-a11y API reference.",
};

export default function APIIndexPage() {
  return <DocPageView page={getDocPage("/api")!} />;
}
