import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const packageDirectories = fs
  .readdirSync("packages", { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const packages = packageDirectories.map((directory) => ({
  directory,
  manifest: JSON.parse(
    fs.readFileSync(path.join("packages", directory, "package.json"), "utf8"),
  ),
  readme: fs.readFileSync(
    path.join("packages", directory, "README.md"),
    "utf8",
  ),
}));
const rootReadme = fs.readFileSync("README.md", "utf8");

describe("published package discoverability metadata", () => {
  it("gives repository visitors direct website, docs, examples, npm, and install paths", () => {
    const introduction = rootReadme.split("## Packages")[0];

    expect(introduction).toContain("https://generativea11y.com");
    expect(introduction).toContain(
      "https://generativea11y.com/docs/getting-started",
    );
    expect(introduction).toContain(
      "https://generativea11y.com/examples/lifecycle-lab",
    );
    expect(introduction).toContain("https://www.npmjs.com/org/generative-a11y");
    expect(introduction).toContain("npm install @generative-a11y/core");
  });

  it("describes each package independently for AI accessibility searches", () => {
    for (const { manifest } of packages) {
      expect(manifest.description, manifest.name).toMatch(/accessibility/i);
      expect(manifest.description, manifest.name).toMatch(/screen-reader/i);
      expect(manifest.description, manifest.name).toMatch(/AI|agent/i);
    }
  });

  it("uses package-specific website documentation and consistent ownership links", () => {
    for (const { directory, manifest } of packages) {
      const documentationPath = ["ag-ui", "ai-sdk", "assistant-ui"].includes(
        directory,
      )
        ? `/docs/integrations/${directory}`
        : `/api/${directory}`;
      expect(manifest.homepage).toBe(
        `https://generativea11y.com${documentationPath}`,
      );
      expect(manifest.repository.directory).toBe(`packages/${directory}`);
      expect(manifest.bugs.url).toBe(
        "https://github.com/bhaveshchow20/generative-a11y/issues",
      );
    }
  });

  it("gives npm readers install, documentation, repository, and related-package paths", () => {
    for (const { manifest, readme } of packages) {
      expect(readme, manifest.name).toContain(`npm install`);
      expect(readme, manifest.name).toContain("https://generativea11y.com/");
      expect(readme, manifest.name).toContain(
        "https://github.com/bhaveshchow20/generative-a11y",
      );
      expect(readme, manifest.name).toMatch(/Related packages/i);
    }
  });
});
