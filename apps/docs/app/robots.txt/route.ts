import { SITE_URL } from "../../lib/site";

export function GET() {
  return new Response(
    [`User-agent: *`, `Allow: /`, ``, `Sitemap: ${SITE_URL}/sitemap.xml`, ``].join(
      "\n",
    ),
    { headers: { "content-type": "text/plain; charset=utf-8" } },
  );
}
