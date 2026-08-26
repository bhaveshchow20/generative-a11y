import { type NextRequest, NextResponse } from "next/server";

import { getCanonicalRedirectUrl } from "./lib/canonical-host";

export function proxy(request: NextRequest) {
  const redirectUrl = getCanonicalRedirectUrl(request.url);

  return redirectUrl
    ? NextResponse.redirect(redirectUrl, 308)
    : NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
