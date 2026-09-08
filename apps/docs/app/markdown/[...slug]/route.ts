import {
  findMarkdownPage,
  getPageMarkdown,
  markdownResponse,
} from "../../../lib/markdown";

/** GET /markdown/docs/... or /markdown/api/... (including /markdown/api). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const page = findMarkdownPage(`/${slug.join("/")}`);
  if (!page)
    return new Response("Documentation page not found\n", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  return markdownResponse(
    await getPageMarkdown(page),
    "text/markdown",
    page.url,
  );
}
