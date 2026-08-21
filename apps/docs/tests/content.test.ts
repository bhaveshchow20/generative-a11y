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
        "/docs/integrations/ai-sdk",
        "/docs/integrations/assistant-ui",
        "/docs/integrations/ag-ui",
        "/docs/integrations/copilotkit",
        "/docs/integrations/custom",
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

  it("separates task documentation from package and symbol API reference", () => {
    const paths = DOC_PAGES.map((page) => page.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/api",
        "/api/core",
        "/api/core/create-generative-a11y",
        "/api/core/events",
        "/api/dom/create-dom-announcer",
        "/api/react/hooks",
        "/api/ai-sdk/use-chat-accessibility",
        "/api/assistant-ui/bind-thread-runtime",
        "/api/ag-ui/bind-agent",
      ]),
    );
    expect(paths).not.toEqual(
      expect.arrayContaining([
        "/docs/packages/core",
        "/docs/api/runtime",
        "/docs/browser/delivery",
      ]),
    );
  });

  it("gives major API entries signatures, contracts, examples, and code walkthroughs", () => {
    for (const path of [
      "/api/core/create-generative-a11y",
      "/api/dom/create-dom-announcer",
      "/api/react/hooks",
      "/api/ai-sdk/use-chat-accessibility",
      "/api/assistant-ui/bind-thread-runtime",
      "/api/ag-ui/bind-agent",
    ]) {
      const page = getDocPage(path)!;
      expect(page, path).toBeDefined();
      expect(page.sections.length, path).toBeGreaterThan(1);
      expect(page.sections.some((section) => section.api?.length), path).toBe(true);
      expect(page.sections.some((section) => section.code), path).toBe(true);
      for (const section of page.sections.filter((entry) => entry.code)) {
        expect(section.walkthrough?.length, `${path}#${section.id}`).toBeGreaterThan(1);
      }
    }
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
      "/api/ag-ui/bind-agent",
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
    expect(JSON.stringify(visibleContent)).not.toMatch(/\bpnpm\b/i);
  });

  it("documents major APIs and explains every substantial code sample", () => {
    for (const path of [
      "/api/core/create-generative-a11y",
      "/api/dom/create-dom-announcer",
      "/api/react",
      "/api/ai-sdk/use-chat-accessibility",
      "/api/assistant-ui/bind-thread-runtime",
      "/api/ag-ui/bind-agent",
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
      expect.arrayContaining([
        "versioning",
        "compatibility",
        "package-contracts",
        "release-gates",
        "migration-checklist",
      ]),
    );
  });

  it("documents the merged browser, assistive-technology, and runtime contracts", () => {
    expect(getDocPage("/docs/testing")?.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining([
        "test-layers",
        "browser-matrix",
        "at-fixture",
        "manual-evidence",
      ]),
    );
    expect(getDocPage("/docs/compatibility")?.sections.map(({ id }) => id)).toEqual(
      expect.arrayContaining(["browser-matrix", "matrix"]),
    );

    const core = getDocPage("/api/core/create-generative-a11y")!;
    const runtimeApi = core.sections.find(({ id }) => id === "runtime-methods")!;
    expect(runtimeApi.api).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "dispatch(event)", type: "boolean" }),
        expect.objectContaining({
          name: "pendingCount()",
          description: expect.stringMatching(/flush timers/i),
        }),
      ]),
    );

    const contributing = getDocPage("/project/contributing")!;
    expect(contributing.sections.find(({ id }) => id === "workflow")?.code?.value).toMatch(
      /npm run test:browser/,
    );
  });

  it("marks the architecture flow for an accessible visual explanation", () => {
    expect(
      getDocPage("/docs/architecture")?.sections.find(
        ({ id }) => id === "flow",
      )?.visual,
    ).toBe("runtime-flow");
  });
});
