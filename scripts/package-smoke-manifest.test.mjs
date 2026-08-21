import { describe, expect, it } from "vitest";

import * as manifestModule from "./package-smoke-manifest.mjs";

const exactPeerFixtures = {
  "@ag-ui/client": "0.0.58",
  "@ag-ui/core": "0.0.58",
  "@ai-sdk/react": "4.0.69",
  "@assistant-ui/core": "0.3.13",
  ai: "7.0.66",
  react: "19.2.8",
  "react-dom": "19.2.8",
};

describe("packed consumer manifest", () => {
  it("combines packed packages with exact peer fixtures", () => {
    expect(manifestModule.createConsumerManifest).toBeTypeOf("function");

    const manifest = manifestModule.createConsumerManifest(
      {
        packageManager: "pnpm@11.21.0",
        devDependencies: exactPeerFixtures,
      },
      {
        "@generative-a11y/core": "file:/tmp/core.tgz",
        "@generative-a11y/react": "file:/tmp/react.tgz",
      },
    );

    expect(manifest).toEqual({
      name: "generative-a11y-package-smoke",
      version: "0.0.0",
      private: true,
      type: "module",
      packageManager: "pnpm@11.21.0",
      dependencies: {
        ...exactPeerFixtures,
        "@generative-a11y/core": "file:/tmp/core.tgz",
        "@generative-a11y/react": "file:/tmp/react.tgz",
      },
    });
  });

  it.each([
    ["missing", undefined],
    ["workspace protocol", "workspace:*"],
    ["range", "^19.0.0"],
  ])("rejects a %s peer fixture version", (_case, version) => {
    expect(manifestModule.createConsumerManifest).toBeTypeOf("function");

    expect(() =>
      manifestModule.createConsumerManifest(
        {
          packageManager: "pnpm@11.21.0",
          devDependencies: { ...exactPeerFixtures, react: version },
        },
        {},
      ),
    ).toThrow(/react.*exact version/i);
  });
});

describe("TypeScript packed consumers", () => {
  it("defines modern ESM, CJS, and bundler modes", () => {
    expect(manifestModule.typescriptConsumerModes).toEqual([
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

  it("imports every public entrypoint", () => {
    expect(manifestModule.createTypeScriptConsumerSource).toBeTypeOf(
      "function",
    );

    const source = manifestModule.createTypeScriptConsumerSource();
    for (const specifier of [
      "@generative-a11y/core",
      "@generative-a11y/dom",
      "@generative-a11y/react",
      "@generative-a11y/ai-sdk",
      "@generative-a11y/ai-sdk/react",
      "@generative-a11y/assistant-ui",
      "@generative-a11y/ag-ui",
    ]) {
      expect(source).toContain(`from "${specifier}"`);
    }
  });
});
