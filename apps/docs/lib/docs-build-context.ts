import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";

/** Capture local source identity at build time; never query npm from a request. */
export function getDocsBuildContext() {
  const root = new URL("../../../", import.meta.url);
  let revision = "unknown";
  let modified: boolean | null = null;
  try {
    revision = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    modified =
      execFileSync("git", ["status", "--porcelain"], {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }).trim().length > 0;
  } catch {
    /* Source archives need not contain Git metadata. */
  }
  const packages = Object.fromEntries(
    readdirSync(new URL("packages/", root), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const pkg = JSON.parse(
          readFileSync(
            new URL(`packages/${entry.name}/package.json`, root),
            "utf8",
          ),
        ) as { name: string; version: string };
        return [pkg.name, pkg.version];
      }),
  );
  return { channel: "source" as const, revision, modified, packages };
}
