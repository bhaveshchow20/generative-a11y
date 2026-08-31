import type { Metadata } from "next";

import { notFound } from "next/navigation";
import { DocumentationPage } from "../../components/docs/docs-page";
import { createDocMetadata } from "../../lib/seo";
import { apiSource } from "../../lib/source";

const apiPage = apiSource.getPage([]);

export const metadata: Metadata = apiPage
  ? createDocMetadata({
      path: apiPage.url,
      title: apiPage.data.title,
      description: apiPage.data.description ?? "",
    })
  : {};

export default function APIIndexPage() {
  if (!apiPage) notFound();
  return (
    <DocumentationPage
      body={apiPage.data.body}
      description={apiPage.data.description}
      path={apiPage.url}
      title={apiPage.data.title}
      toc={apiPage.data.toc}
    />
  );
}
