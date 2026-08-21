const peerFixtureNames = [
  "@ag-ui/client",
  "@ag-ui/core",
  "@ai-sdk/react",
  "@assistant-ui/core",
  "ai",
  "react",
  "react-dom",
];

const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const typescriptConsumerModes = [
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
];

export function createTypeScriptConsumerSource() {
  return `import { createGenerativeA11y } from "@generative-a11y/core";
import { createDOMAnnouncer } from "@generative-a11y/dom";
import { GenerativeA11yProvider } from "@generative-a11y/react";
import { createObserver } from "@generative-a11y/ai-sdk";
import { useChatAccessibility } from "@generative-a11y/ai-sdk/react";
import { bindThreadRuntime } from "@generative-a11y/assistant-ui";
import { bindAgent } from "@generative-a11y/ag-ui";

void [
  createGenerativeA11y,
  createDOMAnnouncer,
  GenerativeA11yProvider,
  createObserver,
  useChatAccessibility,
  bindThreadRuntime,
  bindAgent,
];
`;
}

export function createConsumerManifest(rootPackage, packedDependencies) {
  const fixtureDependencies = Object.fromEntries(
    peerFixtureNames.map((packageName) => {
      const version = rootPackage.devDependencies?.[packageName];
      if (typeof version !== "string" || !exactVersionPattern.test(version)) {
        throw new Error(
          `${packageName} must have an exact version in root devDependencies`,
        );
      }
      return [packageName, version];
    }),
  );

  return {
    name: "generative-a11y-package-smoke",
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager: rootPackage.packageManager,
    dependencies: {
      ...fixtureDependencies,
      ...packedDependencies,
    },
  };
}
