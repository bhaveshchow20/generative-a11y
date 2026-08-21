import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DocPageView } from "../../../components/doc-page";
import { DOC_PAGES, getDocPage } from "../../../lib/content";

export function generateStaticParams() {
  return DOC_PAGES.filter((page) => page.path.startsWith("/project/")).map((page) => ({
    slug: page.path.slice("/project/".length),
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = getDocPage(`/project/${slug}`);
  if (!page) return {};
  return { title: page.title, description: page.description };
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getDocPage(`/project/${slug}`);
  if (!page) notFound();
  return <DocPageView page={page} />;
}
