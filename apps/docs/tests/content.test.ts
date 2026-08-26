import { describe, expect, it } from "vitest";

import { DOC_PAGES, getDocPage, searchDocumentation } from "../lib/content";

function visibleExplanations() {
  return DOC_PAGES.map(({ title, description, sections }) => ({
    title,
    description,
    sections: sections.map((section) => ({
      title: section.title,
      body: section.body,
      bullets: section.bullets,
      table: section.table,
      walkthrough: section.walkthrough,
      note: section.note,
      api: section.api?.map((entry) => ({
        requirement: entry.requirement,
        description: entry.description,
      })),
    })),
  }));
}

describe("documentation registry", () => {
  it("maps high-intent accessibility problems to one canonical page each", () => {
    expect(
      [
        "/docs/why-generative-a11y",
        "/docs/screen-readers-and-streaming-ai",
        "/docs/aria-live-and-generative-ai",
        "/docs/accessible-ai-agents",
      ].map((path) => getDocPage(path)?.path),
    ).toEqual([
      "/docs/why-generative-a11y",
      "/docs/screen-readers-and-streaming-ai",
      "/docs/aria-live-and-generative-ai",
      "/docs/accessible-ai-agents",
    ]);
  });

  it("keeps related documentation links inside the canonical registry", () => {
    const paths = new Set(DOC_PAGES.map((page) => page.path));

    for (const page of DOC_PAGES) {
      for (const relatedPath of page.related ?? []) {
        expect(paths.has(relatedPath), `${page.path} -> ${relatedPath}`).toBe(true);
      }
    }
  });

  it("gives major integration pages direct-arrival setup and support context", () => {
    for (const path of [
      "/docs/integrations/ai-sdk",
      "/docs/integrations/assistant-ui",
      "/docs/integrations/ag-ui",
    ]) {
      const page = getDocPage(path)!;
      const sectionIds = page.sections.map(({ id }) => id);

      expect(sectionIds, path).toEqual(
        expect.arrayContaining([
          "installation",
          "lifecycle-mapping",
          "screen-reader-behavior",
          "troubleshooting",
        ]),
      );
      expect(page.related?.length, path).toBeGreaterThan(1);
    }
  });

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
        "/docs/devtools",
        "/docs/testing/replay",
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
        "/api/devtools",
        "/api/test",
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

  it("documents diagnostics and replay APIs without overstating assistive-technology evidence", () => {
    for (const path of ["/api/devtools", "/api/test"]) {
      const page = getDocPage(path)!;
      expect(page.sections.some((section) => section.api?.length), path).toBe(true);
      expect(page.sections.some((section) => section.code), path).toBe(true);
      expect(JSON.stringify(page), path).toMatch(/does not prove|cannot prove/i);
    }
  });

  it("documents every public devtools and replay operation added in phase 4", () => {
    const devtoolsApi = getDocPage("/api/devtools")!.sections.flatMap(
      ({ api }) => api ?? [],
    );
    expect(devtoolsApi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "refreshSnapshots()" }),
        expect.objectContaining({ name: "source" }),
        expect.objectContaining({ name: "document" }),
        expect.objectContaining({ name: "copyText" }),
        expect.objectContaining({ name: "host" }),
        expect.objectContaining({ name: "runtimeSourceId" }),
      ]),
    );

    const testApi = getDocPage("/api/test")!.sections.flatMap(
      ({ api }) => api ?? [],
    );
    expect(testApi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "RuntimeRecording.events()" }),
        expect.objectContaining({ name: "RuntimeRecording.fixture()" }),
        expect.objectContaining({ name: "RuntimeRecording.clear()" }),
        expect.objectContaining({ name: "ReplayFixtureV1" }),
        expect.objectContaining({ name: "matchesPartial(actual, expected)" }),
      ]),
    );
  });

  it("documents the ManualClock method used by replay examples", () => {
    const manualClockApi = getDocPage("/api/core/testing")!.sections.find(
      ({ id }) => id === "manual-clock",
    )?.api;

    expect(manualClockApi).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "runUntilIdle(maxTasks = 10_000)",
          type: "void",
        }),
      ]),
    );
  });

  it("keeps replay examples self-contained", () => {
    const guideExample = getDocPage("/docs/testing/replay")?.sections.find(
      ({ id }) => id === "record-and-replay",
    )?.code?.value;
    const apiExample = getDocPage("/api/test")?.sections.find(
      ({ id }) => id === "record-replay",
    )?.code?.value;

    for (const example of [guideExample, apiExample]) {
      expect(example).toMatch(/const clock = new ManualClock/);
      expect(example).toMatch(/const runtime = createGenerativeA11y/);
      expect(example).toMatch(/const replayRuntime = createGenerativeA11y/);
    }
  });

  it("documents diagnostic observation and browser delivery correlation", () => {
    const runtimeMethods = getDocPage(
      "/api/core/create-generative-a11y",
    )?.sections.find(({ id }) => id === "runtime-methods")?.api;
    expect(runtimeMethods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "subscribeDiagnosticEvents(listener)" }),
        expect.objectContaining({ name: "getDiagnosticSnapshot()" }),
      ]),
    );

    const deliveryResult = getDocPage(
      "/api/dom/create-dom-announcer",
    )?.sections.find(({ id }) => id === "result")?.api;
    expect(deliveryResult).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "announcementId" }),
        expect.objectContaining({ name: "sourceType" }),
        expect.objectContaining({ name: "at" }),
        expect.objectContaining({ name: "sourceEventId" }),
        expect.objectContaining({ name: "responseId / toolId / interactionId" }),
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
      "/api/ag-ui/bind-agent",
    );
    expect(searchDocumentation("screen reader spoke")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "/docs/limitations" }),
      ]),
    );
  });

  it("presents the library without internal roadmap labels", () => {
    const visibleContent = DOC_PAGES.filter(
      ({ path }) => !["/docs/testing", "/project/contributing"].includes(path),
    ).map(({ title, description, sections }) => ({
      title,
      description,
      sections,
    }));
    expect(JSON.stringify(visibleContent)).not.toMatch(
      /Phase\s+\d|implemented|deferred|pre-release/i,
    );
    expect(JSON.stringify(visibleContent)).not.toMatch(/\bpnpm\b/i);
  });

  it("uses plain language in visible explanations", () => {
    expect(JSON.stringify(visibleExplanations())).not.toMatch(
      /observable boundary|lifecycle evidence|evidence fidelity|host-owned lifecycle|normalized policy output|replacement epoch|borrowed target/i,
    );
  });

  it("does not use em dashes in website explanations", () => {
    expect(JSON.stringify(visibleExplanations())).not.toContain("—");
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
    expect(
      contributing.sections.find(({ id }) => id === "workflow")?.code?.value,
    ).toBe(
      "corepack enable\npnpm install --frozen-lockfile\npnpm check\npnpm test:browser:install\npnpm test:browser",
    );

    const testing = getDocPage("/docs/testing")!;
    expect(
      testing.sections.find(({ id }) => id === "browser-matrix")?.code?.value,
    ).toBe("pnpm test:browser:install\npnpm test:browser");
  });

  it("marks the architecture flow for an accessible visual explanation", () => {
    expect(
      getDocPage("/docs/architecture")?.sections.find(
        ({ id }) => id === "flow",
      )?.visual,
    ).toBe("runtime-flow");
  });
});
