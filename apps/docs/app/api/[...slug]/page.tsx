import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocumentationPage } from "../../../components/docs/docs-page";
import { createDocMetadata } from "../../../lib/seo";
import { apiSource } from "../../../lib/source";

export function generateStaticParams() {
  return apiSource
    .getPages()
    .filter((page) => page.slugs.length > 0)
    .map((page) => ({ slug: page.slugs }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = apiSource.getPage(slug);
  if (!page) return {};
  return createDocMetadata({
    path: page.url,
    title: page.data.title,
    description: page.data.description ?? "",
  });
}

export default async function APIReferencePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = apiSource.getPage(slug);
  if (!page) notFound();
  return (
    <DocumentationPage
      body={page.data.body}
      description={page.data.description}
      path={page.url}
      title={page.data.title}
      toc={page.data.toc}
    />
  );
}
