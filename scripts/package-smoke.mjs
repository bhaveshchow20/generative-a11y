import assert from "node:assert/strict";
import { createRequire } from "node:module";

import * as esm from "@generative-a11y/core";

const require = createRequire(import.meta.url);
const cjs = require("@generative-a11y/core");

assert.equal(typeof esm.createGenerativeA11y, "function");
assert.equal(typeof cjs.createGenerativeA11y, "function");
assert.deepEqual(Object.keys(esm).sort(), Object.keys(cjs).sort());
