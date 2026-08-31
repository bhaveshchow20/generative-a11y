import { describe, expect, it } from "vitest";

import { withResponseHeaders } from "../worker/response-headers";

describe("worker response headers", () => {
  it("caches successful versioned assets immutably", async () => {
    const response = withResponseHeaders(
      new Request("https://generativea11y.com/_next/static/app.js"),
      new Response("asset", { status: 200, statusText: "OK" }),
    );

    expect(response.status).toBe(200);
    expect(response.statusText).toBe("OK");
    expect(response.headers.get("cache-control")).toBe(
      "public, max-age=31536000, immutable",
    );
    await expect(response.text()).resolves.toBe("asset");
  });

  it("does not cache error responses at successful asset lifetimes", () => {
    const response = withResponseHeaders(
      new Request("https://generativea11y.com/_next/static/missing.js"),
      new Response("missing", { status: 404 }),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
