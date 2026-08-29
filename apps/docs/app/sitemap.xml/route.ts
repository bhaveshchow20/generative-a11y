import { getSourceManifest } from "../../lib/source-manifest";
import { absoluteUrl } from "../../lib/site";

const staticRoutes = ["/", "/examples/lifecycle-lab"] as const;

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
export async function GET() {
  const manifest = await getSourceManifest();
  const paths = [...staticRoutes, ...manifest.map(({ publicPath }) => publicPath)];
  const canonicalPaths = [...new Set(paths)].sort((left, right) =>
    left.localeCompare(right),
  );
  const urls = canonicalPaths
    .map((path) => `  <url><loc>${escapeXml(absoluteUrl(path))}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "content-type": "application/xml; charset=utf-8" } },
  );
}
