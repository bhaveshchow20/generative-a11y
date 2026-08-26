import type { Metadata } from "next";

import { DocPageView } from "../../components/doc-page";
import { getDocPage } from "../../lib/content";
import { createDocMetadata } from "../../lib/seo";

const apiPage = getDocPage("/api")!;

export const metadata: Metadata = createDocMetadata(apiPage);

export default function APIIndexPage() {
  return <DocPageView page={apiPage} />;
}
