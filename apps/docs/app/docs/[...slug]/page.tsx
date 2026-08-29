import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocumentationPage as NativeDocsPage } from "../../../components/docs/docs-page";
import { createPageMetadata } from "../../../lib/seo";
import { docsSource } from "../../../lib/source";

const legacyReferenceRoutes: Readonly<Record<string, string>> = {
  "/docs/packages/core": "/api/core",
  "/docs/packages/dom": "/api/dom",
  "/docs/packages/react": "/api/react",
  "/docs/api/events": "/api/core/events",
  "/docs/api/runtime": "/api/core/create-generative-a11y",
  "/docs/api/policy": "/api/core/policy",
  "/docs/api/diagnostics": "/api/core/diagnostics",
  "/docs/browser/delivery": "/api/dom/create-dom-announcer",
  "/docs/browser/preferences": "/api/dom/preferences",
};

export function generateStaticParams() {
  return [
    ...docsSource.getPages().map((page) => ({ slug: page.slugs })),
    ...Object.keys(legacyReferenceRoutes).map((path) => ({
      slug: path.slice("/docs/".length).split("/"),
    })),
  ];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const path = `/docs/${slug.join("/")}`;
  const destination = legacyReferenceRoutes[path];
  if (destination) {
    return {};
  }
  const page = docsSource.getPage(slug);
  if (!page) return {};
  return createPageMetadata({
    path: page.url,
    title: page.data.title,
    description: page.data.description ?? "",
  });
}

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const path = `/docs/${slug.join("/")}`;
  const destination = legacyReferenceRoutes[path];
  if (destination) redirect(destination);
  const page = docsSource.getPage(slug);
  if (!page) notFound();
  return (
    <NativeDocsPage
      body={page.data.body}
      description={page.data.description}
      title={page.data.title}
      toc={page.data.toc}
    />
  );
}
