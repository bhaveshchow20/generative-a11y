import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${pathname}`, {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the generative-a11y homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>generative-a11y/i);
  assert.match(html, /Accessible AI,/i);
  assert.match(html, /without rebuilding your interface/i);
  assert.match(html, /AI framework/i);
  assert.match(html, /assistive technology/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("homepage states the evidence boundary without roadmap language", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /does not prove.*screen reader spoke/i);
  assert.doesNotMatch(html, /Phase\s+\d|implemented|deferred|pre-release/i);
});

test("server-renders documentation and project deep links", async () => {
  const routes = [
    ["/docs/getting-started", /Getting started/i],
    ["/docs/integrations", /Choose an integration/i],
    ["/docs/troubleshooting", /Troubleshooting/i],
    ["/docs/stability", /Stability and migrations/i],
    ["/docs/lifecycle/stop-retry", /stale responses/i],
    ["/docs/packages/core", /createGenerativeA11y/i],
    ["/docs/integrations/ag-ui", /bindAgent/i],
    ["/project/overview", /Project overview/i],
  ];

  for (const [pathname, expected] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), expected, pathname);
  }
});

test("server-renders the interactive lifecycle lab shell", async () => {
  const response = await render("/examples/lifecycle-lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Lifecycle lab/i);
  assert.match(html, /Run stream/i);
  assert.match(html, /Existing application UI/i);
  assert.match(html, /does not prove.*screen reader spoke/i);
});
