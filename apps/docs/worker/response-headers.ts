const responseHeaders = {
  "Content-Security-Policy":
    "base-uri 'self'; frame-ancestors 'none'; object-src 'none'",
  "Permissions-Policy":
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
} as const;

/** Clones a worker response and applies security and route-specific cache headers. */
export function withResponseHeaders(
  request: Request,
  response: Response,
): Response {
  const nextResponse = new Response(response.body, response);
  const headers = nextResponse.headers;
  const { pathname } = new URL(request.url);
  for (const [name, value] of Object.entries(responseHeaders)) {
    headers.set(name, value);
  }
  if (!response.ok) {
    headers.set("Cache-Control", "no-store");
  } else if (pathname.startsWith("/_next/static/")) {
    headers.set("Cache-Control", "public, max-age=31536000, immutable");
  } else if (pathname === "/og.png" || pathname === "/favicon.svg") {
    headers.set("Cache-Control", "public, max-age=86400, s-maxage=604800");
  }
  return nextResponse;
}
