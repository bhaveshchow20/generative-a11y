import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocPageView } from "../../../components/doc-page";
import { DOC_PAGES, getDocPage } from "../../../lib/content";
import { createDocMetadata } from "../../../lib/seo";

export function generateStaticParams() {
  return DOC_PAGES.filter((page) => page.path.startsWith("/api/")).map((page) => ({
    slug: page.path.slice("/api/".length).split("/"),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(`/api/${slug.join("/")}`);
  if (!page) return {};
  return createDocMetadata(page);
}

export default async function APIReferencePage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const page = getDocPage(`/api/${slug.join("/")}`);
  if (!page) notFound();
  return <DocPageView page={page} />;
}
