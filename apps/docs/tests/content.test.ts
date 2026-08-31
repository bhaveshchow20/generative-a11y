import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import { runtimeScenarios } from "../components/home/runtime-scenarios";
import { getSourceManifest } from "../lib/source-manifest";
import { apiSource, docsSource } from "../lib/source";

describe("Fumadocs content", () => {
  it("is the single source of public documentation routes", async () => {
    const manifest = await getSourceManifest();
    const sourceCount = docsSource.getPages().length + apiSource.getPages().length;
    const paths = manifest.map(({ publicPath }) => publicPath);

    expect(manifest).toHaveLength(sourceCount);
    expect(new Set(paths).size).toBe(paths.length);
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
      expect(new Set(populated).size).toBe(populated.length);
    }
  });

  it("keeps approval request and resolution events correlated", () => {
    const approval = runtimeScenarios.find(({ id }) => id === "approval");
    const request = approval?.events.find(({ type }) => type === "approval.requested");
    const resolution = approval?.events.find(({ type }) => type === "approval.resolved");

    expect(request?.detail).toContain("approvalId: publish-4");
    expect(resolution?.detail).toContain("approvalId: publish-4");
  });

  it("keeps CopilotKit examples self-contained", async () => {
    const content = await readFile(
      new URL("../content/docs/integrations/copilotkit.mdx", import.meta.url),
      "utf8",
    );

    expect(content).toContain('import { useEffect, useId } from "react";');
    expect(content).toContain(
      'import { useAgent } from "@copilotkit/react-core/v2";',
    );
    expect(content).toContain(
      'import { bindAgent } from "@generative-a11y/ag-ui";',
    );
    expect(content).toMatch(
      /function CopilotKitAccessibility[\s\S]*const bindingScopeId = useId\(\)/,
    );
  });

  it("links every DOM export-map reference to its API page", async () => {
    const content = await readFile(
      new URL("../content/api/dom.mdx", import.meta.url),
      "utf8",
    );

    for (const path of [
      "/api/dom/create-dom-announcer",
      "/api/dom/connect-runtime-to-dom",
      "/api/dom/focus",
      "/api/dom/attention",
      "/api/dom/preferences",
    ]) {
      expect(content).toContain(`<a href="${path}">${path}</a>`);
    }
  });

  it("links every package family from the API index", async () => {
    const content = await readFile(
      new URL("../content/api/index.mdx", import.meta.url),
      "utf8",
    );

    for (const path of [
      "/api/core",
      "/api/dom",
      "/api/react",
      "/api/ai-sdk",
      "/api/assistant-ui",
      "/api/ag-ui",
      "/api/devtools",
      "/api/core/testing",
    ]) {
      expect(content).toContain(`href="${path}"`);
    }
  });

  it("loads public project statistics through one cacheable same-origin request", async () => {
    const component = await readFile(
      new URL("../components/project-stats.tsx", import.meta.url),
      "utf8",
    );

    expect(component).toContain('fetch("/project-stats.json"');
    expect(component).not.toContain("api.github.com");
    expect(component).not.toContain("api.npmjs.org");
  });
});
