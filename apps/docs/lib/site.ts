/** Canonical production origin used by metadata and crawler resources. */
export const SITE_URL = "https://generativea11y.com";
/** Public project name used in metadata and structured data. */
export const SITE_NAME = "generative-a11y";
/** Default description for project-level discovery surfaces. */
export const SITE_DESCRIPTION =
  "Accessibility infrastructure for streaming AI and agent interfaces, with paced screen-reader announcements that preserve the host application's UI.";
/** Canonical source repository. */
export const REPOSITORY_URL =
  "https://github.com/bhaveshchow20/generative-a11y";
/** npm organization page for the published package family. */
export const NPM_SCOPE_URL = "https://www.npmjs.com/org/generative-a11y";
/** Site-relative Open Graph and social card image. */
export const SOCIAL_IMAGE_PATH = "/og.png";

/** Resolves a site-relative path against the canonical production origin. */
export function absoluteUrl(path: string): string {
  return new URL(path, `${SITE_URL}/`).toString();
}
