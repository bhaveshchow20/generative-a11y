import { describe, expect, it } from "vitest";

import { DOC_PAGES, getDocPage, searchDocumentation } from "../lib/content";

describe("documentation registry", () => {
  it("defines every required deep-link route exactly once", () => {
    const paths = DOC_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/docs/getting-started",
        "/docs/architecture",
        "/docs/integrations",
        "/docs/lifecycle/streaming",
        "/docs/lifecycle/tools",
        "/docs/lifecycle/stop-retry",
        "/docs/lifecycle/interactions",
        "/docs/lifecycle/identity",
        "/docs/packages/core",
        "/docs/packages/dom",
        "/docs/packages/react",
        "/docs/integrations/ai-sdk",
        "/docs/integrations/assistant-ui",
        "/docs/integrations/ag-ui",
        "/docs/integrations/copilotkit",
        "/docs/integrations/custom",
        "/docs/api/events",
        "/docs/api/runtime",
        "/docs/api/policy",
        "/docs/api/diagnostics",
        "/docs/browser/delivery",
        "/docs/browser/preferences",
        "/docs/testing",
        "/docs/troubleshooting",
        "/docs/compatibility",
        "/docs/stability",
        "/docs/limitations",
        "/project/overview",
        "/project/contributing",
      ]),
    );
  });

  it("keeps every page complete and searchable", () => {
    for (const page of DOC_PAGES) {
      expect(page.title.length).toBeGreaterThan(2);
      expect(page.description.length).toBeGreaterThan(40);
      expect(page.sections.length).toBeGreaterThan(1);
      expect(getDocPage(page.path)).toBe(page);
    }

    expect(searchDocumentation("stale response")[0]?.path).toBe(
      "/docs/lifecycle/stop-retry",
    );
    expect(searchDocumentation("bindAgent")[0]?.path).toBe(
      "/docs/integrations/ag-ui",
    );
    expect(searchDocumentation("screen reader spoke")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/docs/limitations" }),
      ]),
    );
  });

  it("presents the library without internal roadmap labels", () => {
    const visibleContent = DOC_PAGES.map(({ title, description, sections }) => ({
      title,
      description,
      sections,
    }));
    expect(JSON.stringify(visibleContent)).not.toMatch(
      /Phase\s+\d|implemented|deferred|pre-release/i,
    );
  });

  it("documents major APIs and explains every substantial code sample", () => {
    for (const path of [
      "/docs/packages/core",
      "/docs/packages/dom",
      "/docs/packages/react",
      "/docs/integrations/ai-sdk",
      "/docs/integrations/assistant-ui",
      "/docs/integrations/ag-ui",
    ]) {
      const page = getDocPage(path)!;
      expect(page.sections.some((section) => section.api?.length)).toBe(true);
    }

    for (const page of DOC_PAGES) {
      for (const section of page.sections.filter((entry) => entry.code)) {
        expect(section.walkthrough?.length, `${page.path}#${section.id}`).toBeGreaterThan(1);
      }
    }
  });

  it("documents release adoption and maintenance workflows", () => {
    expect(getDocPage("/docs/integrations")?.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["decision-table", "fidelity", "installation"]),
    );
    expect(getDocPage("/docs/troubleshooting")?.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["nothing-announced", "repeated-output", "diagnostics"]),
    );
    expect(getDocPage("/docs/stability")?.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["versioning", "compatibility", "migration-checklist"]),
    );
  });
});
