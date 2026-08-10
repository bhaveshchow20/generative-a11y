import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

for (const [packageName, expectedExport] of [
  ["@generative-a11y/core", "createGenerativeA11y"],
  ["@generative-a11y/dom", "createDOMAnnouncer"],
]) {
  const esm = await import(packageName);
  const cjs = require(packageName);

  assert.equal(typeof esm[expectedExport], "function");
  assert.equal(typeof cjs[expectedExport], "function");
  assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
}
