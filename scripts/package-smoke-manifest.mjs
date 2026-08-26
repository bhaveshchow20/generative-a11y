import assert from "node:assert/strict";

const exactVersionPattern =
  /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

export const packageInstallArguments = Object.freeze([
  "install",
  "--strict-peer-dependencies",
  "--ignore-scripts",
  "--prefer-offline",
  "--lockfile=false",
]);

export const packageScenarios = [
  {
    id: "core",
    packageName: "@generative-a11y/core",
    specifier: "@generative-a11y/core",
    expectedExport: "createGenerativeA11y",
    fixtures: [],
    internalPackages: [],
  },
  {
    id: "core-testing",
    packageName: "@generative-a11y/core",
    specifier: "@generative-a11y/core/testing",
    expectedExport: "recordRuntime",
    fixtures: [],
    internalPackages: [],
  },
  {
    id: "dom",
    packageName: "@generative-a11y/dom",
    specifier: "@generative-a11y/dom",
    expectedExport: "createDOMAnnouncer",
    fixtures: [],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "devtools",
    packageName: "@generative-a11y/devtools",
    specifier: "@generative-a11y/devtools",
    expectedExport: "createDevtoolsStore",
    fixtures: [],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "devtools-overlay",
    packageName: "@generative-a11y/devtools",
    specifier: "@generative-a11y/devtools/overlay",
    expectedExport: "mountDevtoolsOverlay",
    fixtures: [],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "react",
    packageName: "@generative-a11y/react",
    specifier: "@generative-a11y/react",
    expectedExport: "GenerativeA11yProvider",
    fixtures: ["react", "react-dom", "@types/react", "@types/react-dom"],
    internalPackages: ["@generative-a11y/core", "@generative-a11y/dom"],
  },
  {
    id: "ai-sdk",
    packageName: "@generative-a11y/ai-sdk",
    specifier: "@generative-a11y/ai-sdk",
    expectedExport: "createObserver",
    fixtures: ["ai", "@types/node"],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "ai-sdk-react",
    packageName: "@generative-a11y/ai-sdk",
    specifier: "@generative-a11y/ai-sdk/react",
    expectedExport: "useChatAccessibility",
    fixtures: ["ai", "@ai-sdk/react", "react", "@types/node", "@types/react"],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "assistant-ui",
    packageName: "@generative-a11y/assistant-ui",
    specifier: "@generative-a11y/assistant-ui",
    expectedExport: "bindThreadRuntime",
    fixtures: ["@assistant-ui/core", "@types/react"],
    internalPackages: ["@generative-a11y/core"],
  },
  {
    id: "ag-ui",
    packageName: "@generative-a11y/ag-ui",
    specifier: "@generative-a11y/ag-ui",
    expectedExport: "bindAgent",
    fixtures: ["@ag-ui/client"],
    internalPackages: ["@generative-a11y/core"],
  },
];

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

export function createTypeScriptConsumerSource(scenario) {
  return `import { ${scenario.expectedExport} } from "${scenario.specifier}";

void ${scenario.expectedExport};
`;
}

export function createRuntimeConsumerSource(scenario) {
  return `import assert from "node:assert/strict";
import { createRequire } from "node:module";

const specifier = ${JSON.stringify(scenario.specifier)};
const expectedExport = ${JSON.stringify(scenario.expectedExport)};
const require = createRequire(import.meta.url);
const esm = await import(specifier);
const cjs = require(specifier);
const formatKeys = (module) => \`[\${Object.keys(module).sort().join(", ")}]\`;
const esmKeys = formatKeys(esm);
const cjsKeys = formatKeys(cjs);
assert.equal(
  typeof esm[expectedExport],
  "function",
  \`\${specifier} [import] expected export "\${expectedExport}" to be a function; observed keys: \${esmKeys}\`,
);
assert.equal(
  typeof cjs[expectedExport],
  "function",
  \`\${specifier} [require] expected export "\${expectedExport}" to be a function; observed keys: \${cjsKeys}\`,
);
assert.deepEqual(
  Object.keys(esm).sort(),
  Object.keys(cjs).sort(),
  \`\${specifier} [import/require parity] expected export "\${expectedExport}"; import keys: \${esmKeys}; require keys: \${cjsKeys}\`,
);
`;
}

export function isKnownUpstreamDeclarationDiagnostic(scenario, diagnostic) {
  const fileName = diagnostic.file?.fileName.replaceAll("\\", "/") ?? "";
  const message =
    typeof diagnostic.messageText === "string"
      ? diagnostic.messageText
      : JSON.stringify(diagnostic.messageText);
  return (
    scenario.id.startsWith("ai-sdk") &&
    diagnostic.code === 7016 &&
    fileName.includes("/@ai-sdk+provider@") &&
    fileName.endsWith("/@ai-sdk/provider/dist/index.d.ts") &&
    message.includes("json-schema")
  );
}

export function assertRuntimeExportParity({
  specifier,
  expectedExport,
  esm,
  cjs,
}) {
  const formatKeys = (module) => `[${Object.keys(module).sort().join(", ")}]`;
  const esmKeys = formatKeys(esm);
  const cjsKeys = formatKeys(cjs);

  assert.equal(
    typeof esm[expectedExport],
    "function",
    `${specifier} [import] expected export "${expectedExport}" to be a function; observed keys: ${esmKeys}`,
  );
  assert.equal(
    typeof cjs[expectedExport],
    "function",
    `${specifier} [require] expected export "${expectedExport}" to be a function; observed keys: ${cjsKeys}`,
  );
  assert.deepEqual(
    Object.keys(esm).sort(),
    Object.keys(cjs).sort(),
    `${specifier} [import/require parity] expected export "${expectedExport}"; import keys: ${esmKeys}; require keys: ${cjsKeys}`,
  );
}

function parseVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
  return match?.slice(1).map(Number);
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index] - right[index];
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

function satisfiesComparator(version, comparator) {
  const match = /^(\^|>=|<=|>|<)?(\d+(?:\.\d+){0,2})$/.exec(comparator);
  if (!match) return false;
  const operator = match[1] ?? "=";
  const target = match[2].split(".").map(Number);
  while (target.length < 3) target.push(0);
  const comparison = compareVersions(version, target);
  if (operator === "=") return comparison === 0;
  if (operator === ">=") return comparison >= 0;
  if (operator === "<=") return comparison <= 0;
  if (operator === ">") return comparison > 0;
  if (operator === "<") return comparison < 0;
  const upper =
    target[0] > 0
      ? [target[0] + 1, 0, 0]
      : target[1] > 0
        ? [0, target[1] + 1, 0]
        : [0, 0, target[2] + 1];
  return comparison >= 0 && compareVersions(version, upper) < 0;
}

function satisfiesPeerRange(version, range) {
  const parsed = parseVersion(version);
  if (!parsed) return false;
  return range.split("||").some((alternative) =>
    alternative
      .trim()
      .split(/\s+/)
      .every((comparator) => satisfiesComparator(parsed, comparator)),
  );
}

export function toPackedFileDependency(relativeArchivePath) {
  const normalized = relativeArchivePath.replaceAll("\\", "/");
  if (
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      `packed archive path must be relative: ${relativeArchivePath}`,
    );
  }
  return `file:${normalized}`;
}

export function createConsumerManifest({
  rootPackage,
  scenario,
  targetDependency,
  internalOverrides = {},
  targetManifest,
}) {
  const fixtureDependencies = Object.fromEntries(
    scenario.fixtures.map((packageName) => {
      const version = rootPackage.devDependencies?.[packageName];
      if (typeof version !== "string" || !exactVersionPattern.test(version)) {
        throw new Error(
          `${packageName} must have an exact version in root devDependencies`,
        );
      }
      const peerRange = targetManifest.peerDependencies?.[packageName];
      if (peerRange && !satisfiesPeerRange(version, peerRange)) {
        throw new Error(
          `${packageName}@${version} does not satisfy target peer range ${peerRange}`,
        );
      }
      return [packageName, version];
    }),
  );

  return {
    name: `generative-a11y-package-smoke-${scenario.id}`,
    version: "0.0.0",
    private: true,
    type: "module",
    packageManager: rootPackage.packageManager,
    dependencies: {
      [scenario.packageName]: targetDependency,
      ...internalOverrides,
      ...fixtureDependencies,
    },
  };
}

export function createPnpmWorkspaceConfig(internalOverrides) {
  return `${JSON.stringify({ overrides: internalOverrides }, null, 2)}\n`;
}

export function createCommandRunner(execFileAsync) {
  return async function runCommand(command, args, options = {}) {
    const executionOptions = {
      ...options,
      timeout: 120_000,
      maxBuffer: 10 * 1024 * 1024,
    };
    try {
      return await execFileAsync(command, args, executionOptions);
    } catch (cause) {
      const stdout = cause.stdout || "<empty>";
      const stderr = cause.stderr || "<empty>";
      throw new Error(
        `Command failed: ${command} ${args.join(" ")}\ncwd: ${options.cwd ?? "<inherited>"}\nstdout:\n${stdout}\nstderr:\n${stderr}`,
        { cause },
      );
    }
  };
}
