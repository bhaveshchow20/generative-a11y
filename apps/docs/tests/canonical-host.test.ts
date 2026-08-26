import { describe, expect, it } from "vitest";

import { getCanonicalRedirectUrl } from "../lib/canonical-host";

describe("canonical host redirects", () => {
  it("permanently canonicalizes www URLs without losing the path or query", () => {
    expect(
      getCanonicalRedirectUrl(
        "http://www.generativea11y.com/docs/getting-started?source=www",
      )?.toString(),
    ).toBe(
      "https://generativea11y.com/docs/getting-started?source=www",
    );
  });

  it("leaves the canonical and Sites hostnames unchanged", () => {
    expect(getCanonicalRedirectUrl("https://generativea11y.com/docs")).toBeNull();
    expect(
      getCanonicalRedirectUrl(
        "https://generative-a11y.angrypirate20.chatgpt.site/docs",
      ),
    ).toBeNull();
  });
});
