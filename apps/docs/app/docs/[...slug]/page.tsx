import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { DocPageView } from "../../../components/doc-page";
import { DOC_PAGES, getDocPage } from "../../../lib/content";
import { createDocMetadata } from "../../../lib/seo";

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
    ...DOC_PAGES.filter((page) => page.path.startsWith("/docs/")).map((page) => page.path),
    ...Object.keys(legacyReferenceRoutes),
  ].map((path) => ({ slug: path.slice("/docs/".length).split("/") }));
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
    const page = getDocPage(destination);
    return page ? createDocMetadata(page) : {};
  }
  const page = getDocPage(path);
  if (!page) return {};
  return createDocMetadata(page);
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
  const page = getDocPage(path);
  if (!page) notFound();
  return <DocPageView page={page} />;
}
