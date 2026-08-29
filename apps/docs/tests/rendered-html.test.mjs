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
  assert.match(html, /Built for asynchronous AI/i);
  assert.match(html, /Add accessibility without starting over/i);
  assert.match(html, /Debug accessibility behavior before users find the problem/i);
  assert.match(html, /href="\/api"[^>]*>API</i);
  assert.match(html, /npm install @generative-a11y\/core/i);
  assert.match(html, /aria-label="Package"/i);
  assert.match(html, /href="\/docs\/getting-started"/i);
  assert.match(html, /href="\/examples\/lifecycle-lab"/i);
  assert.match(html, /href="\/docs\/integrations"/i);
  assert.match(html, /href="\/docs\/devtools"/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("homepage renders the approved product narrative", async () => {
  const response = await render();
  const html = await response.text();
  const visibleMarkup = html.replace(
    /<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  const renderedText = visibleMarkup
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ");

  for (const phrase of [
    "Accessible AI, without rebuilding your interface.",
    "Interactive runtime laboratory",
    "Built for asynchronous AI",
    "Add accessibility without starting over",
    "Debug accessibility behavior before users find the problem",
    "Accessible behavior, clear boundaries.",
    "npm install @generative-a11y/core",
  ]) {
    assert.ok(renderedText.includes(phrase), phrase);
  }
});

test("homepage server-renders the Batch A shell and product boundaries", async () => {
  const response = await render();
  const html = await response.text();
  const h1Matches = html.match(/<h1\b[^>]*>/gi) ?? [];

  assert.equal(response.status, 200);
  assert.equal(h1Matches.length, 1);
  assert.match(
    html,
    /<h1\b[^>]*>\s*Accessible AI, without rebuilding your interface\.\s*<\/h1>/i,
  );
  assert.match(html, /The interface stays yours/i);
  assert.match(html, /framework-independent/i);
  assert.match(html, /without replacing its UI or stealing focus/i);
  assert.match(html, /lifecycle evidence is incomplete/i);
  assert.match(html, /href="\/docs\/getting-started"/i);
  assert.match(html, /href="\/examples\/lifecycle-lab"/i);
  assert.match(html, /aria-hidden="true"[^>]*>[\s\S]*response\.started/i);
  assert.match(
    html,
    /href="https:\/\/github\.com\/bhaveshchow20\/generative-a11y"/i,
  );
  assert.match(html, /href="https:\/\/www\.npmjs\.com\/org\/generative-a11y"/i);
});

test("exposes canonical metadata and machine-readable project data", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(
    html,
    /<link rel="canonical" href="https:\/\/generativea11y\.com\/?"\s*\/?>/i,
  );
  assert.match(html, /<meta property="og:type" content="website"\s*\/?>/i);
  assert.match(
    html,
    /<meta name="twitter:card" content="summary_large_image"\s*\/?>/i,
  );
  assert.match(html, /<script type="application\/ld\+json">/i);
  assert.match(html, /"@type":"SoftwareSourceCode"/i);
  assert.match(html, /"@type":"WebPage"/i);
  assert.doesNotMatch(html, /<meta name="robots" content="noindex"/i);
});

test("serves crawler and AI discovery resources", async () => {
  const robots = await render("/robots.txt");
  assert.equal(robots.status, 200);
  assert.match(robots.headers.get("content-type") ?? "", /^text\/plain\b/i);
  assert.match(
    await robots.text(),
    /Sitemap: https:\/\/generativea11y\.com\/sitemap\.xml/i,
  );

  const sitemap = await render("/sitemap.xml");
  assert.equal(sitemap.status, 200);
  assert.match(sitemap.headers.get("content-type") ?? "", /xml/i);
  const sitemapXml = await sitemap.text();
  assert.match(
    sitemapXml,
    /<loc>https:\/\/generativea11y\.com\/docs\/getting-started<\/loc>/i,
  );
  assert.match(
    sitemapXml,
    /<loc>https:\/\/generativea11y\.com\/api\/core<\/loc>/i,
  );
  assert.doesNotMatch(
    sitemapXml,
    /localhost|openai-sites|\/docs\/api\/runtime/i,
  );

  const llms = await render("/llms.txt");
  assert.equal(llms.status, 200);
  assert.match(llms.headers.get("content-type") ?? "", /^text\/plain\b/i);
  const llmsText = await llms.text();
  assert.match(llmsText, /^# generative-a11y/m);
  assert.match(llmsText, /Vercel AI SDK accessibility/i);
  assert.match(llmsText, /https:\/\/generativea11y\.com\/api/i);
});

test("server-renders the dedicated API reference and symbol pages", async () => {
  for (const [pathname, expected] of [
    ["/api", /API reference/i],
    ["/api/core", /@generative-a11y\/core/i],
    ["/api/core/create-generative-a11y", /dispatch\(event\)/i],
    ["/api/dom/create-dom-announcer", /DOMAnnouncerOptions/i],
    ["/api/react/hooks", /useGenerativeA11yRuntime/i],
    ["/api/ai-sdk/use-chat-accessibility", /useChatAccessibility/i],
    ["/api/assistant-ui/bind-thread-runtime", /bindThreadRuntime/i],
    ["/api/ag-ui/bind-agent", /bindAgent/i],
    ["/api/devtools", /createDevtoolsStore/i],
    ["/api/core/testing", /replayEvents/i],
  ]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, expected, pathname);
    assert.match(html, /href="\/api"/i, pathname);
  }
});

test("homepage explains its evidence boundary without roadmap language", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /lifecycle evidence is incomplete/i);
  assert.match(html, /without replacing its UI or stealing focus/i);
  assert.doesNotMatch(html, /Phase\s+\d|implemented|deferred|pre-release/i);
});

test("server-renders documentation and project deep links", async () => {
  const routes = [
    ["/docs/getting-started", /Getting started/i],
    ["/docs/architecture", /Report only what the app knows/i],
    ["/docs/integrations", /Choose an integration/i],
    ["/docs/troubleshooting", /Troubleshooting/i],
    ["/docs/stability", /Stability and migrations/i],
    ["/docs/testing", /Chromium, Firefox, and WebKit/i],
    ["/docs/compatibility", /cannot replace Safari testing/i],
    ["/docs/lifecycle/stop-retry", /stale responses/i],
    ["/api/core/create-generative-a11y", /createGenerativeA11y/i],
    ["/docs/integrations/ag-ui", /bindAgent/i],
    ["/docs/devtools", /Accessibility Trace Explorer/i],
    ["/docs/testing/replay", /deterministic replay/i],
    ["/docs/project/overview", /Project overview/i],
  ];

  for (const [pathname, expected] of routes) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    assert.match(await response.text(), expected, pathname);
  }
});

test("concept guides expose native documentation navigation and related routes", async () => {
  const response = await render("/docs/screen-readers-and-streaming-ai");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Accessible streaming AI for screen readers/i);
  assert.match(html, /href="\/docs\/getting-started"/i);
  assert.match(html, /href="\/docs\/aria-live-and-generative-ai"/i);
  assert.match(html, /href="\/docs\/integrations\/ai-sdk"/i);
});

test("server-renders the interactive lifecycle lab shell", async () => {
  const response = await render("/examples/lifecycle-lab");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /See the library at work/i);
  assert.match(html, /Stream a response/i);
  assert.match(html, /Your existing interface/i);
  assert.match(html, /Test with a real screen reader/i);
  assert.match(html, /What the lifecycle lab demonstrates/i);
  assert.match(html, /Streaming response/i);
  assert.match(html, /Tool execution/i);
  assert.match(html, /Approval request/i);
  assert.match(html, /Failure and retry/i);
  assert.match(html, /href="\/docs\/getting-started"/i);
  assert.match(html, /github\.com\/bhaveshchow20\/generative-a11y/i);
});

test("renders a useful, non-indexable 404 page", async () => {
  const response = await render("/definitely-missing");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Page not found/i);
  assert.match(html, /href="\/docs\/getting-started"/i);
  assert.match(html, /href="\/api"/i);
  assert.match(html, /<meta name="robots" content="noindex"/i);
});
