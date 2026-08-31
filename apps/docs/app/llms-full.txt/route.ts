import { getSourceManifest } from "../../lib/source-manifest";
import {
  PROJECT_AUTHOR_NAME,
  PROJECT_AUTHOR_URL,
  REPOSITORY_URL,
  SITE_DESCRIPTION,
} from "../../lib/site";

function cleanText(value: string): string {
  return value.replaceAll(/\s+/g, " ").trim();
}

export async function GET() {
  const manifest = await getSourceManifest();
  const pages = manifest
    .map((page) => {
      const sections = page.structured.contents
        .map(({ heading, content }) => {
          const text = cleanText(content);
          if (!text) return undefined;
          return heading ? `### ${cleanText(heading)}\n\n${text}` : text;
        })
        .filter((section): section is string => Boolean(section))
        .join("\n\n");

      return `## ${page.title}\n\nURL: https://generativea11y.com${page.publicPath}\n\n${page.description}\n\n${sections}`;
    })
    .join("\n\n---\n\n");

  const body = `# generative-a11y full documentation

> ${SITE_DESCRIPTION}

Project author and maintainer: ${PROJECT_AUTHOR_NAME} (${PROJECT_AUTHOR_URL})
Source repository: ${REPOSITORY_URL}

${pages}
`;

  return new Response(body, {
    headers: {
      "cache-control": "public, max-age=3600, s-maxage=86400",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
