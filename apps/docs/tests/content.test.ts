import { describe, expect, it } from "vitest";

import { getSourceManifest } from "../lib/source-manifest";
import { apiSource, docsSource } from "../lib/source";

describe("Fumadocs content", () => {
  it("is the single source of public documentation routes", async () => {
    const manifest = await getSourceManifest();
    const sourceCount = docsSource.getPages().length + apiSource.getPages().length;
    const paths = manifest.map(({ publicPath }) => publicPath);

    expect(manifest).toHaveLength(sourceCount);
    expect(new Set(paths)).toHaveLength(paths.length);
    expect(paths).toContain("/docs/getting-started");
    expect(paths).toContain("/docs/project/overview");
    expect(paths).toContain("/api/core/create-generative-a11y");
    expect(paths).not.toContain("/project/overview");
  });

  it("keeps every searchable page complete and serializable", async () => {
    const manifest = await getSourceManifest();

    for (const page of manifest) {
      expect(page.title.trim()).not.toBe("");
      expect(page.description.trim()).not.toBe("");
      expect(page.searchableText.trim()).not.toBe("");
      expect(page.publicPath).toMatch(/^\/(docs|api)(\/|$)/);
      expect(() => JSON.stringify(page)).not.toThrow();
    }
  });

  it("builds native page trees without duplicate root entries", () => {
    for (const source of [docsSource, apiSource]) {
      const names = source.pageTree.children.map((node) =>
        "name" in node ? String(node.name) : "",
      );
      const populated = names.filter(Boolean);
      expect(new Set(populated)).toHaveLength(populated.length);
    }
  });
});
