/* global process */

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const root = dirname(dirname(fileURLToPath(import.meta.url)));

it("rejects a dirty working tree before reading release evidence", async () => {
  const sentinel = await mkdtemp(join(root, ".release-dirty-test-"));
  try {
    const execution = execFileAsync(process.execPath, ["scripts/release.mjs"], {
      cwd: root,
    });

    await expect(execution).rejects.toMatchObject({
      stderr: expect.stringContaining("working tree must be clean"),
    });
  } finally {
    await rm(sentinel, { recursive: true, force: true });
  }
});
