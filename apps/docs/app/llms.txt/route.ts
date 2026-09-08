import { getSourceManifest } from "../../lib/source-manifest";
import {
  markdownResponse,
  markdownUrl,
  sourceContext,
} from "../../lib/markdown";
import { absoluteUrl, REPOSITORY_URL, SITE_DESCRIPTION } from "../../lib/site";

export async function GET() {
  const manifest = await getSourceManifest();
  const sections = ["docs", "api"].map(
    (section) =>
      `## ${section === "docs" ? "Guides" : "API reference"}\n\n${manifest
        .filter(
          (page) =>
            page.publicPath === `/${section}` ||
            page.publicPath.startsWith(`/${section}/`),
        )
        .map(
          (page) =>
            `- [${page.title}](${markdownUrl(page.publicPath)}): ${page.description}`,
        )
        .join("\n")}`,
  );
  return markdownResponse(
    `# generative-a11y\n\n> ${SITE_DESCRIPTION}\n\nChoose an adapter, check compatible versions, follow lifecycle and ownership guidance, then verify your integration. Vercel AI SDK accessibility, assistant-ui, AG-UI, React and framework-neutral integrations preserve the host interface. Deterministic tests do not prove real assistive-technology behavior.\n\n${sourceContext}\n\nPrefer individual Markdown pages below. Each includes its canonical HTML URL and source context.\n\n${sections.join("\n\n")}\n\n## Retrieval\n\n- [Full documentation](${absoluteUrl("/llms-full.txt")}): all guides and generated API declarations.\n- [Guides corpus](${absoluteUrl("/llms-docs.txt")})\n- [API corpus](${absoluteUrl("/llms-api.txt")})\n- [HTML API reference](${absoluteUrl("/api")})\n- [Search](${absoluteUrl("/api/search?query=useChatAccessibility")}): existing Fumadocs UI search JSON; URLs identify canonical pages or sections. This is not a version-filtered public search API.\n- [Repository and runnable examples](${REPOSITORY_URL})\n`,
    "text/plain",
  );
}
