/* global process */

import { execFileSync, spawnSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function verifyReleaseState() {
  if (git("status", "--porcelain=v1")) {
    throw new Error("release working tree must be clean");
  }
}

try {
  verifyReleaseState();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
}

run("pnpm", ["check"]);
run("pnpm", ["test:browser"]);
run("pnpm", ["exec", "changeset", "publish"]);
