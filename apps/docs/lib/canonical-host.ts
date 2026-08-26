const CANONICAL_HOST = "generativea11y.com";
const WWW_HOST = `www.${CANONICAL_HOST}`;

export function getCanonicalRedirectUrl(requestUrl: string): URL | null {
  const redirectUrl = new URL(requestUrl);

  if (redirectUrl.hostname !== WWW_HOST) return null;

  redirectUrl.protocol = "https:";
  redirectUrl.hostname = CANONICAL_HOST;
  redirectUrl.port = "";

  return redirectUrl;
}
