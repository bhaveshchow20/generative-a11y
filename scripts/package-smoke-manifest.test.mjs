import { describe, expect, it } from "vitest";

import * as smoke from "./package-smoke-manifest.mjs";

const rootPackage = {
  packageManager: "pnpm@11.21.0",
  devDependencies: {
    "@ag-ui/client": "0.0.58",
    "@ag-ui/core": "0.0.58",
    "@ai-sdk/react": "4.0.69",
    "@assistant-ui/core": "0.3.13",
    "@types/node": "26.2.0",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    ai: "7.0.66",
    react: "19.2.8",
    "react-dom": "19.2.8",
  },
};

function scenarioById(id) {
  expect(smoke.packageScenarios).toBeInstanceOf(Array);
  const scenario = smoke.packageScenarios.find(
    (candidate) => candidate.id === id,
  );
  expect(scenario).toBeDefined();
  return scenario;
}

describe("isolated packed consumer scenarios", () => {
  it("prefers the local store but can fetch newly resolved transitive packages", () => {
    expect(smoke.packageInstallArguments).toContain("--prefer-offline");
    expect(smoke.packageInstallArguments).not.toContain("--offline");
  });

  it("defines one scenario per public entrypoint with only relevant fixtures", () => {
    expect(smoke.packageScenarios).toEqual([
      expect.objectContaining({
        id: "core",
        specifier: "@generative-a11y/core",
        fixtures: [],
        internalPackages: [],
      }),
      expect.objectContaining({
        id: "core-testing",
        packageName: "@generative-a11y/core",
        specifier: "@generative-a11y/core/testing",
        expectedExport: "recordRuntime",
        fixtures: [],
        internalPackages: [],
      }),
      expect.objectContaining({
        id: "dom",
        specifier: "@generative-a11y/dom",
        fixtures: [],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "devtools",
        specifier: "@generative-a11y/devtools",
        expectedExport: "createDevtoolsStore",
        fixtures: [],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "devtools-overlay",
        specifier: "@generative-a11y/devtools/overlay",
        fixtures: [],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "react",
        specifier: "@generative-a11y/react",
        fixtures: ["react", "react-dom", "@types/react", "@types/react-dom"],
        internalPackages: ["@generative-a11y/core", "@generative-a11y/dom"],
      }),
      expect.objectContaining({
        id: "ai-sdk",
        specifier: "@generative-a11y/ai-sdk",
        fixtures: ["ai", "@types/node"],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "ai-sdk-react",
        specifier: "@generative-a11y/ai-sdk/react",
        fixtures: [
          "ai",
          "@ai-sdk/react",
          "react",
          "@types/node",
          "@types/react",
        ],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "assistant-ui",
        specifier: "@generative-a11y/assistant-ui",
        fixtures: ["@assistant-ui/core", "@types/react"],
        internalPackages: ["@generative-a11y/core"],
      }),
      expect.objectContaining({
        id: "ag-ui",
        specifier: "@generative-a11y/ag-ui",
        fixtures: ["@ag-ui/client"],
        internalPackages: ["@generative-a11y/core"],
      }),
    ]);

    expect(scenarioById("ai-sdk").fixtures).not.toContain("@ai-sdk/react");
    expect(scenarioById("ai-sdk").fixtures).not.toContain("react");
    expect(scenarioById("ag-ui").fixtures).not.toContain("@ag-ui/core");
  });

  it("creates a JSON-only manifest with relative packed dependencies and overrides", () => {
    const scenario = scenarioById("react");
    const manifest = smoke.createConsumerManifest({
      rootPackage,
      scenario,
      targetDependency: "file:../../archives/react.tgz",
      internalOverrides: {
        "@generative-a11y/core": "file:../../archives/core.tgz",
        "@generative-a11y/dom": "file:../../archives/dom.tgz",
      },
      targetManifest: {
        peerDependencies: {
          react: "^18.2.0 || ^19.0.0",
          "react-dom": "^18.2.0 || ^19.0.0",
        },
      },
    });

    expect(manifest).toEqual({
      name: "generative-a11y-package-smoke-react",
      version: "0.0.0",
      private: true,
      type: "module",
      packageManager: "pnpm@11.21.0",
      dependencies: {
        "@generative-a11y/react": "file:../../archives/react.tgz",
        "@generative-a11y/core": "file:../../archives/core.tgz",
        "@generative-a11y/dom": "file:../../archives/dom.tgz",
        react: "19.2.8",
        "react-dom": "19.2.8",
        "@types/react": "19.2.18",
        "@types/react-dom": "19.2.4",
      },
    });

    expect(smoke.createPnpmWorkspaceConfig).toBeTypeOf("function");
    expect(JSON.parse(smoke.createPnpmWorkspaceConfig({}))).toEqual({
      overrides: {},
    });
    expect(
      JSON.parse(
        smoke.createPnpmWorkspaceConfig({
          "@generative-a11y/core": "file:../../archives/core.tgz",
          "@generative-a11y/dom": "file:../../archives/dom.tgz",
        }),
      ),
    ).toEqual({
      overrides: {
        "@generative-a11y/core": "file:../../archives/core.tgz",
        "@generative-a11y/dom": "file:../../archives/dom.tgz",
      },
    });
  });

  it.each([
    ["missing", undefined],
    ["workspace protocol", "workspace:*"],
    ["range", "^19.0.0"],
  ])("rejects a %s fixture version", (_case, version) => {
    const scenario = scenarioById("react");
    expect(() =>
      smoke.createConsumerManifest({
        rootPackage: {
          ...rootPackage,
          devDependencies: { ...rootPackage.devDependencies, react: version },
        },
        scenario,
        targetDependency: "file:../../archives/react.tgz",
        internalOverrides: {},
        targetManifest: { peerDependencies: { react: "^19.0.0" } },
      }),
    ).toThrow(/react.*exact version/i);
  });

  it("rejects an exact fixture outside the target peer range", () => {
    const scenario = scenarioById("react");
    expect(() =>
      smoke.createConsumerManifest({
        rootPackage: {
          ...rootPackage,
          devDependencies: {
            ...rootPackage.devDependencies,
            react: "20.0.0",
          },
        },
        scenario,
        targetDependency: "file:../../archives/react.tgz",
        internalOverrides: {},
        targetManifest: { peerDependencies: { react: "^19.0.0" } },
      }),
    ).toThrow(/react@20\.0\.0.*peer range \^19\.0\.0/i);
  });

  it("normalizes Windows-style relative archive paths without interpolation", () => {
    expect(smoke.toPackedFileDependency).toBeTypeOf("function");
    expect(smoke.toPackedFileDependency("..\\..\\archives\\core.tgz")).toBe(
      "file:../../archives/core.tgz",
    );
    expect(() =>
      smoke.toPackedFileDependency("C:\\archives\\core.tgz"),
    ).toThrow(/relative/i);
  });
});

describe("generated consumers", () => {
  it("generates explicit runtime checks without function source injection", () => {
    expect(smoke.createRuntimeConsumerSource).toBeTypeOf("function");
    const scenario = scenarioById("core");
    const source = smoke.createRuntimeConsumerSource(scenario);

    expect(source).toContain("import(specifier)");
    expect(source).toContain("require(specifier)");
    expect(source).toContain("expectedExport");
    expect(source).toContain("observed keys");
    expect(source).not.toContain("toString()");
  });

  it("defines modern ESM, CJS, and bundler modes", () => {
    expect(smoke.typescriptConsumerModes).toEqual([
      {
        name: "NodeNext ESM",
        fileName: "consumer.mts",
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      {
        name: "NodeNext CJS",
        fileName: "consumer.cts",
        module: "NodeNext",
        moduleResolution: "NodeNext",
      },
      {
        name: "Bundler",
        fileName: "consumer.ts",
        module: "ESNext",
        moduleResolution: "Bundler",
      },
    ]);
  });

  it("generates TypeScript for only the selected entrypoint", () => {
    const scenario = scenarioById("ai-sdk");
    const source = smoke.createTypeScriptConsumerSource(scenario);

    expect(source).toContain('from "@generative-a11y/ai-sdk"');
    expect(source).not.toContain("@generative-a11y/ai-sdk/react");
  });

  it("isolates only the known upstream AI SDK declaration defect", () => {
    expect(smoke.isKnownUpstreamDeclarationDiagnostic).toBeTypeOf("function");
    const aiScenario = scenarioById("ai-sdk");
    const diagnostic = {
      code: 7016,
      file: {
        fileName:
          "/tmp/node_modules/.pnpm/@ai-sdk+provider@4.0.7/node_modules/@ai-sdk/provider/dist/index.d.ts",
      },
      messageText:
        "Could not find a declaration file for module 'json-schema'.",
    };

    expect(
      smoke.isKnownUpstreamDeclarationDiagnostic(aiScenario, diagnostic),
    ).toBe(true);
    expect(
      smoke.isKnownUpstreamDeclarationDiagnostic(
        scenarioById("core"),
        diagnostic,
      ),
    ).toBe(false);
    expect(
      smoke.isKnownUpstreamDeclarationDiagnostic(aiScenario, {
        ...diagnostic,
        messageText: "Cannot find name 'Buffer'.",
      }),
    ).toBe(false);
  });
});

describe("runtime export diagnostics", () => {
  it("identifies import, require, and parity failures with observed keys", () => {
    expect(() =>
      smoke.assertRuntimeExportParity({
        specifier: "@generative-a11y/example",
        expectedExport: "expectedFunction",
        esm: { esmOnly: true },
        cjs: { esmOnly: true },
      }),
    ).toThrow(/example.*\[import\].*expectedFunction.*observed keys.*esmOnly/i);

    expect(() =>
      smoke.assertRuntimeExportParity({
        specifier: "@generative-a11y/example",
        expectedExport: "expectedFunction",
        esm: { expectedFunction() {}, esmOnly: true },
        cjs: { cjsOnly: true },
      }),
    ).toThrow(
      /example.*\[require\].*expectedFunction.*observed keys.*cjsOnly/i,
    );

    expect(() =>
      smoke.assertRuntimeExportParity({
        specifier: "@generative-a11y/example",
        expectedExport: "expectedFunction",
        esm: { expectedFunction() {}, esmOnly: true },
        cjs: { expectedFunction() {}, cjsOnly: true },
      }),
    ).toThrow(/import\/require parity.*import keys.*require keys/i);
  });
});

describe("subprocess diagnostics", () => {
  it("sets resource limits and reports command output on failure", async () => {
    expect(smoke.createCommandRunner).toBeTypeOf("function");
    let observedOptions;
    const run = smoke.createCommandRunner(async (_command, _args, options) => {
      observedOptions = options;
      const error = new Error("exited 1");
      error.stdout = "install output";
      error.stderr = "peer conflict";
      throw error;
    });

    await expect(
      run("pnpm", ["install", "--offline"], { cwd: "/tmp/consumer" }),
    ).rejects.toThrow(
      /pnpm install --offline.*\/tmp\/consumer.*install output.*peer conflict/is,
    );
    expect(observedOptions).toMatchObject({
      cwd: "/tmp/consumer",
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    });
  });
});
