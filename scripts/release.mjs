/* global process */

import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

import { validateAssistiveTechnologyEvidence } from "./assistive-technology-evidence.mjs";

const evidenceFile = "docs/assistive-technology-results.json";

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

async function verifyEvidence() {
  if (git("status", "--porcelain=v1")) {
    throw new Error("release working tree must be clean");
  }
  git("ls-files", "--error-unmatch", evidenceFile);
  const evidence = JSON.parse(await readFile(evidenceFile, "utf8"));
  const sourceCommit = evidence?.sourceCommit;
  const errors = validateAssistiveTechnologyEvidence(evidence, {
    sourceCommit,
  });
  if (errors.length > 0) {
    throw new Error(
      `Assistive-technology release evidence is invalid:\n- ${errors.join("\n- ")}`,
    );
  }

  git("cat-file", "-e", `${sourceCommit}^{commit}`);
  execFileSync("git", ["merge-base", "--is-ancestor", sourceCommit, "HEAD"], {
    stdio: "inherit",
  });
  execFileSync(
    "git",
    [
      "diff",
      "--quiet",
      sourceCommit,
      "HEAD",
      "--",
      ".",
      `:(exclude)${evidenceFile}`,
    ],
    { stdio: "inherit" },
  );

  process.stdout.write(
    `Validated external assistive-technology evidence for ${sourceCommit}.\n`,
  );
}

try {
  await verifyEvidence();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.stderr.write(
    `Publishing is blocked. Commit complete evidence at ${evidenceFile} for an unchanged release candidate.\n`,
  );
  process.exit(1);
}

run("pnpm", ["check"]);
run("pnpm", ["test:browser"]);
run("pnpm", ["exec", "changeset", "publish"]);
