import type { Metadata } from "next";

import {
  absoluteUrl,
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

/** Builds canonical search and social metadata for one public route. */
export function createPageMetadata({
  path,
  title,
  description,
  keywords,
  absoluteTitle = false,
}: PageMetadataInput): Metadata {
  const canonical = absoluteUrl(path);

  return {
    title: absoluteTitle ? { absolute: title } : title,
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
          alt: `${SITE_NAME}: accessible AI infrastructure`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [absoluteUrl(SOCIAL_IMAGE_PATH)],
    },
  };
}

/** Maps one documentation registry entry to its route metadata. */
export function createDocMetadata(page: DocumentationPageInput): Metadata {
  return createPageMetadata({
    path: page.path,
    title: page.title,
    description: page.description,
    keywords: page.keywords,
  });
}

/** Describes the project, website, and homepage as one linked JSON-LD graph. */
export function createHomeJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
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
      },
    ],
  };
}

/** Builds article and breadcrumb JSON-LD that matches the visible page hierarchy. */
export function createArticleJsonLd(page: DocumentationPageInput): Record<string, unknown> {
  const pageUrl = absoluteUrl(page.path);
  const sectionPath = page.path.startsWith("/api")
    ? "/api"
    : "/docs/getting-started";
  const sectionName = page.path.startsWith("/api") ? "API" : "Docs";
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
        "@type": "TechArticle",
        "@id": `${pageUrl}#article`,
        headline: page.title,
        description: page.description,
        mainEntityOfPage: pageUrl,
        about: page.keywords,
        isPartOf: { "@id": `${SITE_URL}/#website` },
      },
      {
        "@type": "BreadcrumbList",
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
