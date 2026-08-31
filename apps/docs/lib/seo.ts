import type { Metadata } from "next";

import {
  absoluteUrl,
  NPM_SCOPE_URL,
  PROJECT_AUTHOR_NAME,
  PROJECT_AUTHOR_URL,
  REPOSITORY_URL,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  SOCIAL_IMAGE_PATH,
} from "./site";

interface PageMetadataInput {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly keywords?: readonly string[];
  readonly absoluteTitle?: boolean;
}

interface DocumentationPageInput {
  readonly path: string;
  readonly title: string;
  readonly description: string;
  readonly keywords?: readonly string[];
}

/**
 * Builds canonical search and social metadata for one public route.
 * `absoluteTitle` bypasses the site-wide title template; titles that would
 * exceed 60 characters with that template use the same behavior automatically.
 */
export function createPageMetadata({
  path,
  title,
  description,
  keywords,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const canonical = absoluteUrl(path);
  const shouldUseAbsoluteTitle =
    absoluteTitle || `${title} · ${SITE_NAME}`.length > 60;

  return {
    title: shouldUseAbsoluteTitle ? { absolute: title } : title,
    description,
    keywords: keywords ? [...keywords] : undefined,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: SITE_NAME,
      title,
      description,
      images: [
        {
          url: absoluteUrl(SOCIAL_IMAGE_PATH),
          width: 1200,
          height: 630,
          type: "image/png",
          alt: `${SITE_NAME}: accessible AI infrastructure`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        {
          url: absoluteUrl(SOCIAL_IMAGE_PATH),
          alt: `${SITE_NAME}: accessible AI infrastructure`,
        },
      ],
    },
  };
}

/** Maps one documentation registry entry to its route metadata. */
export function createDocMetadata(page: DocumentationPageInput): Metadata {
  const metadata = createPageMetadata({
    path: page.path,
    title: page.title,
    description: page.description,
    keywords: page.keywords,
  });

  if (!page.path.startsWith("/docs/")) return metadata;

  return {
    ...metadata,
    openGraph: metadata.openGraph
      ? { ...metadata.openGraph, type: "article" }
      : undefined,
  };
}

/** Describes the project, website, and homepage as one linked JSON-LD graph. */
export function createHomeJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#author`,
        name: PROJECT_AUTHOR_NAME,
        url: PROJECT_AUTHOR_URL,
        sameAs: [PROJECT_AUTHOR_URL],
      },
      {
        "@type": "SoftwareSourceCode",
        "@id": `${SITE_URL}/#software`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        codeRepository: REPOSITORY_URL,
        programmingLanguage: ["TypeScript", "JavaScript"],
        license: `${REPOSITORY_URL}/blob/main/LICENSE`,
        runtimePlatform: "Web browsers and JavaScript runtimes",
        creator: { "@id": `${SITE_URL}/#author` },
        sameAs: [REPOSITORY_URL, NPM_SCOPE_URL],
      },
      {
        "@type": "ImageObject",
        "@id": `${SITE_URL}/#social-image`,
        contentUrl: absoluteUrl(SOCIAL_IMAGE_PATH),
        width: 1200,
        height: 630,
        caption: `${SITE_NAME}: accessible streaming AI without rebuilding your interface`,
        creator: { "@id": `${SITE_URL}/#author` },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
      },
      {
        "@type": "WebPage",
        "@id": `${SITE_URL}/#homepage`,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        url: SITE_URL,
        isPartOf: { "@id": `${SITE_URL}/#website` },
        about: { "@id": `${SITE_URL}/#software` },
        primaryImageOfPage: { "@id": `${SITE_URL}/#social-image` },
      },
    ],
  };
}

/** Builds truthful page and breadcrumb JSON-LD for guides and API reference routes. */
export function createArticleJsonLd(page: DocumentationPageInput): Record<string, unknown> {
  const pageUrl = absoluteUrl(page.path);
  const isEditorialGuide = page.path.startsWith("/docs/");
  const sectionPath = page.path.startsWith("/api")
    ? "/api"
    : page.path.startsWith("/docs/")
      ? "/docs/getting-started"
      : "/examples/lifecycle-lab";
  const sectionName = page.path.startsWith("/api")
    ? "API"
    : page.path.startsWith("/docs/")
      ? "Docs"
      : "Examples";
  const sectionItem =
    page.path === sectionPath
      ? []
      : [
          {
            "@type": "ListItem",
            position: 2,
            name: sectionName,
            item: absoluteUrl(sectionPath),
          },
        ];
  const pagePosition = sectionItem.length + 2;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${SITE_URL}/#author`,
        name: PROJECT_AUTHOR_NAME,
        url: PROJECT_AUTHOR_URL,
        sameAs: [PROJECT_AUTHOR_URL],
      },
      {
        "@type": isEditorialGuide ? "TechArticle" : "WebPage",
        "@id": `${pageUrl}#webpage`,
        ...(isEditorialGuide ? { headline: page.title } : { name: page.title }),
        description: page.description,
        url: pageUrl,
        mainEntityOfPage: pageUrl,
        about: page.keywords,
        author: { "@id": `${SITE_URL}/#author` },
        publisher: { "@id": `${SITE_URL}/#author` },
        isPartOf: { "@id": `${SITE_URL}/#website` },
        breadcrumb: { "@id": `${pageUrl}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: SITE_NAME,
            item: SITE_URL,
          },
          ...sectionItem,
          {
            "@type": "ListItem",
            position: pagePosition,
            name: page.title,
            item: pageUrl,
          },
        ],
      },
    ],
  };
}
