import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Run against a local production server built from this checkout.
const origin = new URL(process.argv[2] ?? "http://localhost:3100");
async function get(path, accept = "text/markdown") {
  const response = await fetch(new URL(path, origin), { headers: { accept } });
  assert.equal(response.status, 200, path);
  return { response, body: await response.text() };
}

const { body: index } = await get("/llms.txt");
const exports = [
  ...index.matchAll(/\]\(https:\/\/generativea11y\.com(\/markdown\/[^)]+)\)/g),
].map((match) => match[1]);
assert.equal(exports.length, 53);
assert.equal(new Set(exports).size, exports.length);
let bytes = 0;
for (const path of exports) {
  const { response, body } = await get(path);
  assert.equal(
    response.headers.get("content-type"),
    "text/markdown; charset=utf-8",
  );
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=300, s-maxage=3600",
  );
  assert.ok(
    body.includes(
      `Canonical: https://generativea11y.com${path.slice("/markdown".length)}`,
    ),
  );
  bytes += Buffer.byteLength(body);
}
for (const path of ["/llms-full.txt", "/llms-docs.txt", "/llms-api.txt"]) {
  const { response } = await get(path);
  assert.equal(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
}
for (const path of [
  "/markdown/api/no-such-page",
  "/markdown/docs/no-such-page",
  "/markdown/llms.txt",
]) {
  const response = await fetch(new URL(path, origin));
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  await response.text();
}
for (const path of ["/docs/integrations/ai-sdk", "/api/core"]) {
  let previous;
  for (const accept of ["text/markdown", "text/html", "*/*", "text/markdown"]) {
    const html = await get(path, accept);
    assert.match(html.response.headers.get("content-type"), /^text\/html/);
    const markdown = await get(`/markdown${path}`, accept);
    if (previous) assert.equal(markdown.body, previous);
    previous = markdown.body;
  }
}
const search = await get(
  "/api/search?query=useChatAccessibility&limit=5",
  "application/json",
);
const hits = JSON.parse(search.body);
assert.ok(
  Array.isArray(hits) && hits.some((hit) => hit.url.includes("ai-sdk")),
);

// Discover a recipe from the exported index, follow its documentation link,
// then compile the full component fetched from the exported API page.
const recipePath = exports.find(
  (path) => path === "/markdown/docs/integrations/ai-sdk",
);
assert.ok(recipePath);
const { body: recipe } = await get(recipePath);
const reference = recipe.match(
  /\[complete example in the API reference\]\(([^)]+)\)/,
)?.[1];
assert.ok(reference);
const { body: api } = await get(`/markdown${reference}`);
const example = [...api.matchAll(/^```tsx\n([\s\S]*?)\n```/gm)]
  .map((match) => match[1])
  .find((code) => code.includes('"use client";'));
assert.ok(example);
assert.match(api, /Documentation channel: source checkout/);
assert.equal(
  example.trim(),
  (
    await readFile(
      new URL("../../../examples/consumer-journeys/chat.tsx", import.meta.url),
      "utf8",
    )
  ).trim(),
);

const cache = new URL("../../../node_modules/.cache/", import.meta.url);
await mkdir(cache, { recursive: true });
const temporary = await mkdtemp(
  fileURLToPath(new URL("markdown-consumer-", cache)),
);
try {
  const filename = `${temporary}/chat.tsx`;
  await writeFile(filename, example);
  const program = ts.createProgram([filename], {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    esModuleInterop: true,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  assert.equal(
    diagnostics.length,
    0,
    ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => temporary,
      getNewLine: () => "\n",
    }),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log(
  JSON.stringify(
    {
      pages: exports.length,
      pageBytes: bytes,
      searchResults: hits.length,
      consumer: "AI SDK recipe → full API example → source TypeScript check",
      build: api.match(/^Build base revision: .+$/m)?.[0],
    },
    null,
    2,
  ),
);
